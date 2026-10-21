// Assessments tab — every assessment, which sets it has and which
// tools show it. Row click → editor.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson } from '../../../utils/api.js';
import { CONFIG_BASE } from './paths.js';

export default function AssessmentsList() {
  const navigate = useNavigate();
  const [data, setData] = useState({ assessments: [], availableTools: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await authenticatedFetchJson(`${API_BASE_URL}/crm/config/assessments`);
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load assessments.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toolTitle = Object.fromEntries(data.availableTools.map((t) => [t.key, t.title]));

  return (
    <>
      <div className="config-list-head">
        <div>
          <h2 style={{ margin: 0 }}>Assessments</h2>
          <p className="muted" style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>
            An assessment is an ordered list of question sets. Tools show one or more assessments.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate(`${CONFIG_BASE}/new`)}>Add Assessment</button>
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading assessments" />
      ) : data.assessments.length === 0 ? (
        <div className="no-users">No assessments yet.</div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Key</th>
                <th style={{ textAlign: 'right' }}>Sets</th>
                <th>Shown in</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.assessments.map((a) => (
                <tr key={a.id} className="data-table__row-clickable" onClick={() => navigate(`${CONFIG_BASE}/${a.id}`)}>
                  <td><strong>{a.title}</strong>{a.description && <div className="muted" style={{ fontSize: 'var(--font-size-xs)' }}>{a.description}</div>}</td>
                  <td className="muted"><code>{a.key}</code></td>
                  <td style={{ textAlign: 'right' }}>{a.setCount}</td>
                  <td className={a.tools.length ? undefined : 'muted'}>{a.tools.length ? a.tools.map((k) => toolTitle[k] || k).join(', ') : '—'}</td>
                  <td><span className={`status-badge status-badge--${a.retired ? 'suspended' : 'active'}`}>{a.retired ? 'Retired' : 'Active'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
