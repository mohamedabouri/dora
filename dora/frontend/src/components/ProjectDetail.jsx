import React, { useEffect, useState } from 'react';
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
import '../styles/ProjectDetail.css';

export default function ProjectDetail({ owner, repository }) {
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(
      `${API_BASE_URL}/metrics/compare/?projects=${encodeURIComponent(
        `${owner}/${repository}`
      )}`
    )
      .then((res) => res.json())
      .then((data) => {
        const proj = data.projects?.[0];
        setProjectData(proj?.metrics ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setProjectData(null);
        setLoading(false);
      });
  }, [owner, repository]);

  if (loading) {
    return (
      <div
        className="flex justify-center items-center h-64"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="spinner" role="status">
          <span className="sr-only">Loading metrics…</span>
        </div>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="alert-warning" role="alert">
        No metrics found for this project.
      </div>
    );
  }

  const metricTypes = Object.keys(projectData);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 bg-neutral-50 dark:bg-neutral-900">
      <h2 className="text-3xl font-heading font-semibold text-neutral-800 dark:text-neutral-100 mb-6 animate-fadeInUp">
        {owner}/{repository} Metrics Evolution
      </h2>

      <div className="space-y-8">
        {metricTypes.map((type) => {
          const sorted = [...projectData[type]].sort(
            (a, b) => new Date(a.until) - new Date(b.until)
          );
          const dataPoints = sorted.map((pt) => ({
            date: pt.until.slice(0, 10),
            value: pt.value,
          }));

          return (
            <div key={type} className="chart-card">
              <h4 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-4 capitalize">
                {type.replace(/_/g, ' ')}
              </h4>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dataPoints}>
                  <CartesianGrid
                    stroke="#e5e7eb"
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
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      padding: '0.5rem',
                      color: '#1f2937',
                    }}
                    wrapperStyle={{ zIndex: 1000 }}
                    itemStyle={{ color: '#3B82F6' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: '0.5rem' }}
                    formatter={(value) => (
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">
                        {value.replace(/_/g, ' ')}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={type.replace(/_/g, ' ')}
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#3B82F6' }}
                    activeDot={{ r: 6, fill: '#2563EB' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}
