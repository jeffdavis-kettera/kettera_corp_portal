// Questions tab — the question bank with search and filters. Row
// click → editor.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson } from '../../../utils/api.js';
import { CONFIG_BASE, QUESTION_TYPES, TYPE_LABEL } from './paths.js';

export default function QuestionsList() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [scope, setScope] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('active');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedQ) params.set('q', debouncedQ);
        if (scope) params.set('scope', scope);
        if (type) params.set('type', type);
        if (status) params.set('status', status);
        const d = await authenticatedFetchJson(`${API_BASE_URL}/crm/config/questions?${params.toString()}`);
        if (!cancelled) setQuestions(d.questions || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load questions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQ, scope, type, status]);

  return (
    <>
      <div className="config-list-head">
        <div>
          <h2 style={{ margin: 0 }}>Questions</h2>
          <p className="muted" style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>
            The bank every assessment draws from. A question has one answer per opportunity (or per company), however many sets show it.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate(`${CONFIG_BASE}/questions/new`)}>Add Question</button>
      </div>

      <div className="filter-bar filter-bar--row">
        <input type="search" className="filter-input" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Search label or key…" aria-label="Search questions" />
        <select className="filter-input" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Filter by scope">
          <option value="">All scopes</option>
          <option value="opportunity">Opportunity</option>
          <option value="company">Company</option>
        </select>
        <select className="filter-input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="filter-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="active">Active</option>
          <option value="retired">Retired</option>
          <option value="">All</option>
        </select>
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading questions" />
      ) : questions.length === 0 ? (
        <div className="no-users">No questions match.</div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Type</th>
                <th>Scope</th>
                <th style={{ textAlign: 'right' }}>In sets</th>
                <th style={{ textAlign: 'right' }}>Answers</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((x) => (
                <tr key={x.id} className="data-table__row-clickable" onClick={() => navigate(`${CONFIG_BASE}/questions/${x.id}`)}>
                  <td><strong>{x.label}</strong><div className="muted" style={{ fontSize: 'var(--font-size-xs)' }}><code>{x.key}</code></div></td>
                  <td className="muted">{TYPE_LABEL[x.type] || x.type}</td>
                  <td className="muted">{x.scope === 'company' ? 'Company' : 'Opportunity'}</td>
                  <td style={{ textAlign: 'right' }} className={x.setCount ? undefined : 'muted'}>{x.setCount}</td>
                  <td style={{ textAlign: 'right' }} className={x.answerCount ? undefined : 'muted'}>{x.answerCount}</td>
                  <td><span className={`status-badge status-badge--${x.retired ? 'suspended' : 'active'}`}>{x.retired ? 'Retired' : 'Active'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
