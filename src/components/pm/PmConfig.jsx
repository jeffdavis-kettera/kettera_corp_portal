// /modules/project-management/config — Project Management
// configuration landing. Same two cards as CRM's: module user
// management and per-company access. Future PM settings (project
// templates, etc.) drop into the same grid.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import { usePmRole } from './usePmRole.js';

export default function PmConfig() {
  const navigate = useNavigate();
  const { isPmAdmin } = usePmRole();

  useEffect(() => {
    if (!isPmAdmin) navigate('/modules/project-management', { replace: true });
  }, [isPmAdmin, navigate]);

  return (
    <PageLayout title="Project Management — Configuration">
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        Admin-only tools for shaping how the Project Management module behaves.
      </p>

      <div className="module-grid">
        <button
          type="button"
          className="module-card module-card--link"
          onClick={() => navigate('/modules/project-management/users')}
          style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
        >
          <h3>User Management</h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-2)' }}>
            Grant existing portal users access to the Project Management module,
            change their role (Admin / Basic User), or remove them from the
            module. Users must already exist at the app level — module admins
            cannot invite new people to Corp Portal.
          </p>
          <span className="module-card__role">Admin only</span>
        </button>

        <button
          type="button"
          className="module-card module-card--link"
          onClick={() => navigate('/modules/project-management/config/company-access')}
          style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
        >
          <h3>Company Access</h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-2)' }}>
            Choose which Project Management Basic Users can see each company's
            projects. Project Management Admins always see every project.
          </p>
          <span className="module-card__role">Admin only</span>
        </button>
      </div>
    </PageLayout>
  );
}
