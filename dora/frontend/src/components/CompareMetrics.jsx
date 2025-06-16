import React, { useEffect, useState, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { API_BASE_URL } from '../config';
import '../index.css';
import '../styles/CompareMetrics.css';

export default function CompareMetrics() {
  const [allProjects, setAllProjects] = useState([]);
  const [selected, setSelected] = useState([]);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Color palette aligned with tailwind.config.js
  const colors = [
    '#3B82F6', // primary.light
    '#FBBF24', // accent.light
    '#6EE7B7', // secondary.light
    '#EF4444', // red-500
    '#8B5CF6', // purple-500
    '#6B7280', // neutral-500
    '#EC4899', // pink-500
    '#4B5563', // neutral-600
    '#A3E635', // lime-500
    '#06B6D4', // cyan-500
  ];

  // Load project list
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch(`${API_BASE_URL}/metrics/all/`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setAllProjects(
          data.projects.map((p) => ({
            label: `${p.owner}/${p.repository}`,
            value: `${p.owner}/${p.repository}`,
          }))
        );
      } catch {
        setError('Failed to load project list.');
      }
    }
    fetchProjects();
  }, []);

  // Fetch comparison when 2+ selected
  useEffect(() => {
    if (selected.length < 2) {
      setCompareData(null);
      return;
    }
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const q = encodeURIComponent(selected.join(','));
        const res = await fetch(
          `${API_BASE_URL}/metrics/compare/?projects=${q}`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCompareData(data.projects);
      } catch {
        setError('Failed to fetch comparison data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [selected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleProject = (value) =>
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );

  // Render one chart per metric type
  const renderCharts = () => {
    if (!compareData) return null;
    const metricTypes = Array.from(
      new Set(compareData.flatMap((p) => Object.keys(p.metrics)))
    );

    return metricTypes.map((type) => {
      // Collect all dates
      const dateSet = new Set();
      compareData.forEach((proj) =>
        (proj.metrics[type] || []).forEach((m) =>
          dateSet.add(new Date(m.until).toISOString().slice(0, 10))
        )
      );
      const dates = [...dateSet].sort();

      // Build a map per project
      const series = {};
      compareData.forEach((proj) => {
        const key = `${proj.owner}/${proj.repository}`;
        series[key] = {};
        (proj.metrics[type] || []).forEach((m) => {
          const d = new Date(m.until).toISOString().slice(0, 10);
          series[key][d] = m.value;
        });
      });

      // Prepare chart data array
      const chartData = dates.map((d) => {
        const entry = { date: d };
        Object.keys(series).forEach((k) => {
          entry[k] = series[k][d] ?? null;
        });
        return entry;
      });

      return (
        <div key={type} className="card mb-6">
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-4 capitalize animate-fadeInUp">
            {type.replace(/_/g, ' ')}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid
                stroke="#E5E7EB"
                strokeDasharray="3 3"
                className="dark:stroke-neutral-700"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                className="dark:stroke-neutral-300"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="dark:stroke-neutral-300"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  padding: 8,
                }}
                itemStyle={{ color: '#3B82F6' }}
                wrapperStyle={{ zIndex: 1000 }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingTop: 8 }}
                formatter={(val) => (
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {val}
                  </span>
                )}
              />
              {Object.keys(series).map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: colors[i % colors.length] }}
                  activeDot={{ r: 6, fill: colors[i % colors.length] }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    });
  };

  return (
    <div className="compare-container bg-neutral-50 dark:bg-neutral-900">
      <header className="mb-8">
        <h2 className="text-4xl font-heading font-bold text-primary animate-fadeInUp">
          Compare Metrics Across Projects
        </h2>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">
          Select two or more projects to view comparison charts.
        </p>
      </header>

      {error && (
        <div className="alert-danger mb-6" role="alert">
          {error}
        </div>
      )}

      <div ref={dropdownRef} className="multiselect-container mb-6">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Choose projects:
        </label>
        <div
          className="multiselect-header"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="project-options"
          onClick={() => setShowDropdown((p) => !p)}
        >
          {selected.length === 0 ? (
            <span className="text-neutral-400">Select projects…</span>
          ) : (
            selected.map((proj) => (
              <span key={proj} className="tag">
                {proj}
                <button
                  type="button"
                  className="tag-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleProject(proj);
                  }}
                  aria-label={`Remove ${proj}`}
                >
                  ×
                </button>
              </span>
            ))
          )}
          <span className="dropdown-arrow">
            {showDropdown ? '▴' : '▾'}
          </span>
        </div>

        {showDropdown && (
          <div
            id="project-options"
            className="options-dropdown"
            role="listbox"
          >
            {allProjects.map((p) => {
              const checked = selected.includes(p.value);
              return (
                <label
                  key={p.value}
                  className="flex items-center px-3 py-2 text-sm
                             hover:bg-neutral-100 dark:hover:bg-neutral-700
                             transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProject(p.value)}
                    className="mr-2 accent-primary"
                    aria-label={p.label}
                  />
                  <span className="flex-1">{p.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {selected.length < 2 && !loading && (
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-6">
          Select two or more projects to see comparison charts.
        </p>
      )}

      {loading && (
        <div
          className="flex justify-center items-center h-64"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="spinner" role="status">
            <span className="sr-only">
              Loading comparison data…
            </span>
          </div>
        </div>
      )}

      {renderCharts()}
    </div>
  );
}
