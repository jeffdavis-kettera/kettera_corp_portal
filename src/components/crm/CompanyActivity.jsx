// Activity tab body — full activity log for a company.
//
// Rendered inside CompanyPageShell's <Outlet />. Consumes the
// loaded company via useOutletContext. Same ?contactId= filter
// pattern as CompanyOpportunities — when set, shows only that
// contact's activity with a Clear filter link.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';

const PAGE_SIZE = 50;
const TYPES = ['Call', 'Email', 'Meeting', 'Note', 'Other'];

const TYPE_BADGE = {
  Call:    'role-badge role-badge--basic',
  Email:   'role-badge role-badge--basic',
  Meeting: 'role-badge role-badge--admin',
  Note:    'role-badge role-badge--basic',
  Other:   'role-badge role-badge--basic',
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return String(iso).slice(0, 10); }
}

export default function CompanyActivity() {
  const { company } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const contactIdParam = searchParams.get('contactId');
  const contactId = contactIdParam ? Number(contactIdParam) : null;

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [type, setType] = useState('');
  const [offset, setOffset] = useState(0);

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterContact, setFilterContact] = useState(null);
  useEffect(() => {
    if (!contactId) { setFilterContact(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const c = await authenticatedFetchJson(
          `${API_BASE_URL}/crm/companies/${company.id}/contacts/${contactId}`
        );
        if (!cancelled) setFilterContact(c);
      } catch { /* leave null */ }
    })();
    return () => { cancelled = true; };
  }, [company.id, contactId]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setOffset(0); }, [type]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (contactId) params.set('contactId', contactId);
      if (debouncedQ) params.set('q', debouncedQ);
      if (type) params.set('type', type);
      params.set('limit', PAGE_SIZE);
      params.set('offset', offset);
      const data = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${company.id}/activities?${params.toString()}`
      );
      setActivities(data.activities || []);
    } catch (err) {
      setError(err.message || 'Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, [company.id, contactId, debouncedQ, type, offset]);
  useEffect(() => { load(); }, [load]);

  const hasNextPage = activities.length === PAGE_SIZE;
  const hasPrevPage = offset > 0;

  function clearContactFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('contactId');
    setSearchParams(next);
  }

  const logNewUrl = contactId
    ? `/modules/crm/companies/${company.id}/activities/new?contactId=${contactId}`
    : `/modules/crm/companies/${company.id}/activities/new`;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Activity</h2>
        <button type="button" className="btn-primary" onClick={() => navigate(logNewUrl)}>
          Log Activity
        </button>
      </div>

      {contactId && filterContact && (
        <div className="info-banner" role="note" style={{ marginBottom: 'var(--space-4)' }}>
          Filtered to activity for <strong>{[filterContact.firstName, filterContact.lastName].filter(Boolean).join(' ') || filterContact.email}</strong>.
          Company-level activity is not shown.
          {' '}
          <button type="button" className="link-button" onClick={clearContactFilter}>
            Show all activity
          </button>
        </div>
      )}

      <div className="filter-bar" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search subject, body, type…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="filter-input"
          aria-label="Search activity"
          style={{ maxWidth: 320, marginBottom: 0 }}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Filter by type"
          style={{ width: 'auto', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
        >
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading activity" />
      ) : activities.length === 0 ? (
        <div className="no-users">
          {debouncedQ || type || contactId
            ? 'No activity matches those filters.'
            : 'No activity logged yet. Click Log Activity to record the first.'}
        </div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>When</th>
                <th style={{ width: '110px' }}>Type</th>
                <th>Subject</th>
                {!contactId && <th style={{ width: '180px' }}>Contact</th>}
                <th style={{ width: '160px' }}>Logged by</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}
                    onClick={() => navigate(`/modules/crm/companies/${company.id}/activities/${a.id}`)}
                    className="data-table__row-clickable">
                  <td className="muted">{formatDate(a.occurredAt)}</td>
                  <td>
                    <span className={TYPE_BADGE[a.activityType] || 'role-badge role-badge--basic'}>
                      {a.activityType}
                    </span>
                  </td>
                  <td><strong>{a.subject}</strong></td>
                  {!contactId && (
                    <td className="muted">
                      {a.contactName || <span className="muted">Company-level</span>}
                    </td>
                  )}
                  <td className="muted">{a.createdByName || a.createdByEmail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(hasPrevPage || hasNextPage) && (
        <div className="pagination">
          <button type="button" className="cancel-button" disabled={!hasPrevPage}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>← Previous</button>
          <span className="pagination__label">Showing {offset + 1}–{offset + activities.length}</span>
          <button type="button" className="cancel-button" disabled={!hasNextPage}
                  onClick={() => setOffset(offset + PAGE_SIZE)}>Next →</button>
        </div>
      )}
    </>
  );
}
