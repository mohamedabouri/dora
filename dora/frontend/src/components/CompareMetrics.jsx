import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import '../styles/CompareMetrics.css';

function CompareMetrics() {
  const [allProjects, setAllProjects] = useState([]);
  const [selected, setSelected] = useState([]);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Define an array of distinct colors using the Tableau 10 palette
  const colors = [
    '#1f77b4', // Blue
    '#ff7f0e', // Orange
    '#2ca02c', // Green
    '#d62728', // Red
    '#9467bd', // Purple
    '#8c564b', // Brown
    '#e377c2', // Pink
    '#7f7f7f', // Gray
    '#bcbd22', // Yellow
    '#17becf', // Cyan
  ];

  useEffect(() => {
    fetch("http://localhost:8000/metrics/all/")
      .then((res) => {
        if (!res.ok) throw new Error("Could not fetch project list");
        return res.json();
      })
      .then((data) => {
        const projIdentifiers = data.projects.map((p) => ({
          label: `${p.owner}/${p.repository}`,
          value: `${p.owner}/${p.repository}`,
        }));
        setAllProjects(projIdentifiers);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load project list.");
      });
  }, []);

  useEffect(() => {
    if (selected.length < 2) {
      setCompareData(null);
      return;
    }
    setLoading(true);
    setError(null);

    const q = selected.join(",");
    fetch(`http://localhost:8000/metrics/compare/?projects=${encodeURIComponent(q)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Error fetching comparison data");
        return res.json();
      })
      .then((data) => {
        setCompareData(data.projects);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch comparison data.");
        setLoading(false);
      });
  }, [selected]);

  const onSelectionChange = (e) => {
    const options = Array.from(e.target.selectedOptions);
    const vals = options.map((opt) => opt.value);
    setSelected(vals);
  };

  const renderCharts = () => {
    if (!compareData) return null;
    const metricTypes = new Set();
    compareData.forEach((proj) => {
      Object.keys(proj.metrics).forEach((mtype) => metricTypes.add(mtype));
    });

    return Array.from(metricTypes).map((mtype) => {
      // Collect all unique until dates
      const allUntilDates = new Set();
      compareData.forEach((proj) => {
        const metrics = proj.metrics[mtype] || [];
        metrics.forEach((metric) => {
          const untilDate = new Date(metric.until).toISOString().substring(0, 10);
          allUntilDates.add(untilDate);
        });
      });
      const sortedDates = Array.from(allUntilDates).sort();

      // Create project data maps
      const projectData = {};
      compareData.forEach((proj) => {
        const key = `${proj.owner}_${proj.repository}`.replace(/\//g, '_');
        projectData[key] = {};
        const metrics = proj.metrics[mtype] || [];
        metrics.forEach((metric) => {
          const untilDate = new Date(metric.until).toISOString().substring(0, 10);
          projectData[key][untilDate] = metric.value;
        });
      });

      // Create chart data
      const chartData = sortedDates.map((date) => {
        const entry = { date };
        compareData.forEach((proj) => {
          const key = `${proj.owner}_${proj.repository}`.replace(/\//g, '_');
          entry[key] = projectData[key][date] || null;
        });
        return entry;
      });

      return (
        <div key={mtype} className="chart-container">
          <h3>{mtype.replace(/_/g, " ")}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {compareData.map((proj, index) => {
                const key = `${proj.owner}_${proj.repository}`.replace(/\//g, '_');
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={`${proj.owner}/${proj.repository}`}
                    dot={true}
                    stroke={colors[index % colors.length]} // Assign a distinct color
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    });
  };

  return (
    <div className="compare-metrics-container">
      <h2>Compare Metrics Across Projects</h2>
      {error && <div className="error-alert">{error}</div>}
      <div className="select-container">
        <label htmlFor="projectSelect">
          Choose at least two projects (Ctrl+click or Cmd+click to multi-select):
        </label>
        <select
          id="projectSelect"
          multiple
          size={Math.min(allProjects.length, 6)}
          className="project-select"
          onChange={onSelectionChange}
        >
          {allProjects.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {selected.length < 2 && (
        <p className="info-text">Select two or more projects to see comparison charts.</p>
      )}
      {loading && <div className="loading-spinner"><div className="spinner"></div></div>}
      {renderCharts()}
    </div>
  );
}

export default CompareMetrics;