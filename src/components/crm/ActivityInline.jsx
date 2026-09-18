// Reusable "recent activity" preview embedded on Company Detail
// and Contact Detail pages. Shows the newest 5 items (rollup or
// contact-scoped based on props), with links to log new activity
// and to the full activity page.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';

const PREVIEW_LIMIT = 5;

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

export default function ActivityInline({ companyId, contactId = null, heading = 'Recent Activity' }) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', PREVIEW_LIMIT);
      params.set('offset', 0);
      if (contactId) params.set('contactId', contactId);
      const data = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/activities?${params.toString()}`
      );
      setActivities(data.activities || []);
    } catch (err) {
      setError(err.message || 'Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, [companyId, contactId]);

  useEffect(() => { load(); }, [load]);

  // Routes for the buttons — differ for company vs contact context.
  const viewAllUrl = contactId
    ? `/modules/crm/companies/${companyId}/activities?contactId=${contactId}`
    : `/modules/crm/companies/${companyId}/activities`;

  const logNewUrl = contactId
    ? `/modules/crm/companies/${companyId}/activities/new?contactId=${contactId}`
    : `/modules/crm/companies/${companyId}/activities/new`;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: 'var(--space-6) 0 var(--space-3)' }}>
        <h3 style={{ margin: 0 }}>{heading}</h3>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button type="button" className="cancel-button" onClick={() => navigate(viewAllUrl)}>
            View all
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate(logNewUrl)}>
            Log Activity
          </button>
        </div>
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading activity" />
      ) : activities.length === 0 ? (
        <div className="no-users">
          No activity logged yet. Click Log Activity to record the first.
        </div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>When</th>
                <th style={{ width: '110px' }}>Type</th>
                <th>Subject</th>
                {!contactId && <th style={{ width: '160px' }}>Contact</th>}
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}
                    onClick={() => navigate(`/modules/crm/companies/${companyId}/activities/${a.id}`)}
                    className="data-table__row-clickable">
                  <td className="muted">{formatDate(a.occurredAt)}</td>
                  <td>
                    <span className={TYPE_BADGE[a.activityType] || 'role-badge role-badge--basic'}>
                      {a.activityType}
                    </span>
                  </td>
                  <td><strong>{a.subject}</strong></td>
                  {!contactId && (
                    <td className="muted">{a.contactName || <span className="muted">Company-level</span>}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
