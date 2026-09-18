// CompanyPageShell — the tab shell that hosts every company-scoped
// screen. Responsibilities:
//   1. Load the company row once (cached across tab switches).
//   2. Render the PageLayout with the company name as title and
//      the admin Delete Company button in the actions slot.
//   3. Render a sticky tab strip: Overview / Contacts / Opportunities / Activity.
//   4. Render <Outlet /> for the active tab's body, with the loaded
//      company + a reload function exposed via outlet context so
//      children don't have to re-fetch.
//
// Forms and detail drill-ins (AddContact, ContactDetail,
// OpportunityForm, ActivityForm) are NOT rendered under this shell —
// they're focused work and get their own PageLayout so the tab
// strip doesn't distract. Save/Cancel routes back to whichever tab
// makes sense.
//
// The refactor pattern established here is what we'll use for
// Contact detail, and for future modules when their record pages
// grow past ~3 sections.

import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../utils/api.js';
import { useCrmRole } from './useCrmRole.js';

export default function CompanyPageShell() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isCrmAdmin } = useCrmRole();

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${id}`);
      setCompany(data);
    } catch (err) {
      setError(err.message || 'Failed to load company.');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!isCrmAdmin || deleting) return;
    if (!window.confirm(`Delete company "${company.name}"? All contacts, opportunities, and activity for this company will be deleted too. This cannot be undone.`)) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/crm/companies/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        navigate('/modules/crm', { replace: true });
        return;
      }
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Delete failed (${res.status}).`);
    } catch (err) {
      setDeleteError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <PageLayout title="Company"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  }
  if (!company) {
    return (
      <PageLayout title="Company">
        <div className="error-message"><p>{error || 'Company not found.'}</p></div>
        <button type="button" className="cancel-button" onClick={() => navigate('/modules/crm')}>
          Back to Companies
        </button>
      </PageLayout>
    );
  }

  const tabBase = `/modules/crm/companies/${id}`;
  const tabClass = ({ isActive }) => `tab-strip__tab${isActive ? ' is-active' : ''}`;

  return (
    <PageLayout
      title={company.name}
      actions={isCrmAdmin ? (
        <button
          type="button"
          className="cancel-button"
          onClick={handleDelete}
          disabled={deleting}
          style={{ color: 'var(--color-danger-tx)', borderColor: 'var(--color-danger-tx)' }}
        >
          {deleting ? 'Deleting…' : 'Delete Company'}
        </button>
      ) : null}
    >
      <nav className="tab-strip" aria-label="Company sections">
        {/* end prop ensures Overview only matches at the exact base path. */}
        <NavLink to={tabBase} end className={tabClass}>Overview</NavLink>
        <NavLink to={`${tabBase}/contacts`} className={tabClass}>Contacts</NavLink>
        <NavLink to={`${tabBase}/opportunities`} className={tabClass}>Opportunities</NavLink>
        <NavLink to={`${tabBase}/activities`} className={tabClass}>Activity</NavLink>
        <NavLink to={`${tabBase}/documents`} className={tabClass}>Documents</NavLink>
      </nav>

      {deleteError && <div className="error-message"><p>{deleteError}</p></div>}

      <Outlet context={{ company, reloadCompany: load }} />
    </PageLayout>
  );
}
