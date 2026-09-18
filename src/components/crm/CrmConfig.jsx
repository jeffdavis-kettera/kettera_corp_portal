// /modules/crm/config — CRM configuration landing.
//
// Right now it's a single card for "Company Access". Future config
// sections (custom fields, workflow templates, etc.) drop into the
// same grid without any layout work.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import { useCrmRole } from './useCrmRole.js';

export default function CrmConfig() {
  const navigate = useNavigate();
  const { isCrmAdmin } = useCrmRole();

  useEffect(() => {
    if (!isCrmAdmin) navigate('/modules/crm', { replace: true });
  }, [isCrmAdmin, navigate]);

  return (
    <PageLayout title="CRM — Configuration">
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        Admin-only tools for shaping how the CRM module behaves.
      </p>

      <div className="module-grid">
        <button
          type="button"
          className="module-card module-card--link"
          onClick={() => navigate('/modules/crm/users')}
          style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
        >
          <h3>User Management</h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-2)' }}>
            Grant existing portal users access to the CRM module, change their
            CRM role (Admin / Basic User), or remove them from CRM. Users must
            already exist at the app level — module admins cannot invite new
            people to Corp Portal.
          </p>
          <span className="module-card__role">Admin only</span>
        </button>

        <button
          type="button"
          className="module-card module-card--link"
          onClick={() => navigate('/modules/crm/config/company-access')}
          style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
        >
          <h3>Company Access</h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-2)' }}>
            Choose which CRM Basic Users can see and interact with each company.
            CRM Admins always see every company.
          </p>
          <span className="module-card__role">Admin only</span>
        </button>
      </div>
    </PageLayout>
  );
}
