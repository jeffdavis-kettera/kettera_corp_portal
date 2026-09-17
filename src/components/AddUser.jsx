// AddUser — two-step flow to grant a Firebase identity Corp Portal
// access.
//
// Step 1 (search): typing into the input debounces a call to
//   GET /portal-users/firebase-search?q=<query>
// The API returns up to 25 candidates from the Firebase project,
// filtering out anyone who already has a portal_user row. The user
// picks one.
//
// Step 2 (assign): the picked candidate's identity is locked in; the
// admin sets app role + module assignments; save fires
//   POST /portal-users
// and on success we redirect to /users/:newId (which is the detail
// page — a nice place to land because you can immediately confirm
// what got saved and edit it if needed).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from './PageLayout.jsx';
import PageCard from './PageCard.jsx';
import FormActions from './FormActions.jsx';
import ModuleRoleEditor from './ModuleRoleEditor.jsx';
import { API_BASE_URL } from '../utils/config.js';
import { authenticatedFetchJson } from '../utils/api.js';
import { usePortalUser } from '../contexts/PortalUserContext.jsx';

const MIN_QUERY_LEN = 2;

export default function AddUser() {
  const navigate = useNavigate();
  const { isAppAdmin } = usePortalUser();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [picked, setPicked] = useState(null);   // { uid, email, displayName }
  const [displayName, setDisplayName] = useState('');
  const [appRole, setAppRole] = useState('BasicUser');
  const [moduleMap, setModuleMap] = useState({});
  const [allModules, setAllModules] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!isAppAdmin) navigate('/dashboard', { replace: true });
  }, [isAppAdmin, navigate]);

  // Load module list up front so step 2 renders immediately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authenticatedFetchJson(`${API_BASE_URL}/modules`);
        if (!cancelled) setAllModules(data || []);
      } catch {
        // Non-fatal — step 2 will show the empty state until this
        // succeeds. Retry on save wouldn't help; the /modules
        // endpoint is trivial and if it fails everything is on fire.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounce the search input by 350 ms — a touch slower than the
  // list-page search because each keystroke hits the Firebase Admin
  // SDK's listUsers, which is heavier than a DB LIKE.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    if (debouncedQ.length < MIN_QUERY_LEN) {
      setCandidates([]);
      setSearchError(null);
      return;
    }
    async function search() {
      setSearching(true);
      setSearchError(null);
      try {
        const data = await authenticatedFetchJson(
          `${API_BASE_URL}/portal-users/firebase-search?q=${encodeURIComponent(debouncedQ)}`
        );
        if (!cancelled) setCandidates(data.candidates || []);
      } catch (err) {
        if (!cancelled) setSearchError(err.message || 'Search failed.');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }
    search();
    return () => { cancelled = true; };
  }, [debouncedQ]);

  function handlePick(candidate) {
    setPicked(candidate);
    setDisplayName(candidate.displayName || '');
    setSubmitError(null);
  }

  function handleUnpick() {
    setPicked(null);
    setDisplayName('');
    setAppRole('BasicUser');
    setModuleMap({});
    setSubmitError(null);
  }

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!picked || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const body = {
        firebaseUserId: picked.uid,
        email: picked.email,
        displayName: displayName || null,
        appRole,
        modules: Object.entries(moduleMap).map(([moduleId, role]) => ({
          moduleId: Number(moduleId),
          role,
        })),
      };
      const created = await authenticatedFetchJson(
        `${API_BASE_URL}/portal-users`,
        { method: 'POST', body }
      );
      navigate(`/users/${created.id}`, { replace: true });
    } catch (err) {
      setSubmitError(err.message || 'Failed to add user.');
    } finally {
      setSubmitting(false);
    }
  }, [picked, submitting, displayName, appRole, moduleMap, navigate]);

  return (
    <PageLayout title="Add User">
      <PageCard className="profile-card--form">
        {!picked ? (
          <>
            <h2 style={{ marginTop: 0 }}>Step 1 — Find them in Firebase</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
              Search the Kettera Firebase directory by email or display name.
              Users already in Corp Portal don't appear here.
            </p>

            <div className="form-group">
              <label htmlFor="q">Search</label>
              <input
                id="q"
                type="search"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="email or name (at least 2 characters)"
              />
            </div>

            {searchError && (
              <div className="error-message"><p>{searchError}</p></div>
            )}

            {debouncedQ.length >= MIN_QUERY_LEN && (
              searching ? (
                <div className="spinner" role="status" aria-label="Searching" />
              ) : candidates.length === 0 ? (
                <div className="no-users">
                  No matching Firebase users found (or all matches are already portal users).
                </div>
              ) : (
                <ul className="candidate-list">
                  {candidates.map((c) => (
                    <li key={c.uid}>
                      <button
                        type="button"
                        className="candidate-list__item"
                        onClick={() => handlePick(c)}
                      >
                        <span className="candidate-list__name">
                          {c.displayName || <em className="muted">no display name</em>}
                        </span>
                        <span className="candidate-list__email">{c.email}</span>
                        {c.disabled && (
                          <span className="status-badge status-badge--suspended">Firebase disabled</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}

            <FormActions
              onCancel={() => navigate('/users')}
              cancelText="Cancel"
              submitText=""
              disableSubmit
            />
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>Step 2 — Assign roles</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
              Adding <strong>{picked.email}</strong> to Kettera Corp Portal.{' '}
              <button
                type="button"
                onClick={handleUnpick}
                className="link-button"
                disabled={submitting}
              >
                Pick someone else
              </button>
            </p>

            {submitError && <div className="error-message"><p>{submitError}</p></div>}

            <form onSubmit={handleSubmit} className="form-stack">
              <div className="form-group">
                <label>Firebase Identity</label>
                <div className="static-field">
                  <div><strong>{picked.email}</strong></div>
                  <div className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                    UID: <code>{picked.uid}</code>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="displayName">Display name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={200}
                  disabled={submitting}
                  placeholder="e.g. Jane Doe"
                />
              </div>

              <div className="form-group">
                <label htmlFor="appRole">App role</label>
                <select
                  id="appRole"
                  value={appRole}
                  onChange={(e) => setAppRole(e.target.value)}
                  disabled={submitting}
                >
                  <option value="BasicUser">Basic User</option>
                  <option value="Admin">Admin — can add / remove users</option>
                </select>
              </div>

              <div className="form-group">
                <label>Modules</label>
                <ModuleRoleEditor
                  modules={allModules}
                  value={moduleMap}
                  onChange={setModuleMap}
                  disabled={submitting}
                />
              </div>

              <FormActions
                onCancel={handleUnpick}
                cancelText="Back"
                submitText="Add User"
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
