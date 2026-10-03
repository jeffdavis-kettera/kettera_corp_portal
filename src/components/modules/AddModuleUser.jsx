// Add a member to a module — pick an existing portal user, assign a
// module role, save. Shared by every module in moduleConfigs.js
// (/modules/crm/users/add, /modules/project-management/users/add).
// Different from the app-level AddUser (which searches Firebase).
// This one only offers portal_user rows that already exist and don't
// have a role in this module yet — module admins cannot invite new
// people into the portal, only re-scope who has access to their
// module.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { useModuleRole } from './useModuleRole.js';

export default function AddModuleUser({ module }) {
  const { code, label, usersPath, usersApi, roleHelp } = module;
  const navigate = useNavigate();
  const { isModuleAdmin } = useModuleRole(code);

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
    if (!isModuleAdmin) navigate(usersPath, { replace: true });
  }, [isModuleAdmin, navigate, usersPath]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const search = useCallback(async () => {
    setSearching(true); setSearchError(null);
    try {
      const url = debouncedQ
        ? `${API_BASE_URL}${usersApi}/eligible?q=${encodeURIComponent(debouncedQ)}`
        : `${API_BASE_URL}${usersApi}/eligible`;
      const data = await authenticatedFetchJson(url);
      setCandidates(data.candidates || []);
    } catch (err) {
      setSearchError(err.message || 'Failed to load candidates.');
    } finally {
      setSearching(false);
      setInitialLoad(false);
    }
  }, [debouncedQ, usersApi]);

  useEffect(() => { search(); }, [search]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!picked || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await authenticatedFetchJson(`${API_BASE_URL}${usersApi}`, {
        method: 'POST',
        body: { portalUserId: picked.portalUserId, role },
      });
      navigate(usersPath, { replace: true });
    } catch (err) {
      setSubmitError(err.message || `Failed to add user to ${label}.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title={`Add ${label} User`}>
      <PageCard className="profile-card--form">
        {!picked ? (
          <>
            <h2 style={{ marginTop: 0 }}>Pick a portal user</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
              Only users who are already in the portal but don't yet have a {label}
              {' '}role are shown. To add a new person to the portal itself, an
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
                  ? `No portal users match "${debouncedQ}" who don't already have a ${label} role.`
                  : `Every portal user already has a ${label} role. Nothing to add here.`}
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
              onCancel={() => navigate(usersPath)}
              cancelText="Cancel"
              submitText=""
              disableSubmit
            />
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>Assign {label} role</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
              Granting <strong>{picked.email}</strong> access to the {label} module.{' '}
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
                <label htmlFor="role">{label} role</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={submitting}
                >
                  <option value="BasicUser">{roleHelp.BasicUser}</option>
                  <option value="Admin">{roleHelp.Admin}</option>
                </select>
              </div>

              <FormActions
                onCancel={() => setPicked(null)}
                cancelText="Back"
                submitText={`Add to ${label}`}
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
