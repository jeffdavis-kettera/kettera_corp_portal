// /modules/crm/users/add — pick an existing portal user, assign a
// CRM role, save. Different from the app-level AddUser (which
// searches Firebase). This one only offers portal_user rows that
// already exist and don't have a CRM role yet — module admins
// cannot invite new people into the portal, only re-scope who has
// access to their module.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { useCrmRole } from './useCrmRole.js';

export default function AddCrmUser() {
  const navigate = useNavigate();
  const { isCrmAdmin } = useCrmRole();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const [picked, setPicked] = useState(null);
  const [role, setRole] = useState('BasicUser');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!isCrmAdmin) navigate('/modules/crm/users', { replace: true });
  }, [isCrmAdmin, navigate]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const search = useCallback(async () => {
    setSearching(true); setSearchError(null);
    try {
      const url = debouncedQ
        ? `${API_BASE_URL}/modules/crm/users/eligible?q=${encodeURIComponent(debouncedQ)}`
        : `${API_BASE_URL}/modules/crm/users/eligible`;
      const data = await authenticatedFetchJson(url);
      setCandidates(data.candidates || []);
    } catch (err) {
      setSearchError(err.message || 'Failed to load candidates.');
    } finally {
      setSearching(false);
      setInitialLoad(false);
    }
  }, [debouncedQ]);

  useEffect(() => { search(); }, [search]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!picked || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await authenticatedFetchJson(`${API_BASE_URL}/modules/crm/users`, {
        method: 'POST',
        body: { portalUserId: picked.portalUserId, role },
      });
      navigate('/modules/crm/users', { replace: true });
    } catch (err) {
      setSubmitError(err.message || 'Failed to add user to CRM.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title="Add CRM User">
      <PageCard className="profile-card--form">
        {!picked ? (
          <>
            <h2 style={{ marginTop: 0 }}>Pick a portal user</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
              Only users who are already in the portal but don't yet have a CRM
              role are shown. To add a new person to the portal itself, an
              app-Admin uses the top-level User Management screen.
            </p>

            <div className="form-group">
              <label htmlFor="q">Search</label>
              <input
                id="q"
                type="search"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="email or name (or leave blank to see the first 50)"
              />
            </div>

            {searchError && <div className="error-message"><p>{searchError}</p></div>}

            {searching || initialLoad ? (
              <div className="spinner" role="status" aria-label="Searching" />
            ) : candidates.length === 0 ? (
              <div className="no-users">
                {debouncedQ
                  ? `No portal users match "${debouncedQ}" who don't already have a CRM role.`
                  : 'Every portal user already has a CRM role. Nothing to add here.'}
              </div>
            ) : (
              <ul className="candidate-list">
                {candidates.map((c) => (
                  <li key={c.portalUserId}>
                    <button
                      type="button"
                      className="candidate-list__item"
                      onClick={() => setPicked(c)}
                    >
                      <span className="candidate-list__name">
                        {c.displayName || <em className="muted">no display name</em>}
                      </span>
                      <span className="candidate-list__email">{c.email}</span>
                      {c.appRole === 'Admin' && (
                        <span className="role-badge role-badge--admin">App Admin</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <FormActions
              onCancel={() => navigate('/modules/crm/users')}
              cancelText="Cancel"
              submitText=""
              disableSubmit
            />
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>Assign CRM role</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
              Granting <strong>{picked.email}</strong> access to the CRM module.{' '}
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="link-button"
                disabled={submitting}
              >
                Pick someone else
              </button>
            </p>

            {submitError && <div className="error-message"><p>{submitError}</p></div>}

            <form onSubmit={handleSubmit} className="form-stack">
              <div className="form-group">
                <label>Portal user</label>
                <div className="static-field">
                  <div><strong>{picked.email}</strong></div>
                  <div className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {picked.displayName || 'No display name set'}
                    {picked.appRole === 'Admin' && ' · App Admin'}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="role">CRM role</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={submitting}
                >
                  <option value="BasicUser">Basic User — needs company access granted separately in Configuration</option>
                  <option value="Admin">Admin — sees every company automatically, can manage CRM users</option>
                </select>
              </div>

              <FormActions
                onCancel={() => setPicked(null)}
                cancelText="Back"
                submitText="Add to CRM"
                submittingText="Adding…"
                isSubmitting={submitting}
              />
            </form>
          </>
        )}
      </PageCard>
    </PageLayout>
  );
}
