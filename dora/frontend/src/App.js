import React, { useState, useEffect } from "react";
import MetricsDashboard from "./components/MetricsDashboard";
import "./index.css";

function App() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setTheme(prefersDark ? "dark" : "light");
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <div className="app-container">
      <header className="mb-8 flex items-center justify-between">
        <div className="ml-4 md:ml-6 lg:ml-8 mt-4">
          <h1 className="text-4xl font-heading font-bold text-primary animate-fadeInUp">
            Metrics Dashboard
          </h1>
          <p className="mt-2 text-neutral-500 dark:text-neutral-400">
            Monitor and manage your project performance in real time
          </p>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark/light mode"
          className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary mr-1"
        >
          {theme === "dark" ? (
            // Sun icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-yellow-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-7.364l-1.414 1.414M7.05 16.95l-1.414 1.414M16.95 16.95l1.414-1.414M7.05 7.05L5.636 5.636M12 8a4 4 0 100 8 4 4 0 000-8z"
              />
            </svg>
          ) : (
            // Moon icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-neutral-800 dark:text-neutral-100"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3C10.343 3 8.822 3.324 7.5 3.917c.618 1.002.97 2.167.97 3.408a7.001 7.001 0 01-7 7c-1.241 0-2.406-.352-3.408-.97A9.002 9.002 0 0012 21a9 9 0 000-18z"
              />
            </svg>
          )}
        </button>
      </header>
      <main>
        <MetricsDashboard />
      </main>
    </div>
  );
}

export default App;
