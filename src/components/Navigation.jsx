// Sidebar navigation.
//
// Sections:
//   Dashboard              — always visible
//   User Management        — only for app-Admins
//   Modules (dynamic list) — one link per assignment in portalUser.modules
//   Footer                 — signed-in identity + Sign out button
//
// The module list is data-driven (from PortalUserContext.modules), so
// adding a module in the DB and giving a user a role appears here
// automatically — no code change.

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { usePortalUser } from '../contexts/PortalUserContext.jsx';

// Human-facing labels for the module-role pill in the sidebar.
const ROLE_LABEL = { Admin: 'Admin', BasicUser: 'Basic' };

function moduleSlug(code) {
  // Convert 'ProjectManagement' → 'project-management' for URLs.
  return code
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export default function Navigation() {
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();
  const { portalUser, modules, isAppAdmin } = usePortalUser();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <nav className="nav">
      <div className="nav__brand">
        <p className="nav__brand-title">Kettera Corp</p>
        <p className="nav__brand-subtitle">Portal</p>
      </div>

      <div className="nav__section">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
        >
          Dashboard
        </NavLink>
      </div>

      {isAppAdmin && (
        <div className="nav__section">
          <p className="nav__section-label">Administration</p>
          <NavLink
            to="/users"
            className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
          >
            User Management
          </NavLink>
        </div>
      )}

      {modules.length > 0 && (
        <div className="nav__section">
          <p className="nav__section-label">Modules</p>
          {modules.map((m) => (
            <NavLink
              key={m.id}
              to={`/modules/${moduleSlug(m.code)}`}
              className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
            >
              {m.name}
              <span className="nav__link-role">{ROLE_LABEL[m.role] || m.role}</span>
            </NavLink>
          ))}
        </div>
      )}

      <div className="nav__footer">
        <div className="nav__footer-name">
          {portalUser?.displayName || currentUser?.displayName || 'Signed in'}
        </div>
        <div className="nav__footer-email">{portalUser?.email || currentUser?.email}</div>
        <button
          type="button"
          onClick={handleLogout}
          className="cancel-button"
          style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)' }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
