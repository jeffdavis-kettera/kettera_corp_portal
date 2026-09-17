// UserDetail — edit one portal user.
//
// Loads /portal-users/:id and /modules in parallel, presents the
// combined form. Save issues up to two API calls (user fields + module
// assignments) sequentially so the API's sole-Admin guard on PUT
// runs first; if it refuses, the module PUT never fires.
//
// Delete uses window.confirm and surfaces the API's 409 codes
// (sole_admin_protected, cannot_delete_self) directly to the user.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from './PageLayout.jsx';
import PageCard from './PageCard.jsx';
import FormActions from './FormActions.jsx';
import ModuleRoleEditor from './ModuleRoleEditor.jsx';
import { API_BASE_URL } from '../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../utils/api.js';
import { usePortalUser } from '../contexts/PortalUserContext.jsx';

// Turn the API's [{ id, code, name, role }, ...] shape into the
// { moduleId: role } map that ModuleRoleEditor works with.
function toMap(modules = []) {
  const out = {};
  for (const m of modules) out[m.id] = m.role;
  return out;
}

// Turn the map back into the API's PUT /modules payload.
function toPayload(map) {
  return Object.entries(map).map(([moduleId, role]) => ({
    moduleId: Number(moduleId),
    role,
  }));
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { portalUser: me, refresh: refreshMe, isAppAdmin } = usePortalUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState(null);

  const [user, setUser] = useState(null);
  const [allModules, setAllModules] = useState([]);
  const [displayName, setDisplayName] = useState('');
  const [appRole, setAppRole] = useState('BasicUser');
  const [status, setStatus] = useState('Active');
  const [moduleMap, setModuleMap] = useState({});

  // Snapshot of what the server last confirmed. Used to detect what
  // actually needs saving so we don't PUT modules that didn't change.
  const [saved, setSaved] = useState({ displayName: '', appRole: '', status: '', moduleMap: {} });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const [userData, modulesData] = await Promise.all([
        authenticatedFetchJson(`${API_BASE_URL}/portal-users/${id}`),
        authenticatedFetchJson(`${API_BASE_URL}/modules`),
      ]);
      setUser(userData);
      setAllModules(modulesData || []);
      setDisplayName(userData.displayName || '');
      setAppRole(userData.appRole);
      setStatus(userData.status);
      const map = toMap(userData.modules);
      setModuleMap(map);
      setSaved({
        displayName: userData.displayName || '',
        appRole: userData.appRole,
        status: userData.status,
        moduleMap: map,
      });
    } catch (err) {
      setError(err.message || 'Failed to load user.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isAppAdmin) return navigate('/dashboard', { replace: true });
    load();
  }, [isAppAdmin, load, navigate]);

  const isSelf = me?.id != null && user?.id === me.id;

  const userFieldsChanged =
    displayName !== saved.displayName ||
    appRole !== saved.appRole ||
    status !== saved.status;

  const modulesChanged =
    JSON.stringify(sortedEntries(moduleMap)) !==
    JSON.stringify(sortedEntries(saved.moduleMap));

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      let latestUser = user;
      if (userFieldsChanged) {
        latestUser = await authenticatedFetchJson(
          `${API_BASE_URL}/portal-users/${id}`,
          {
            method: 'PUT',
            body: {
              displayName: displayName || null,
              appRole,
              status,
            },
          }
        );
      }

      if (modulesChanged) {
        const modulesResult = await authenticatedFetchJson(
          `${API_BASE_URL}/portal-users/${id}/modules`,
          {
            method: 'PUT',
            body: { modules: toPayload(moduleMap) },
          }
        );
        // Merge the fresh module list back into user object we render.
        latestUser = { ...latestUser, modules: modulesResult.modules };
      }

      setUser(latestUser);
      setSaved({
        displayName: latestUser.displayName || '',
        appRole: latestUser.appRole,
        status: latestUser.status,
        moduleMap: toMap(latestUser.modules),
      });
      setSuccess('Saved.');

      // If the user just edited themselves, refresh PortalUserContext
      // so the sidebar reflects the new modules / role.
      if (isSelf) refreshMe();
    } catch (err) {
      // API returns 409 sole_admin_protected on demote/suspend of the
      // last Admin — surface that message directly.
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    const confirmMsg =
      `Delete portal user "${user?.email}"?\n\n` +
      'They will lose access immediately. The Firebase identity is unaffected.';
    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/portal-users/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        navigate('/users', { replace: true });
        return;
      }
      // Non-204 → parse error and show it (e.g. 409 sole_admin_protected).
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Delete failed (${res.status}).`);
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <PageLayout title="User">
        <div className="spinner" role="status" aria-label="Loading" />
      </PageLayout>
    );
  }
  if (!user) {
    return (
      <PageLayout title="User">
        <PageCard className="profile-card--form">
          <div className="error-message"><p>{error || 'User not found.'}</p></div>
          <FormActions
            onCancel={() => navigate('/users')}
            cancelText="Back to Users"
            submitText=""
            disableSubmit
          />
        </PageCard>
      </PageLayout>
    );
  }

  const dirty = userFieldsChanged || modulesChanged;

  return (
    <PageLayout
      title={user.email}
      actions={
        <button
          type="button"
          className="cancel-button"
          onClick={handleDelete}
          disabled={deleting || isSelf}
          title={isSelf ? "You can't delete your own portal user." : ''}
          style={{ color: 'var(--color-danger-tx)', borderColor: 'var(--color-danger-tx)' }}
        >
          {deleting ? 'Deleting…' : 'Delete User'}
        </button>
      }
    >
      <PageCard className="profile-card--form">
        {error && <div className="error-message"><p>{error}</p></div>}
        {success && <div className="success-message"><p>{success}</p></div>}
        {isSelf && (
          <div className="info-banner" role="note">
            You are editing your own portal user. Suspending or demoting yourself is
            allowed only while another Admin exists.
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label>Firebase Identity</label>
            <div className="static-field">
              <div><strong>{user.email}</strong></div>
              <div className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                UID: <code>{user.firebaseUserId}</code>
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
              disabled={saving}
              placeholder="e.g. Jeff Davis"
            />
          </div>

          <div className="form-group">
            <label htmlFor="appRole">App role</label>
            <select
              id="appRole"
              value={appRole}
              onChange={(e) => setAppRole(e.target.value)}
              disabled={saving}
            >
              <option value="BasicUser">Basic User</option>
              <option value="Admin">Admin — can add / remove users</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={saving}
            >
              <option value="Active">Active</option>
              <option value="Suspended">Suspended — blocks sign-in without deleting</option>
            </select>
          </div>

          <div className="form-group">
            <label>Modules</label>
            <ModuleRoleEditor
              modules={allModules}
              value={moduleMap}
              onChange={setModuleMap}
              disabled={saving}
            />
          </div>

          <FormActions
            onCancel={() => navigate('/users')}
            cancelText="Back to Users"
            submitText="Save changes"
            submittingText="Saving…"
            isSubmitting={saving}
            disableSubmit={!dirty}
          />
        </form>
      </PageCard>
    </PageLayout>
  );
}

// Deterministic serialization for the modulesChanged compare.
function sortedEntries(map) {
  return Object.keys(map).sort().map((k) => [k, map[k]]);
}
