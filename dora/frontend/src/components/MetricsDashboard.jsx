import React, { useState, useEffect, useRef } from "react";
import "../styles/MetricsDashboard.css";
import CompareMetrics from "./CompareMetrics";
import ProjectDetail from "./ProjectDetail";
import { API_BASE_URL } from "../config";

export default function MetricsDashboard() {
  const [view, setView] = useState("list");
  const [selectedProject, setSelectedProject] = useState(null);
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

  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showMetricDropdown, setShowMetricDropdown] = useState(false);

  const [filterForm, setFilterForm] = useState({
    projects: [],
    metricTypes: [],
    since: "",
    until: "",
  });

  const [allData, setAllData] = useState(null);
  const [loadingAll, setLoadingAll] = useState(true);
  const [errorAll, setErrorAll] = useState(null);

  // State for complete project list
  const [allProjects, setAllProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [errorProjects, setErrorProjects] = useState(null);

  // Which project’s “⋯” menu is open:
  const [openMenuProject, setOpenMenuProject] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalProject, setModalProject] = useState(null);
  const [modalSince, setModalSince] = useState("");
  const [modalUntil, setModalUntil] = useState("");

  const openOptions = (projKey) => setOpenMenuProject(projKey);
  const closeOptions = () => setOpenMenuProject(null);

  const onDeleteProject = (proj) => {
    closeOptions();
    setModalType("deleteProject");
    setModalProject(proj);
    setModalOpen(true);
  };

  const onDeleteMetrics = (proj) => {
    closeOptions();
    setModalType("deleteMetrics");
    setModalProject(proj);
    setModalSince("");
    setModalUntil("");
    setModalOpen(true);
  };

  function getCSRFToken() {
    const match = document.cookie
      .split("; ")
      .find(row => row.startsWith("csrftoken="));
    return match ? match.split("=")[1] : "";
  }

  const confirmDeleteProject = async () => {
    await fetch(
      `${API_BASE_URL}/metrics/projects/${modalProject.id}/delete/`,
      { method: "DELETE", credentials: "include", headers: {
        "X-CSRFToken": getCSRFToken(),
      }, }
    );
    setModalOpen(false);
    fetchAll(); fetchAllProjects();
  };

  const confirmDeleteMetrics = async () => {
    const params = new URLSearchParams();
    params.append("projects", `${modalProject.owner}/${modalProject.repository}`);
    if (modalSince) params.append(
      "since",
      new Date(modalSince).toISOString().replace(/Z$/, "+00:00")
    );
    if (modalUntil) {
      const u = new Date(modalUntil);
      u.setHours(23,59,59,999);
      params.append("until", u.toISOString().replace(/Z$/, "+00:00"));
    }
    await fetch(
      `${API_BASE_URL}/metrics/delete/?${params.toString()}`,
      { method: "DELETE", credentials: "include", headers: {
        "X-CSRFToken": getCSRFToken(),
      }, }
    );
    setModalOpen(false);
    fetchAll();
  };



  const STORE_ENDPOINT = `${API_BASE_URL}/metrics/`;
  const ALL_ENDPOINT = `${API_BASE_URL}/metrics/all/`;

  const METRIC_OPTIONS = [
    "deployment_frequency",
    "change_delivery_time",
    "service_recovery_time",
    "change_failure_rate",
  ];

  const projectDropdownRef = useRef(null);
  const metricDropdownRef = useRef(null);

  function getCSRFToken() {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrftoken="));
    return match ? match.split("=")[1] : "";
  }

  const handleCalcChange = (e) => {
    const { name, value } = e.target;
    setCalcForm((prev) => ({ ...prev, [name]: value }));
    console.log({name, value})
  };

  const toggleProject = (projValue) => {
    setFilterForm((prev) => {
      const already = prev.projects.includes(projValue);
      const nextList = already
        ? prev.projects.filter((p) => p !== projValue)
        : [...prev.projects, projValue];
      return { ...prev, projects: nextList };
    });
  };

  const toggleMetricType = (metricValue) => {
    setFilterForm((prev) => {
      const already = prev.metricTypes.includes(metricValue);
      const nextList = already
        ? prev.metricTypes.filter((m) => m !== metricValue)
        : [...prev.metricTypes, metricValue];
      return { ...prev, metricTypes: nextList };
    });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    if (name === "since" || name === "until") {
      setFilterForm((prev) => ({ ...prev, [name]: value }));
    }
  };

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

      let since_iso, until_iso;
      try {
        // Construct UTC ISO string directly from date input
        since_iso = `${since_dt}T00:00:00.000+00:00`;
        until_iso = `${until_dt}T00:00:00.000+00:00`;
        // Validate date format
        if (isNaN(Date.parse(since_iso)) || isNaN(Date.parse(until_iso))) {
          throw new Error("Invalid date format.");
        }
      } catch {
        setCalcError("Invalid date format.");
        setCalcLoading(false);
        return;
      }

      const csrftoken = getCSRFToken();

      try {
        const resp = await fetch(STORE_ENDPOINT, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken,
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
      } catch (err) {
        console.error("Error calculating metrics:", err);
        setCalcError(err.message);
      } finally {
        setCalcLoading(false);
      }
    };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (filterForm.projects.length > 0) {
      params.append("projects", filterForm.projects.join(","));
    }
    if (filterForm.metricTypes.length > 0) {
      params.append("metric_types", filterForm.metricTypes.join(","));
    }
    if (filterForm.since) {
      const sinceDate = new Date(filterForm.since);
      params.append("since", sinceDate.toISOString().replace(/Z$/, "+00:00"));
      console.log(sinceDate.toISOString().replace(/Z$/, "+00:00"))
    }
    if (filterForm.until) {
      const untilDate = new Date(filterForm.until);
      untilDate.setHours(23, 59, 59, 999);
      params.append("until", untilDate.toISOString().replace(/Z$/, "+00:00"));
      console.log(untilDate.toISOString().replace(/Z$/, "+00:00"))
    }
    return params.toString();
  };

  const fetchAll = async () => {
    setLoadingAll(true);
    setErrorAll(null);
    setAllData(null);

    try {
      const query = buildQueryParams();
      const url = query ? `${ALL_ENDPOINT}?${query}` : ALL_ENDPOINT;
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} – ${resp.statusText}`);
      const json = await resp.json();
      setAllData(json);
    } catch (err) {
      console.error("Error fetching all metrics:", err);
      setErrorAll(err.message);
    } finally {
      setLoadingAll(false);
    }
  };

  const fetchAllProjects = async () => {
    setLoadingProjects(true);
    setErrorProjects(null);
    setAllProjects([]);

    try {
      const resp = await fetch(ALL_ENDPOINT, { credentials: "include" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} – ${resp.statusText}`);
      const json = await resp.json();
      setAllProjects(json.projects || []);
    } catch (err) {
      console.error("Error fetching all projects:", err);
      setErrorProjects(err.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  const twoDigits = (num) =>
    typeof num === "number" && !isNaN(num) ? num.toFixed(2) : "—";

  useEffect(() => {
    if (view !== "list") return;
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, filterForm]);

  // Fetch all projects only when the list view is first loaded
  useEffect(() => {
    if (view === "list") {
      fetchAllProjects();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(event.target)
      ) {
        setShowProjectDropdown(false);
      }
      if (
        metricDropdownRef.current &&
        !metricDropdownRef.current.contains(event.target)
      ) {
        setShowMetricDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        !e.target.closest(".options-menu") &&
        !e.target.closest(".options-btn")
      ) {
        setOpenMenuProject(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchAll();
  };

  const handleClearFilters = () => {
    setFilterForm({
      projects: [],
      metricTypes: [],
      since: "",
      until: "",
    });
    setShowProjectDropdown(false);
    setShowMetricDropdown(false);
  };

  const showAllProjects = () => {
    setView("list");
    setSelectedProject(null);
  };

  const showCalculateForm = () => {
    setView("calculate");
    setCalcResult(null);
    setCalcError(null);
  };

  const showCompare = () => {
    setView("compare");
    setSelectedProject(null);
  };

  const showDetail = (proj) => {
    setSelectedProject(proj);
    setView("detail");
  };

  const onExportData = (proj) => {
    const url = `${API_BASE_URL}/metrics/projects/${proj.id}/export/`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${proj.owner}-${proj.repository}-metrics.csv`);
    link.click();
  };


  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <button
          className={view === "list" ? "active" : ""}
          onClick={showAllProjects}
        >
          All Projects
        </button>
        <button
          className={view === "calculate" ? "active" : ""}
          onClick={showCalculateForm}
        >
          Calculate New Metrics
        </button>
        <button
          className={view === "compare" ? "active" : ""}
          onClick={showCompare}
        >
          Compare Projects
        </button>
      </aside>

      <main className="main-content">
        {view === "list" && (
          <>
            <h2 className="dashboard-title">All Projects Metrics</h2>
            <form className="filter-form" onSubmit={handleApplyFilters}>
              <div className="filter-row">
                <div className="multiselect-container" ref={projectDropdownRef}>
                  <label>Projects:</label>
                  <div
                    className="multiselect-header"
                    onClick={() => setShowProjectDropdown((prev) => !prev)}
                  >
                    {filterForm.projects.length === 0
                      ? "Select projects…"
                      : filterForm.projects.map((proj) => (
                          <span key={proj} className="tag">
                            {proj}
                            <button
                              type="button"
                              className="remove-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProject(proj);
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    <span className="dropdown-arrow">
                      {showProjectDropdown ? "▴" : "▾"}
                    </span>
                  </div>
                  {showProjectDropdown && (
                    <div className="options-dropdown">
                      {loadingProjects ? (
                        <div className="option-item disabled">Loading projects…</div>
                      ) : errorProjects ? (
                        <div className="option-item disabled">Error loading projects</div>
                      ) : allProjects.length > 0 ? (
                        allProjects.map((proj) => {
                          const value = `${proj.owner}/${proj.repository}`;
                          const checked = filterForm.projects.includes(value);
                          return (
                            <label key={value} className="option-item">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProject(value)}
                              />
                              <span className="option-label">{value}</span>
                            </label>
                          );
                        })
                      ) : (
                        <div className="option-item disabled">
                          No projects available
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="multiselect-container" ref={metricDropdownRef}>
                  <label>Metric Types:</label>
                  <div
                    className="multiselect-header"
                    onClick={() => setShowMetricDropdown((prev) => !prev)}
                  >
                    {filterForm.metricTypes.length === 0
                      ? "Select metrics…"
                      : filterForm.metricTypes.map((mt) => (
                          <span key={mt} className="tag">
                            {mt.replace(/_/g, " ")}
                            <button
                              type="button"
                              className="remove-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMetricType(mt);
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    <span className="dropdown-arrow">
                      {showMetricDropdown ? "▴" : "▾"}
                    </span>
                  </div>
                  {showMetricDropdown && (
                    <div className="options-dropdown">
                      {METRIC_OPTIONS.map((mt) => {
                        const checked = filterForm.metricTypes.includes(mt);
                        return (
                          <label key={mt} className="option-item">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMetricType(mt)}
                            />
                            <span className="option-label">
                              {mt.replace(/_/g, " ")}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <label>
                  Since:
                  <input
                    type="date"
                    name="since"
                    value={filterForm.since}
                    onChange={handleFilterChange}
                  />
                </label>
                <label>
                  Until:
                  <input
                    type="date"
                    name="until"
                    value={filterForm.until}
                    onChange={handleFilterChange}
                  />
                </label>

                <div className="filter-buttons">
                  <button type="submit">Apply Filters</button>
                  <button type="button" onClick={handleClearFilters}>
                    Clear Filters
                  </button>
                </div>
              </div>
            </form>
            {loadingAll && <div className="loading">Loading all metrics…</div>}
            {errorAll && <div className="error">Error: {errorAll}</div>}
            {allData && allData.projects.length === 0 && (
              <div className="no-metrics">No projects found in the database.</div>
            )}
            {allData &&
              allData.projects.map((proj) => {
                const { owner, repository, metrics } = proj;
                return (
                  <div
                    className="project-panel"
                    key={`${owner}/${repository}`}
                  >
                    <button
                      className="options-btn"
                      onClick={() => openOptions(`${owner}/${repository}`)}
                    >⋯</button>

                    {openMenuProject === `${owner}/${repository}` && (
                      <div className="options-menu">
                        <button onClick={() => onDeleteProject(proj)}>Delete Project</button>
                        <button onClick={() => onDeleteMetrics(proj)}>Delete Metrics</button>
                        <button onClick={() => onExportData(proj)}>Export Data</button>
                      </div>
                    )}
                    <button
                      className="project-title-button"
                      onClick={() => showDetail({ owner, repository })}
                    >
                      {owner}/{repository}
                    </button>
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
                                {m.variance !== null
                                  ? twoDigits(m.variance)
                                  : "—"}
                              </td>
                              <td>
                                {new Date(m.since).toLocaleString("en-GB", {
                                  hour12: false,
                                  timeZone: 'UTC'
                                })}
                              </td>
                              <td>
                                {new Date(m.until).toLocaleString("en-GB", {
                                  hour12: false,
                                  timeZone: 'UTC'
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  
                );
              })}
          </>
        )}
        {view === "detail" && selectedProject && (
          <div>
            <button className="back-button" onClick={showAllProjects}>
              ← Back to all projects
            </button>
            <ProjectDetail
              owner={selectedProject.owner}
              repository={selectedProject.repository}
            />
          </div>
        )}
        {view === "calculate" && (
          <div className="calc-view">
            <h2>Calculate New Metrics</h2>
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
                  type="date"
                  name="since_dt"
                  value={calcForm.since_dt}
                  onChange={handleCalcChange}
                />
              </label>
              <label>
                Until:
                <input
                  type="date"
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
            {calcResult && (
              <div className="calc-results">
                <h3>
                  Results for {calcForm.owner}/{calcForm.repository}
                </h3>
                <div className="cards-grid">
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
        )}
        {view === "compare" && (
          <div>
            <CompareMetrics />
          </div>
        )}
      </main>
    {modalOpen && (
      <div className="modal-overlay" onClick={() => setModalOpen(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>
            {modalType === "deleteProject"
              ? `Delete ${modalProject.owner}/${modalProject.repository}?`
              : `Delete metrics for ${modalProject.owner}/${modalProject.repository}?`}
          </h3>

          <div className="modal-body">
            {modalType === "deleteProject" ? (
              <p>
                After deleting this project, <strong>all related metrics</strong> will be deleted!
              </p>
            ) : (
              <>
                <label>
                  Since: <input type="date" value={modalSince}
                    onChange={e => setModalSince(e.target.value)} />
                </label>
                <label>
                  Until: <input type="date" value={modalUntil}
                    onChange={e => setModalUntil(e.target.value)} />
                </label>
                <p>
                  All metrics
                  {modalSince && ` since ${modalSince}`}
                  {modalUntil && ` until ${modalUntil}`}
                  {(!modalSince && !modalUntil) ? " (all time)" : ""}
                  {" "}will be deleted.
                </p>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button onClick={() => setModalOpen(false)}>Cancel</button>
            <button
              className="danger"
              onClick={
                modalType === "deleteProject"
                  ? confirmDeleteProject
                  : confirmDeleteMetrics
              }
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}