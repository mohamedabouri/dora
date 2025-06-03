import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer
} from "recharts";
import '../styles/ProjectDetail.css';

function ProjectDetail({ owner, repository }) {
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:8000/metrics/compare/?projects=${encodeURIComponent(owner + "/" + repository)}`)
      .then(res => res.json())
      .then((data) => {
        if (data.projects && data.projects.length === 1) {
          setProjectData(data.projects[0].metrics); 
        } else {
          setProjectData(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setProjectData(null);
        setLoading(false);
      });
  }, [owner, repository]);

  if (loading) return (
    <div className="loading-spinner">
      <div className="spinner"></div>
    </div>
  );
  if (!projectData) return <div className="no-data-alert">No metrics found for this project.</div>;

  const metricTypes = Object.keys(projectData);

  return (
    <div className="project-detail-container">
      <h2>{owner}/{repository} Metrics Evolution</h2>
      {metricTypes.map((mtype) => {
        const raw = projectData[mtype].slice();
        raw.sort((a, b) => new Date(a.until) - new Date(b.until));
        const dataPoints = raw.map((pt) => ({
          date: pt.until.substring(0, 10),
          value: pt.value
        }));
        return (
          <div key={mtype} className="metric-chart">
            <h4>{mtype.replace(/_/g, " ")}</h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dataPoints}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" name={mtype} dot={true} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}

export default ProjectDetail;