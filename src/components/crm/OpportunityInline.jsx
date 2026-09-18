// Reusable "Opportunities" preview embedded on Company Detail and
// Contact Detail. Mirrors ActivityInline's shape.
//
// Modes:
//   companyId only            → all opportunities for the company
//   companyId + contactId     → deals where this contact is the
//                               primary contact

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import {
  STAGE_BADGE_CLASS, formatCurrency, formatDate,
} from './opportunityStages.js';

const PREVIEW_LIMIT = 5;

export default function OpportunityInline({ companyId, contactId = null, heading = 'Opportunities' }) {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState([]);
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
        `${API_BASE_URL}/crm/companies/${companyId}/opportunities?${params.toString()}`
      );
      setOpportunities(data.opportunities || []);
    } catch (err) {
      setError(err.message || 'Failed to load opportunities.');
    } finally {
      setLoading(false);
    }
  }, [companyId, contactId]);

  useEffect(() => { load(); }, [load]);

  const viewAllUrl = contactId
    ? `/modules/crm/companies/${companyId}/opportunities?contactId=${contactId}`
    : `/modules/crm/companies/${companyId}/opportunities`;

  const logNewUrl = contactId
    ? `/modules/crm/companies/${companyId}/opportunities/new?contactId=${contactId}`
    : `/modules/crm/companies/${companyId}/opportunities/new`;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: 'var(--space-6) 0 var(--space-3)' }}>
        <h3 style={{ margin: 0 }}>{heading}</h3>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button type="button" className="cancel-button" onClick={() => navigate(viewAllUrl)}>
            View all
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate(logNewUrl)}>
            Add Opportunity
          </button>
        </div>
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading opportunities" />
      ) : opportunities.length === 0 ? (
        <div className="no-users">
          {contactId
            ? 'No opportunities where this contact is primary. Click Add Opportunity to create one.'
            : 'No opportunities yet. Click Add Opportunity to create the first.'}
        </div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: '130px' }}>Stage</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Value</th>
                <th style={{ width: '130px' }}>Expected close</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id}
                    onClick={() => navigate(`/modules/crm/companies/${companyId}/opportunities/${o.id}`)}
                    className="data-table__row-clickable">
                  <td><strong>{o.name}</strong></td>
                  <td>
                    <span className={STAGE_BADGE_CLASS[o.stage] || 'stage-badge stage-badge--lead'}>
                      {o.stage}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {o.value == null ? <span className="muted">—</span> : formatCurrency(o.value, o.currency)}
                  </td>
                  <td className="muted">{formatDate(o.expectedCloseDate) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
