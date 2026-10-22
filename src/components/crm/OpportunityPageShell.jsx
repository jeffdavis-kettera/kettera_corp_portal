// OpportunityPageShell — the tab shell for one opportunity, built the
// same way as CompanyPageShell:
//   1. Load the opportunity once; tabs get it via outlet context.
//   2. Header: the opportunity name, with Back to Opportunities and
//      Delete in the actions slot (so both work from every tab and
//      from inside every tool).
//   3. Tab strip: Details | Tools | Proposal. Tools stays highlighted
//      while a tool is open underneath it.
//   4. A summary line (company, stage, value, expected close) so a
//      tool page always shows which deal it belongs to.
//
// Outlet context: { opportunity, applyOpportunity, reloadOpportunity }.
// Details passes the PUT response to applyOpportunity; tools call
// reloadOpportunity after a decision changes the pitched services.

import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../utils/api.js';
import { STAGE_BADGE_CLASS, formatCurrency, formatDate } from './opportunityStages.js';

export default function OpportunityPageShell() {
  const { id: companyId, oppId } = useParams();
  const navigate = useNavigate();
  const listUrl = `/modules/crm/companies/${companyId}/opportunities`;
  const oppUrl = `${API_BASE_URL}/crm/companies/${companyId}/opportunities/${oppId}`;

  const [opportunity, setOpportunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Reloads don't flip `loading`, so a tab that triggers one (after a
  // save) isn't unmounted mid-message.
  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) { setLoading(true); setError(null); }
    try {
      const data = await authenticatedFetchJson(oppUrl);
      setOpportunity(data);
    } catch (err) {
      if (initial) setError(err.message || 'Failed to load opportunity.');
    } finally {
      if (initial) setLoading(false);
    }
  }, [oppUrl]);
  useEffect(() => { load({ initial: true }); }, [load]);

  const reloadOpportunity = useCallback(() => load(), [load]);
  const applyOpportunity = useCallback((next) => setOpportunity(next), []);

  async function handleDelete() {
    if (deleting) return;
    if (!window.confirm(`Delete opportunity "${opportunity.name}"? This cannot be undone.`)) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await authenticatedFetch(oppUrl, { method: 'DELETE' });
      if (res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status}).`);
      }
      navigate(listUrl, { replace: true });
    } catch (err) {
      setDeleteError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <PageLayout title="Opportunity"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  }
  if (!opportunity) {
    return (
      <PageLayout title="Opportunity">
        <div className="error-message"><p>{error || 'Opportunity not found.'}</p></div>
        <button type="button" className="cancel-button" onClick={() => navigate(listUrl)}>
          Back to Opportunities
        </button>
      </PageLayout>
    );
  }

  const tabBase = `${listUrl}/${oppId}`;
  const tabClass = ({ isActive }) => `tab-strip__tab${isActive ? ' is-active' : ''}`;

  return (
    <PageLayout
      title={opportunity.name}
      actions={
        <>
          <button type="button" className="cancel-button" onClick={() => navigate(listUrl)}>
            Back to Opportunities
          </button>
          <button
            type="button"
            className="cancel-button"
            onClick={handleDelete}
            disabled={deleting}
            style={{ color: 'var(--color-danger-tx)', borderColor: 'var(--color-danger-tx)' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </>
      }
    >
      <nav className="tab-strip" aria-label="Opportunity sections">
        <NavLink to={tabBase} end className={tabClass}>Details</NavLink>
        <NavLink to={`${tabBase}/tools`} className={tabClass}>Tools</NavLink>
        <NavLink to={`${tabBase}/proposal`} className={tabClass}>Proposal</NavLink>
      </nav>

      <div className="record-summary">
        <Link to={`/modules/crm/companies/${companyId}`}>{opportunity.companyName || 'Company'}</Link>
        <span className="record-summary__sep">·</span>
        <span className={STAGE_BADGE_CLASS[opportunity.stage] || 'stage-badge stage-badge--lead'}>
          {opportunity.stage}
        </span>
        {opportunity.value != null && (
          <>
            <span className="record-summary__sep">·</span>
            <span>{formatCurrency(opportunity.value, opportunity.currency)}</span>
          </>
        )}
        {opportunity.expectedCloseDate && (
          <>
            <span className="record-summary__sep">·</span>
            <span>expected close {formatDate(opportunity.expectedCloseDate)}</span>
          </>
        )}
      </div>

      {deleteError && <div className="error-message"><p>{deleteError}</p></div>}

      <Outlet context={{ opportunity, applyOpportunity, reloadOpportunity }} />
    </PageLayout>
  );
}
