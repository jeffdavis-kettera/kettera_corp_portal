// Dashboard — the landing screen for a resolved portal user.
//
// Phase 3 scope: a friendly welcome and a card per module the user
// has access to. Real per-module dashboards land later, per module.

import PageLayout from './PageLayout.jsx';
import { usePortalUser } from '../contexts/PortalUserContext.jsx';

export default function Dashboard() {
  const { portalUser, modules, isAppAdmin } = usePortalUser();

  return (
    <PageLayout title="Dashboard">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ margin: 0 }}>
          Welcome, {portalUser?.displayName || portalUser?.email}.
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
          {isAppAdmin
            ? 'You have Corp Portal Admin access. Use User Management in the sidebar to add or edit users.'
            : 'Choose a module from the sidebar to get started.'}
        </p>
      </div>

      <h3 style={{ marginBottom: 'var(--space-3)' }}>Your modules</h3>
      {modules.length === 0 ? (
        <div className="no-modules">
          You don't have access to any modules yet.
          {isAppAdmin && ' Assign yourself a module role in User Management.'}
        </div>
      ) : (
        <div className="module-grid">
          {modules.map((m) => (
            <div key={m.id} className="module-card">
              <h3>{m.name}</h3>
              <span className="module-card__role">{m.role}</span>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
