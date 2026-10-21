// Question sets tab — every reusable set, how many questions it has
// and which assessments use it. Row click → editor.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson } from '../../../utils/api.js';
import { CONFIG_BASE } from './paths.js';

export default function QuestionSetsList() {
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await authenticatedFetchJson(`${API_BASE_URL}/crm/config/question-sets`);
        if (!cancelled) setSets(d.sets || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load question sets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <div className="config-list-head">
        <div>
          <h2 style={{ margin: 0 }}>Question sets</h2>
          <p className="muted" style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>
            A reusable, ordered group of questions. The same set can appear in several assessments.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate(`${CONFIG_BASE}/sets/new`)}>Add Question Set</button>
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading question sets" />
      ) : sets.length === 0 ? (
        <div className="no-users">No question sets yet.</div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th style={{ textAlign: 'right' }}>Questions</th>
                <th>Used by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s) => (
                <tr key={s.id} className="data-table__row-clickable" onClick={() => navigate(`${CONFIG_BASE}/sets/${s.id}`)}>
                  <td><strong>{s.name}</strong>{s.description && <div className="muted" style={{ fontSize: 'var(--font-size-xs)' }}>{s.description}</div>}</td>
                  <td className="muted"><code>{s.key}</code></td>
                  <td style={{ textAlign: 'right' }}>{s.questionCount}</td>
                  <td className={s.usedBy.length ? undefined : 'muted'}>{s.usedBy.length ? s.usedBy.join(', ') : '—'}</td>
                  <td><span className={`status-badge status-badge--${s.retired ? 'suspended' : 'active'}`}>{s.retired ? 'Retired' : 'Active'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
