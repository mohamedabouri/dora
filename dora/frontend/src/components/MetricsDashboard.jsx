import React, { useState, useEffect, useRef } from "react";
import CompareMetrics from "./CompareMetrics";
import ProjectDetail from "./ProjectDetail";
import { API_BASE_URL } from "../config";
import "../styles/MetricsDashboard.css";

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

  const [filterForm, setFilterForm] = useState({
    projects: [],
    metricTypes: [],
    since: "",
    until: "",
  });
  const [allData, setAllData] = useState(null);
  const [loadingAll, setLoadingAll] = useState(true);
  const [errorAll, setErrorAll] = useState(null);

  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showMetricDropdown, setShowMetricDropdown] = useState(false);

  const [allProjects, setAllProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [errorProjects, setErrorProjects] = useState(null);

  const [openMenuProject, setOpenMenuProject] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalProject, setModalProject] = useState(null);
  const [modalSince, setModalSince] = useState("");
  const [modalUntil, setModalUntil] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const projectDropdownRef = useRef(null);
  const metricDropdownRef = useRef(null);

  const METRIC_OPTIONS = [
    "release_frequency",
    "lead_time_for_released_changes",
    "time_to_repair_code",
    "bug_issues_rate",
  ];

  // Utility: format number or dash
  const twoDigits = (num) =>
    typeof num === "number" && !isNaN(num) ? num.toFixed(2) : "—";

  // CSRF helper
  function getCSRFToken() {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrftoken="));
    return match ? match.split("=")[1] : "";
  }

  /* ─── Data Fetchers ────────────────────────────────────────────────────────── */

  // Fetch all metrics (list view)
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (filterForm.projects.length)
      params.append("projects", filterForm.projects.join(","));
    if (filterForm.metricTypes.length)
      params.append("metric_types", filterForm.metricTypes.join(","));
    if (filterForm.since)
      params.append(
        "since",
        new Date(filterForm.since).toISOString().replace(/Z$/, "+00:00")
      );
    if (filterForm.until) {
      const untilDate = new Date(filterForm.until);
      untilDate.setHours(23, 59, 59, 999);
      params.append("until", untilDate.toISOString().replace(/Z$/, "+00:00"));
    }
    return params.toString();
  };

  const fetchAll = async () => {
    setLoadingAll(true);
    setErrorAll(null);
    try {
      const query = buildQueryParams();
      const url = query
        ? `${API_BASE_URL}/metrics/all/?${query}`
        : `${API_BASE_URL}/metrics/all/`;
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) throw new Error(resp.statusText);
      const json = await resp.json();
      setAllData(json);
    } catch (err) {
      setErrorAll(err.message);
    } finally {
      setLoadingAll(false);
    }
  };

  const fetchAllProjects = async () => {
    setLoadingProjects(true);
    setErrorProjects(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/metrics/all/`, {
        credentials: "include",
      });
      if (!resp.ok) throw new Error(resp.statusText);
      const json = await resp.json();
      setAllProjects(json.projects || []);
    } catch (err) {
      setErrorProjects(err.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (view === "list") {
      fetchAll();
      fetchAllProjects();
    }
  }, [view, filterForm]);

  /* ─── Sidebar Navigation ─────────────────────────────────────────────────── */

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
  };
  const showDetail = (proj) => {
    setSelectedProject(proj);
    setView("detail");
  };

  /* ─── Calculation Form ───────────────────────────────────────────────────── */

  const handleCalcChange = (e) =>
    setCalcForm((p) => ({ ...p, [e.target.name]: e.target.value }));

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

    const since_iso = `${since_dt}T00:00:00.000+00:00`;
    const until_iso = `${until_dt}T00:00:00.000+00:00`;

    try {
      const resp = await fetch(`${API_BASE_URL}/metrics/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
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
        throw new Error(errJson?.error || resp.status);
      }
      setCalcResult(await resp.json());
    } catch (err) {
      setCalcError(err.message);
    } finally {
      setCalcLoading(false);
    }
  };

  /* ─── Filter Form ────────────────────────────────────────────────────────── */

  const toggleProject = (proj) =>
    setFilterForm((p) => {
      const has = p.projects.includes(proj);
      const next = has
        ? p.projects.filter((x) => x !== proj)
        : [...p.projects, proj];
      return { ...p, projects: next };
    });

  const toggleMetricType = (mt) =>
    setFilterForm((p) => {
      const has = p.metricTypes.includes(mt);
      const next = has
        ? p.metricTypes.filter((x) => x !== mt)
        : [...p.metricTypes, mt];
      return { ...p, metricTypes: next };
    });

  const handleFilterChange = (e) =>
    setFilterForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleClearFilters = () =>
    setFilterForm({ projects: [], metricTypes: [], since: "", until: "" });

  /* ─── Delete Modals ───────────────────────────────────────────────────────── */

  const openOptions = (key) => setOpenMenuProject(key);
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

  const confirmDeleteProject = async () => {
    await fetch(
      `${API_BASE_URL}/metrics/projects/${modalProject.id}/delete/`,
      {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRFToken": getCSRFToken() },
      }
    );
    setModalOpen(false);
    fetchAll();
    fetchAllProjects();
  };

  const confirmDeleteMetrics = async () => {
    const params = new URLSearchParams();
    params.append(
      "projects",
      `${modalProject.owner}/${modalProject.repository}`
    );
    if (modalSince)
      params.append(
        "since",
        new Date(modalSince).toISOString().replace(/Z$/, "+00:00")
      );
    if (modalUntil) {
      const u = new Date(modalUntil);
      u.setHours(23, 59, 59, 999);
      params.append("until", u.toISOString().replace(/Z$/, "+00:00"));
    }
    await fetch(`${API_BASE_URL}/metrics/delete/?${params}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRFToken": getCSRFToken() },
    });
    setModalOpen(false);
    fetchAll();
  };

  /* ─── Outside Click Handlers ─────────────────────────────────────────────── */

  useEffect(() => {
    const handler = (e) => {
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(e.target)
      ) {
        setShowProjectDropdown(false);
      }
      if (
        metricDropdownRef.current &&
        !metricDropdownRef.current.contains(e.target)
      ) {
        setShowMetricDropdown(false);
      }
      if (
        !e.target.closest(".options-menu") &&
        !e.target.closest(".options-btn")
      ) {
        closeOptions();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ─── Render ──────────────────────────────────────────────────────────────── */

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? "w-64" : "sidebar-collapsed"} md:w-64`}
      >
        {/* Mobile toggle */}
        <button
          className="md:hidden mb-4 p-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg
            className="w-6 h-6 text-neutral-600 dark:text-neutral-100"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d={
                sidebarOpen
                  ? "M6 18L18 6M6 6l12 12"
                  : "M4 6h16M4 12h16M4 18h16"
              }
            />
          </svg>
        </button>

        {/* Nav buttons */}
        <button
          className={`nav-button ${
            view === "list" ? "nav-active" : ""
          }`}
          onClick={showAllProjects}
          aria-current={view === "list" ? "page" : undefined}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 7h18M3 12h18m-7 5h7"
            />
          </svg>
          <span>All Projects</span>
        </button>

        <button
          className={`nav-button ${
            view === "calculate" ? "nav-active" : ""
          }`}
          onClick={showCalculateForm}
          aria-current={view === "calculate" ? "page" : undefined}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>Calculate Metrics</span>
        </button>

        <button
          className={`nav-button ${
            view === "compare" ? "nav-active" : ""
          }`}
          onClick={showCompare}
          aria-current={view === "compare" ? "page" : undefined}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 19V5l7 7-7 7z"
            />
          </svg>
          <span>Compare Projects</span>
        </button>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-16"
        } md:ml-64`}
      >
        {view === "list" && (
          <>
            <h2 className="text-3xl font-heading font-bold text-neutral-800 dark:text-neutral-100 mb-6">
              All Projects Metrics
            </h2>

            {/* Filters */}
            <form className="card mb-6 relative z-50" onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-wrap gap-4 items-end">
                {/* Projects Multiselect */}
                <div
                  className="relative flex flex-col w-full sm:w-64 text-sm text-neutral-600 dark:text-neutral-300"
                  ref={projectDropdownRef}
                >
                  <label className="mb-1 font-medium">Projects</label>
                  <div
                    className="input flex flex-wrap items-center min-h-[40px] cursor-pointer"
                    onClick={() =>
                      setShowProjectDropdown((p) => !p)
                    }
                    role="combobox"
                    aria-expanded={showProjectDropdown}
                    aria-haspopup="listbox"
                  >
                    {filterForm.projects.length === 0 ? (
                      <span className="text-neutral-400">
                        Select projects…
                      </span>
                    ) : (
                      filterForm.projects.map((proj) => (
                        <span
                          key={proj}
                          className="flex items-center bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 rounded-full px-2 py-1 m-1 text-xs"
                        >
                          {proj}
                          <button
                            type="button"
                            className="ml-1 text-neutral-600 dark:text-neutral-300 hover:text-error"
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
                    <span className="ml-auto text-xs text-neutral-600 dark:text-neutral-300">
                      {showProjectDropdown ? "▴" : "▾"}
                    </span>
                  </div>
                  {showProjectDropdown && (
                    <div className="dropdown-menu z-50" role="listbox">
                      {loadingProjects ? (
                        <div className="dropdown-item text-neutral-400 cursor-not-allowed">
                          Loading…
                        </div>
                      ) : errorProjects ? (
                        <div className="dropdown-item text-neutral-400 cursor-not-allowed">
                          Error loading projects
                        </div>
                      ) : allProjects.length ? (
                        allProjects.map((p) => {
                          const val = `${p.owner}/${p.repository}`;
                          const checked = filterForm.projects.includes(val);
                          return (
                            <label key={val} className="dropdown-item">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProject(val)}
                                className="mr-2 accent-primary"
                              />
                              <span className="flex-1">{val}</span>
                            </label>
                          );
                        })
                      ) : (
                        <div className="dropdown-item text-neutral-400 cursor-not-allowed">
                          No projects
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Metric Types Multiselect */}
                <div
                  className="relative flex flex-col w-full sm:w-64 text-sm text-neutral-600 dark:text-neutral-300"
                  ref={metricDropdownRef}
                >
                  <label className="mb-1 font-medium">Metric Types</label>
                  <div
                    className="input flex flex-wrap items-center min-h-[40px] cursor-pointer"
                    onClick={() =>
                      setShowMetricDropdown((p) => !p)
                    }
                    role="combobox"
                    aria-expanded={showMetricDropdown}
                    aria-haspopup="listbox"
                  >
                    {filterForm.metricTypes.length === 0 ? (
                      <span className="text-neutral-400">
                        Select metrics…
                      </span>
                    ) : (
                      filterForm.metricTypes.map((mt) => (
                        <span
                          key={mt}
                          className="flex items-center bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 rounded-full px-2 py-1 m-1 text-xs"
                        >
                          {mt.replace(/_/g, " ")}
                          <button
                            type="button"
                            className="ml-1 text-neutral-600 dark:text-neutral-300 hover:text-error"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMetricType(mt);
                            }}
                            aria-label={`Remove ${mt}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                    <span className="ml-auto text-xs text-neutral-600 dark:text-neutral-300">
                      {showMetricDropdown ? "▴" : "▾"}
                    </span>
                  </div>
                  {showMetricDropdown && (
                    <div className="dropdown-menu" role="listbox">
                      {METRIC_OPTIONS.map((mt) => {
                        const checked = filterForm.metricTypes.includes(mt);
                        return (
                          <label key={mt} className="dropdown-item">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMetricType(mt)}
                              className="mr-2 accent-primary"
                            />
                            <span className="flex-1">
                              {mt.replace(/_/g, " ")}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Date Filters */}
                <label className="flex flex-col text-sm text-neutral-600 dark:text-neutral-300">
                  <span className="mb-1 font-medium">Since</span>
                  <input
                    type="date"
                    name="since"
                    value={filterForm.since}
                    onChange={handleFilterChange}
                    className="input w-40 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700 dark:placeholder-neutral-500"
                  />
                </label>
                <label className="flex flex-col text-sm text-neutral-600 dark:text-neutral-300">
                  <span className="mb-1 font-medium">Until</span>
                  <input
                    type="date"
                    name="until"
                    value={filterForm.until}
                    onChange={handleFilterChange}
                    className="input w-40 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700 dark:placeholder-neutral-500"
                  />
                </label>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fetchAll}
                    className="btn btn-primary"
                  >
                    Apply Filters
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="btn btn-error"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </form>

            {/* List Content */}
            {loadingAll ? (
              <div className="mt-6 flex justify-center">
                <div className="spinner" role="status">
                  <span className="sr-only">Loading metrics…</span>
                </div>
              </div>
            ) : errorAll ? (
              <div className="mt-6 text-base text-error">
                Error: {errorAll}
              </div>
            ) : allData && !allData.projects.length ? (
              <p className="mt-6 text-neutral-600 dark:text-neutral-300">
                No projects found.
              </p>
            ) : (
              allData.projects.map((proj) => {
                const { owner, repository, metrics } = proj;
                const key = `${owner}/${repository}`;
                return (
                  <div
                    key={key}
                    className="card mb-6 relative group"
                  >
                    {/* Options menu toggle */}
                    <button
                      className="btn btn-secondary absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity options-btn"
                      onClick={() => openOptions(key)}
                      aria-label="Project options"
                    >
                      ⋯
                    </button>
                    {openMenuProject === key && (
                      <div className="absolute top-12 right-4 z-20 card options-menu">
                        <button
                          onClick={() => onDeleteProject(proj)}
                          className="dropdown-item w-full text-left"
                        >
                          Delete Project
                        </button>
                        <button
                          onClick={() => onDeleteMetrics(proj)}
                          className="dropdown-item w-full text-left"
                        >
                          Delete Metrics
                        </button>
                        <button
                          onClick={() =>
                            window.open(
                              `${API_BASE_URL}/metrics/projects/${proj.id}/export/`,
                              "_blank"
                            )
                          }
                          className="dropdown-item w-full text-left"
                        >
                          Export CSV
                        </button>
                      </div>
                    )}

                    {/* Project Header */}
                    <button
                      className="text-xl font-heading font-bold text-primary hover:underline mb-3"
                      onClick={() => showDetail(proj)}
                    >
                      {key}
                    </button>

                    {/* Metrics Table */}
                    {metrics.length === 0 ? (
                      <p className="text-neutral-600 dark:text-neutral-300">
                        No metrics recorded.
                      </p>
                    ) : (
                      <table className="w-full border-collapse mt-3">
                        <thead>
                          <tr>
                            {["Type", "Value", "Variance", "Since", "Until"].map(
                              (h) => (
                                <th
                                  key={h}
                                  className="border border-neutral-200 dark:border-neutral-700 p-3 text-sm text-left bg-neutral-50 dark:bg-neutral-800 font-semibold text-neutral-800 dark:text-neutral-100"
                                >
                                  {h}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.map((m) => (
                            <tr key={m.id}>
                              <td className="border border-neutral-200 dark:border-neutral-700 p-3 text-sm text-neutral-600 dark:text-neutral-300">
                                {m.metric_type.replace(/_/g, " ")}
                              </td>
                              <td className="border border-neutral-200 dark:border-neutral-700 p-3 text-sm text-neutral-600 dark:text-neutral-300">
                                {twoDigits(m.value)}
                              </td>
                              <td className="border border-neutral-200 dark:border-neutral-700 p-3 text-sm text-neutral-600 dark:text-neutral-300">
                                {m.variance != null
                                  ? twoDigits(m.variance)
                                  : "—"}
                              </td>
                              <td className="border border-neutral-200 dark:border-neutral-700 p-3 text-sm text-neutral-600 dark:text-neutral-300">
                                {new Date(m.since).toLocaleString("en-GB", {
                                  hour12: false,
                                  timeZone: "UTC",
                                })}
                              </td>
                              <td className="border border-neutral-200 dark:border-neutral-700 p-3 text-sm text-neutral-600 dark:text-neutral-300">
                                {new Date(m.until).toLocaleString("en-GB", {
                                  hour12: false,
                                  timeZone: "UTC",
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {view === "detail" && selectedProject && (
          <>
            <button
              className="btn btn-secondary mb-6 flex items-center gap-2"
              onClick={showAllProjects}
            >
              ← Back
            </button>
            <ProjectDetail
              owner={selectedProject.owner}
              repository={selectedProject.repository}
            />
          </>
        )}

        {view === "calculate" && (
          <>
            <h2 className="text-3xl font-heading font-bold text-neutral-800 dark:text-neutral-100 mb-6">
              Calculate New Metrics
            </h2>
            <form className="card" onSubmit={handleCalculate}>
              {["owner", "repository", "since_dt", "until_dt", "bug_label"].map(
                (field) => (
                  <label
                    key={field}
                    className="block mb-4 text-sm text-neutral-600 dark:text-neutral-300"
                  >
                    <span className="mb-1 font-medium">
                      {field
                        .replace(/_/g, " ")
                        .replace("dt", "")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                    <input
                      type={field.includes("dt") ? "date" : "text"}
                      name={field}
                      value={calcForm[field]}
                      onChange={handleCalcChange}
                      placeholder={
                        field.includes("dt") ? "" : `e.g. ${field}`
                      }
                      className="input w-full sm:w-64 ml-2 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700 dark:placeholder-neutral-500"
                    />
                  </label>
                )
              )}
              <button
                type="submit"
                disabled={calcLoading}
                className="btn btn-primary disabled:bg-neutral-500 disabled:cursor-not-allowed"
              >
                {calcLoading ? "Calculating…" : "Submit"}
              </button>
              {calcError && (
                <p className="mt-4 text-error">{calcError}</p>
              )}
            </form>
            {calcResult && (
              <div className="mt-6">
                <h3 className="text-2xl font-heading font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
                  Results for {calcForm.owner}/{calcForm.repository}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(calcResult).map(([key, val]) => (
                    <div key={key} className="card">
                      <h4 className="mb-3 text-lg font-semibold text-neutral-800 dark:text-neutral-100 capitalize">
                        {key.replace(/_/g, " ")}
                      </h4>
                      {typeof val === "object" ? (
                        Object.entries(val).map(([label, num]) => (
                          <div
                            key={label}
                            className="flex justify-between mb-2 text-sm text-neutral-600 dark:text-neutral-300"
                          >
                            <span className="font-medium text-neutral-800 dark:text-neutral-100">
                              {twoDigits(num)}
                            </span>
                            <span className="capitalize">
                              {label.replace(/_/g, " ")}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-neutral-600 dark:text-neutral-300">
                          {twoDigits(val)}
                          {key === "change_failure_rate" ? "%" : ""}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {view === "compare" && <CompareMetrics />}
      </main>

      {/* Delete Modals */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
              {modalType === "deleteProject"
                ? `Delete ${modalProject.owner}/${modalProject.repository}?`
                : `Delete metrics for ${modalProject.owner}/${modalProject.repository}?`}
            </h3>
            {modalType === "deleteProject" ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
                This will remove the project <strong>{modalProject.owner}/
                {modalProject.repository}</strong> and <strong>all </strong>
                 related metrics.
              </p>
            ) : (
              <>
                <label className="block mb-3 text-sm text-neutral-600 dark:text-neutral-300">
                  <span className="font-medium">Since</span>
                  <input
                    type="date"
                    value={modalSince}
                    onChange={(e) => setModalSince(e.target.value)}
                    className="input w-full mt-1"
                  />
                </label>
                <label className="block mb-3 text-sm text-neutral-600 dark:text-neutral-300">
                  <span className="font-medium">Until</span>
                  <input
                    type="date"
                    value={modalUntil}
                    onChange={(e) => setModalUntil(e.target.value)}
                    className="input w-full mt-1"
                  />
                </label>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
                  Metrics {modalSince && `since ${modalSince}`}{" "}
                  {modalUntil && `until ${modalUntil}`} will be deleted.
                </p>
              </>
            )}
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
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
