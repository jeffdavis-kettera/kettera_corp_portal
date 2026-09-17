// Users — the list screen for User Management.
//
// - Fetches GET /portal-users?q=&limit=&offset=
// - Debounced search (300 ms) rewires the fetch
// - Row click → /users/:id (detail)
// - "Add User" button → /users/add (top-right, PageLayout actions slot)
// - Pagination via next/prev buttons and offset
//
// Everything on this screen requires app-Admin. The route already
// forces that (Phase 2's requireAppAdmin gates every /portal-users
// endpoint), but we keep the UI honest: non-Admins are bounced back
// to /dashboard if they somehow land here.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from './PageLayout.jsx';
import { API_BASE_URL } from '../utils/config.js';
import { authenticatedFetchJson } from '../utils/api.js';
import { usePortalUser } from '../contexts/PortalUserContext.jsx';

const PAGE_SIZE = 50;

export default function Users() {
  const navigate = useNavigate();
  const { isAppAdmin } = usePortalUser();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Non-admins have no business here; bounce.
  useEffect(() => {
    if (!isAppAdmin) navigate('/dashboard', { replace: true });
  }, [isAppAdmin, navigate]);

  // Debounce the search input. Reset offset to 0 whenever the query
  // changes so we don't request page 3 of a fresh search.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedQ) params.set('q', debouncedQ);
        params.set('limit', PAGE_SIZE);
        params.set('offset', offset);
        const data = await authenticatedFetchJson(
          `${API_BASE_URL}/portal-users?${params.toString()}`
        );
        if (!cancelled) setUsers(data.users || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load users.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [debouncedQ, offset]);

  const hasNextPage = users.length === PAGE_SIZE;
  const hasPrevPage = offset > 0;

  return (
    <PageLayout
      title="User Management"
      actions={
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate('/users/add')}
        >
          Add User
        </button>
      }
    >
      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search by email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="filter-input"
          aria-label="Search users"
        />
      </div>

      {error && (
        <div className="error-message"><p>{error}</p></div>
      )}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading users" />
      ) : users.length === 0 ? (
        <div className="no-users">
          {debouncedQ ? `No users match "${debouncedQ}".` : 'No portal users yet. Click Add User to invite the first.'}
        </div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>App Role</th>
                <th style={{ textAlign: 'right' }}>Modules</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => navigate(`/users/${u.id}`)}
                  className="data-table__row-clickable"
                >
                  <td>{u.displayName || <span className="muted">—</span>}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`role-badge role-badge--${u.appRole === 'Admin' ? 'admin' : 'basic'}`}>
                      {u.appRole === 'Admin' ? 'Admin' : 'Basic User'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{u.moduleCount}</td>
                  <td>
                    <span className={`status-badge status-badge--${u.status === 'Active' ? 'active' : 'suspended'}`}>
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(hasPrevPage || hasNextPage) && (
        <div className="pagination">
          <button
            type="button"
            className="cancel-button"
            disabled={!hasPrevPage}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            ← Previous
          </button>
          <span className="pagination__label">
            Showing {offset + 1}–{offset + users.length}
          </span>
          <button
            type="button"
            className="cancel-button"
            disabled={!hasNextPage}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next →
          </button>
        </div>
      )}
    </PageLayout>
  );
}
