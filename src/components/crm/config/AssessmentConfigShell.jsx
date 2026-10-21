// CRM Configuration → Assessments: the tab shell for the question
// bank, question sets, assessments and scoring. Editors open on their
// own pages; the lists render here under the tab strip.

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import PageLayout from '../../PageLayout.jsx';
import { CONFIG_BASE } from './paths.js';
import { useRequireCrmAdmin } from './useRequireCrmAdmin.js';

export default function AssessmentConfigShell() {
  const navigate = useNavigate();
  useRequireCrmAdmin();
  const tabClass = ({ isActive }) => `tab-strip__tab${isActive ? ' is-active' : ''}`;

  return (
    <PageLayout
      title="CRM — Assessments"
      actions={
        <button type="button" className="cancel-button" onClick={() => navigate('/modules/crm/config')}>
          Back to Configuration
        </button>
      }
    >
      <nav className="tab-strip" aria-label="Assessment configuration sections">
        <NavLink to={CONFIG_BASE} end className={tabClass}>Assessments</NavLink>
        <NavLink to={`${CONFIG_BASE}/sets`} className={tabClass}>Question sets</NavLink>
        <NavLink to={`${CONFIG_BASE}/questions`} className={tabClass}>Questions</NavLink>
        <NavLink to={`${CONFIG_BASE}/scoring`} className={tabClass}>Scoring</NavLink>
      </nav>
      <Outlet />
    </PageLayout>
  );
}
