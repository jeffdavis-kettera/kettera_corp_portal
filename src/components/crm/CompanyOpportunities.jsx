// /modules/crm/companies/:id/opportunities — full pipeline view.
//
// Serves two modes depending on the URL:
//   default (no ?contactId): all opportunities for the company
//   ?contactId=X:            deals where that contact is primary

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import {
  STAGES, STAGE_BADGE_CLASS, formatCurrency, formatDate,
} from './opportunityStages.js';

const PAGE_SIZE = 50;

export default function CompanyOpportunities() {
  const { id: companyId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const contactIdParam = searchParams.get('contactId');
  const contactId = contactIdParam ? Number(contactIdParam) : null;

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [offset, setOffset] = useState(0);

  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [company, setCompany] = useState(null);
  const [contact, setContact] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}`);
        if (!cancelled) setCompany(c);
      } catch { /* main load below surfaces errors */ }
      if (contactId) {
        try {
          const p = await authenticatedFetchJson(
            `${API_BASE_URL}/crm/companies/${companyId}/contacts/${contactId}`
          );
          if (!cancelled) setContact(p);
        } catch { /* leave contact null */ }
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, contactId]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setOffset(0); }, [stageFilter]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (contactId) params.set('contactId', contactId);
      if (debouncedQ) params.set('q', debouncedQ);
      if (stageFilter) params.set('stage', stageFilter);
      params.set('limit', PAGE_SIZE);
      params.set('offset', offset);
      const data = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/opportunities?${params.toString()}`
      );
      setOpportunities(data.opportunities || []);
    } catch (err) {
      setError(err.message || 'Failed to load opportunities.');
    } finally {
      setLoading(false);
    }
  }, [companyId, contactId, debouncedQ, stageFilter, offset]);

  useEffect(() => { load(); }, [load]);

  const hasNextPage = opportunities.length === PAGE_SIZE;
  const hasPrevPage = offset > 0;

  const contextTitle = contact
    ? `Opportunities — ${[contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email}`
    : company
    ? `Opportunities — ${company.name}`
    : 'Opportunities';

  const newUrl = contactId
    ? `/modules/crm/companies/${companyId}/opportunities/new?contactId=${contactId}`
    : `/modules/crm/companies/${companyId}/opportunities/new`;

  const backUrl = contactId
    ? `/modules/crm/companies/${companyId}/contacts/${contactId}`
    : `/modules/crm/companies/${companyId}`;

  return (
    <PageLayout
      title={contextTitle}
      actions={
        <>
          <button type="button" className="cancel-button" onClick={() => navigate(backUrl)}>
            Back
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate(newUrl)}>
            Add Opportunity
          </button>
        </>
      }
    >
      {contactId && contact && company && (
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
          Deals where {contact.firstName} {contact.lastName} is the primary contact
          at <strong>{company.name}</strong>. Other deals at {company.name} live on
          the company view.
        </p>
      )}
      {!contactId && company && (
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
          All deals in progress for <strong>{company.name}</strong>.
        </p>
      )}

      <div className="filter-bar" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search name or notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="filter-input"
          aria-label="Search opportunities"
          style={{ maxWidth: 320, marginBottom: 0 }}
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          aria-label="Filter by stage"
          style={{ width: 'auto', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
        >
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading opportunities" />
      ) : opportunities.length === 0 ? (
        <div className="no-users">
          {debouncedQ || stageFilter
            ? 'No opportunities match those filters.'
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
                <th style={{ width: '80px', textAlign: 'right' }}>%</th>
                <th style={{ width: '130px' }}>Expected close</th>
                {!contactId && <th style={{ width: '180px' }}>Primary contact</th>}
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
                  <td style={{ textAlign: 'right' }} className="muted">
                    {o.probability == null ? '—' : `${o.probability}%`}
                  </td>
                  <td className="muted">{formatDate(o.expectedCloseDate) || '—'}</td>
                  {!contactId && (
                    <td className="muted">
                      {o.primaryContactName || <span className="muted">—</span>}
                    </td>
                  )}
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
          <span className="pagination__label">Showing {offset + 1}–{offset + opportunities.length}</span>
          <button type="button" className="cancel-button" disabled={!hasNextPage}
                  onClick={() => setOffset(offset + PAGE_SIZE)}>Next →</button>
        </div>
      )}
    </PageLayout>
  );
}
