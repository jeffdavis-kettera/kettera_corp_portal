// Module member management for module Admins. Shared by every module
// in moduleConfigs.js — rendered at /modules/crm/users and
// /modules/project-management/users with that module's config.
//
// Per-row role dropdown and Remove button. Each change fires
// immediately with a per-row saving state (matches "team members"
// UX patterns from Slack / Linear / Notion — batch save would be
// awkward given how small the surface is).
//
// Server-side sole-Admin guard surfaces as 409 sole_module_admin_protected;
// we display the message and revert the local optimistic change.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../utils/api.js';
import { useModuleRole } from './useModuleRole.js';
import { usePortalUser } from '../../contexts/PortalUserContext.jsx';

export default function ModuleUsers({ module }) {
  const { code, label, homePath, configPath, usersPath, usersApi } = module;
  const navigate = useNavigate();
  const { isModuleAdmin } = useModuleRole(code);
  const { portalUser: me, refresh: refreshMe } = usePortalUser();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pendingId, setPendingId] = useState(null); // portalUserId currently mid-save

  useEffect(() => {
    if (!isModuleAdmin) navigate(homePath, { replace: true });
  }, [isModuleAdmin, navigate, homePath]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const url = debouncedQ
        ? `${API_BASE_URL}${usersApi}?q=${encodeURIComponent(debouncedQ)}`
        : `${API_BASE_URL}${usersApi}`;
      const data = await authenticatedFetchJson(url);
      setMembers(data.members || []);
    } catch (err) {
      setError(err.message || `Failed to load ${label} users.`);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, usersApi, label]);

  useEffect(() => { load(); }, [load]);

  async function handleRoleChange(m, nextRole) {
    if (m.role === nextRole || pendingId) return;
    setError(null); setSuccess(null);
    setPendingId(m.portalUserId);
    // Optimistic update.
    const prev = members;
    setMembers((list) => list.map((x) =>
      x.portalUserId === m.portalUserId ? { ...x, role: nextRole } : x
    ));
    try {
      await authenticatedFetchJson(
        `${API_BASE_URL}${usersApi}/${m.portalUserId}`,
        { method: 'PUT', body: { role: nextRole } }
      );
      setSuccess(`Set ${m.email} to ${nextRole === 'Admin' ? 'Admin' : 'Basic User'}.`);
      // If they just changed THEIR OWN role, refresh the sidebar's
      // notion of what module role they hold.
      if (me?.id === m.portalUserId) refreshMe();
    } catch (err) {
      setError(err.message || 'Role change failed.');
      setMembers(prev); // revert
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(m) {
    if (pendingId) return;
    const target = m.displayName || m.email;
    const confirmMsg = me?.id === m.portalUserId
      ? `Remove yourself from ${label}? You'll lose access to ${label} screens immediately (your portal user stays intact).`
      : `Remove ${target} from ${label}? Their portal user stays intact — this only revokes their ${label} access.`;
    if (!window.confirm(confirmMsg)) return;

    setError(null); setSuccess(null);
    setPendingId(m.portalUserId);
    try {
      const res = await authenticatedFetch(
        `${API_BASE_URL}${usersApi}/${m.portalUserId}`,
        { method: 'DELETE' }
      );
      if (res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Remove failed (${res.status}).`);
      }
      setMembers((list) => list.filter((x) => x.portalUserId !== m.portalUserId));
      setSuccess(`Removed ${target} from ${label}.`);
      if (me?.id === m.portalUserId) {
        refreshMe();
        navigate(homePath, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Remove failed.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <PageLayout
      title={`${label} — Users`}
      actions={
        <>
          <button
            type="button"
            className="cancel-button"
            onClick={() => navigate(configPath)}
          >
            Back to Configuration
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate(`${usersPath}/add`)}
          >
            Add User
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        People who have access to the {label} module. You can grant {label} access to any
        existing portal user, change their role between Basic User and Admin, or
        remove them from {label} (their portal user is not affected).
      </p>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search by email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="filter-input"
          aria-label={`Search ${label} users`}
        />
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}
      {success && <div className="success-message"><p>{success}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label={`Loading ${label} users`} />
      ) : members.length === 0 ? (
        <div className="no-users">
          {debouncedQ
            ? `No ${label} users match "${debouncedQ}".`
            : `No ${label} users yet. Click Add User to grant ${label} access to a portal user.`}
        </div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th style={{ width: '180px' }}>{label} Role</th>
                <th>Status</th>
                <th style={{ width: '120px' }}></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isPending = pendingId === m.portalUserId;
                const isSelf = me?.id === m.portalUserId;
                return (
                  <tr key={m.portalUserId}>
                    <td>
                      <strong>{m.displayName || <span className="muted">—</span>}</strong>
                      {isSelf && <span className="muted" style={{ marginLeft: 8, fontSize: 'var(--font-size-xs)' }}>(you)</span>}
                    </td>
                    <td>{m.email}</td>
                    <td>
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m, e.target.value)}
                        disabled={isPending}
                        aria-label={`${label} role for ${m.email}`}
                      >
                        <option value="BasicUser">Basic User</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`status-badge status-badge--${m.status === 'Active' ? 'active' : 'suspended'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="cancel-button"
                        style={{
                          color: 'var(--color-danger-tx)',
                          borderColor: 'var(--color-danger-tx)',
                          padding: 'var(--space-1) var(--space-3)',
                          fontSize: 'var(--font-size-sm)',
                        }}
                        onClick={() => handleRemove(m)}
                        disabled={isPending}
                      >
                        {isPending ? '…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}
