// src/components/MetricsDashboard.jsx
import React, { useState, useEffect } from "react";
import "./MetricsDashboard.css";

export default function MetricsDashboard() {

  const [showForm, setShowForm] = useState(false);
  const [calcForm, setCalcForm] = useState({
    owner: "",
    repository: "",
    since_dt: "",
    until_dt: "",
    bug_label: "",
  });
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState(null);

  const STORE_ENDPOINT = "http://localhost:8000/metrics/";

  // Toggle form visibility
  const toggleForm = () => {
    setCalcError(null);
    setCalcResult(null);
    setShowForm((prev) => !prev);
  };

  // Handle input changes
  const handleCalcChange = (e) => {
    const { name, value } = e.target;
    setCalcForm((prev) => ({ ...prev, [name]: value }));
  };

  // Utility to read csrf token from cookie
  function getCSRFToken() {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrftoken="));
    return match ? match.split("=")[1] : "";
  }

  // Submit handler: POST JSON to /metrics/, with CSRF included
  const handleCalculate = async (e) => {
    e.preventDefault();
    setCalcLoading(true);
    setCalcError(null);
    setCalcResult(null);

    const { owner, repository, since_dt, until_dt, bug_label } = calcForm;
    if (!owner || !repository || !since_dt || !until_dt || !bug_label) {
      setCalcError("All fields are required.");
      setCalcLoading(false);
      return;
    }

    // Convert datetime-local to ISO string
    let since_iso, until_iso;
    try {
      since_iso = new Date(since_dt).toISOString();
      until_iso = new Date(until_dt).toISOString();
    } catch {
      setCalcError("Invalid date format.");
      setCalcLoading(false);
      return;
    }

    const csrftoken = getCSRFToken();

    try {
      const resp = await fetch(STORE_ENDPOINT, {
        method: "POST",
        credentials: "include", // ensure CSRF cookie is sent
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken, // include CSRF token
        },
        body: JSON.stringify({
          owner,
          repository,
          since_day: since_iso,
          until_day: until_iso,
          bug_label,
        }),
      });
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => null);
        throw new Error(errJson?.error || `HTTP ${resp.status}`);
      }
      const json = await resp.json();
      setCalcResult(json);
      setShowForm(false);
    } catch (err) {
      console.error("Error calculating metrics:", err);
      setCalcError(err.message);
    } finally {
      setCalcLoading(false);
    }
  };

  const twoDigits = (num) =>
    typeof num === "number" && !isNaN(num) ? num.toFixed(2) : "—";

  //
  // ─── SECTION B: “All Projects Metrics” ─────────────────────────────────
  //
  const [allData, setAllData] = useState(null);
  const [loadingAll, setLoadingAll] = useState(true);
  const [errorAll, setErrorAll] = useState(null);

  const ALL_ENDPOINT = "http://localhost:8000/metrics/all/";

  useEffect(() => {
    async function fetchAll() {
      try {
        const resp = await fetch(ALL_ENDPOINT, {
          credentials: "include",
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status} – ${resp.statusText}`);
        const json = await resp.json();
        setAllData(json);
      } catch (err) {
        console.error("Error fetching all metrics:", err);
        setErrorAll(err.message);
      } finally {
        setLoadingAll(false);
      }
    }
    fetchAll();
  }, []);

  return (
    <div className="dashboard">
      {/* ───────────── SECTION A: Button + Form ───────────── */}
      <div className="calc-panel">
        <button className="toggle-button" onClick={toggleForm}>
          {showForm ? "Cancel" : "Calculate New Metrics"}
        </button>

        {showForm && (
          <form className="calc-form" onSubmit={handleCalculate}>
            <label>
              Owner:
              <input
                type="text"
                name="owner"
                value={calcForm.owner}
                onChange={handleCalcChange}
                placeholder="e.g. grafana"
              />
            </label>
            <label>
              Repository:
              <input
                type="text"
                name="repository"
                value={calcForm.repository}
                onChange={handleCalcChange}
                placeholder="e.g. grafana"
              />
            </label>
            <label>
              Since:
              <input
                type="datetime-local"
                name="since_dt"
                value={calcForm.since_dt}
                onChange={handleCalcChange}
              />
            </label>
            <label>
              Until:
              <input
                type="datetime-local"
                name="until_dt"
                value={calcForm.until_dt}
                onChange={handleCalcChange}
              />
            </label>
            <label>
              Bug Label:
              <input
                type="text"
                name="bug_label"
                value={calcForm.bug_label}
                onChange={handleCalcChange}
                placeholder="e.g. bug"
              />
            </label>
            <button type="submit" disabled={calcLoading}>
              {calcLoading ? "Calculating…" : "Submit"}
            </button>
            {calcError && <div className="error">{calcError}</div>}
          </form>
        )}

        {calcResult && (
          <div className="calc-results">
            <h3>
              Results for {calcForm.owner}/{calcForm.repository}
            </h3>
            <div className="cards-grid">
              {/* Deployment Frequency */}
              <div className="metric-card">
                <h4 className="card-title">Deployment Frequency</h4>
                <div className="card-line">
                  <span className="metric-value">
                    {twoDigits(calcResult.deployment_frequency.mean_days)}
                  </span>
                  <span className="metric-label">mean (days)</span>
                </div>
                <div className="card-line">
                  <span className="metric-value">
                    {twoDigits(calcResult.deployment_frequency.std_dev_days)}
                  </span>
                  <span className="metric-label">std dev (days)</span>
                </div>
              </div>

              {/* Change Delivery Time */}
              <div className="metric-card">
                <h4 className="card-title">Change Delivery Time</h4>
                <div className="card-line">
                  <span className="metric-value">
                    {twoDigits(calcResult.change_delivery_time.mean_days)}
                  </span>
                  <span className="metric-label">mean (days)</span>
                </div>
                <div className="card-line">
                  <span className="metric-value">
                    {twoDigits(calcResult.change_delivery_time.std_dev_days)}
                  </span>
                  <span className="metric-label">std dev (days)</span>
                </div>
              </div>

              {/* Service Recovery Time */}
              <div className="metric-card">
                <h4 className="card-title">Service Recovery Time</h4>
                <div className="card-line">
                  <span className="metric-value">
                    {twoDigits(calcResult.service_recovery_time.mean_days)}
                  </span>
                  <span className="metric-label">mean (days)</span>
                </div>
                <div className="card-line">
                  <span className="metric-value">
                    {twoDigits(calcResult.service_recovery_time.std_dev_days)}
                  </span>
                  <span className="metric-label">std dev (days)</span>
                </div>
              </div>

              {/* Change Failure Rate */}
              <div className="metric-card">
                <h4 className="card-title">Change Failure Rate</h4>
                <div className="card-line">
                  <span className="metric-value failure-rate">
                    {twoDigits(calcResult.change_failure_rate)}%
                  </span>
                  <span className="metric-label">of failed changes</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ───────────── SECTION B: All Projects Metrics ───────────── */}
      <h2 className="dashboard-title">All Projects Metrics</h2>
      {loadingAll && <div className="loading">Loading all metrics…</div>}
      {errorAll && <div className="error">Error: {errorAll}</div>}

      {allData && allData.projects.length === 0 && (
        <div className="no-metrics">No projects found in the database.</div>
      )}

      {allData &&
        allData.projects.map((proj) => {
          const { owner, repository, metrics } = proj;
          return (
            <div className="project-panel" key={`${owner}/${repository}`}>
              <h3 className="project-title">
                {owner}&#47;{repository}
              </h3>

              {metrics.length === 0 ? (
                <div className="no-metrics">
                  No metrics recorded for this project.
                </div>
              ) : (
                <table className="metrics-table">
                  <thead>
                    <tr>
                      <th>Metric Type</th>
                      <th>Value</th>
                      <th>Variance</th>
                      <th>Since</th>
                      <th>Until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m) => (
                      <tr key={m.id}>
                        <td className="metric-type">
                          {m.metric_type.replace(/_/g, " ")}
                        </td>
                        <td>{twoDigits(m.value)}</td>
                        <td>
                          {m.variance !== null ? twoDigits(m.variance) : "—"}
                        </td>
                        <td>{new Date(m.since).toLocaleString()}</td>
                        <td>{new Date(m.until).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
    </div>
  );
}
