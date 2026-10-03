// Kettera Corp Portal — route table.
//
// Public routes (rendered outside ProtectedRoute):
//   /login          — sign-in form
//   /access-denied  — signed-in but not a portal user
//
// Protected routes (require Firebase auth + portal_user row):
//   /              — redirects to /dashboard
//   /dashboard     — welcome + module cards
//   /users, /users/:id, /users/add — User Management
//   /modules/crm/...                — CRM
//   /modules/project-management/... — Project Management
//   /modules/:code — placeholder for modules not built yet
//
// Catch-all → redirect signed-in users to /dashboard, unauth'd to /login.

import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './components/Login.jsx';
import AccessDenied from './components/AccessDenied.jsx';
import Dashboard from './components/Dashboard.jsx';
import Placeholder from './components/Placeholder.jsx';
import Users from './components/Users.jsx';
import UserDetail from './components/UserDetail.jsx';
import AddUser from './components/AddUser.jsx';
import Companies from './components/crm/Companies.jsx';
import AddCompany from './components/crm/AddCompany.jsx';
import CompanyPageShell from './components/crm/CompanyPageShell.jsx';
import CompanyOverview from './components/crm/CompanyOverview.jsx';
import CompanyContacts from './components/crm/CompanyContacts.jsx';
import CompanyOpportunities from './components/crm/CompanyOpportunities.jsx';
import CompanyActivity from './components/crm/CompanyActivity.jsx';
import CompanyDocuments from './components/crm/CompanyDocuments.jsx';
import DocumentUploadForm from './components/crm/DocumentUploadForm.jsx';
import DocumentDetail from './components/crm/DocumentDetail.jsx';
import AddContact from './components/crm/AddContact.jsx';
import ContactDetail from './components/crm/ContactDetail.jsx';
import CrmConfig from './components/crm/CrmConfig.jsx';
import ActivityForm from './components/crm/ActivityForm.jsx';
import OpportunityForm from './components/crm/OpportunityForm.jsx';
import Projects from './components/pm/Projects.jsx';
import ProjectForm from './components/pm/ProjectForm.jsx';
import PmConfig from './components/pm/PmConfig.jsx';
import ModuleUsers from './components/modules/ModuleUsers.jsx';
import AddModuleUser from './components/modules/AddModuleUser.jsx';
import ModuleCompanyAccess from './components/modules/ModuleCompanyAccess.jsx';
import { CRM_MODULE, PM_MODULE } from './components/modules/moduleConfigs.js';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/access-denied" element={<AccessDenied />} />

      {/* Protected */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/dashboard"
        element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
      />

      {/* User Management */}
      <Route
        path="/users"
        element={<ProtectedRoute><Users /></ProtectedRoute>}
      />
      <Route
        path="/users/add"
        element={<ProtectedRoute><AddUser /></ProtectedRoute>}
      />
      <Route
        path="/users/:id"
        element={<ProtectedRoute><UserDetail /></ProtectedRoute>}
      />

      {/* CRM — company list + Add + Config + module-user management.
          The users + company-access screens are shared with Project
          Management; the `key` makes React remount them when moving
          between modules instead of carrying state across. */}
      <Route
        path="/modules/crm"
        element={<ProtectedRoute><Companies /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/add"
        element={<ProtectedRoute><AddCompany /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/config"
        element={<ProtectedRoute><CrmConfig /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/config/company-access"
        element={<ProtectedRoute><ModuleCompanyAccess key="crm" module={CRM_MODULE} /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/users"
        element={<ProtectedRoute><ModuleUsers key="crm" module={CRM_MODULE} /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/users/add"
        element={<ProtectedRoute><AddModuleUser key="crm" module={CRM_MODULE} /></ProtectedRoute>}
      />

      {/* Company detail — nested tab shell.
          The parent element (CompanyPageShell) renders PageLayout,
          the sticky tab strip, and an <Outlet /> for the tab body.
          Nested children ARE the tab bodies — they render inside
          the shell via <Outlet /> and get the loaded company via
          useOutletContext, no re-fetching per tab switch. */}
      <Route
        path="/modules/crm/companies/:id"
        element={<ProtectedRoute><CompanyPageShell /></ProtectedRoute>}
      >
        <Route index element={<CompanyOverview />} />
        <Route path="contacts" element={<CompanyContacts />} />
        <Route path="opportunities" element={<CompanyOpportunities />} />
        <Route path="activities" element={<CompanyActivity />} />
        <Route path="documents" element={<CompanyDocuments />} />
      </Route>

      {/* Forms + drill-in detail pages live OUTSIDE the tab shell
          so they get their own focused PageLayout. Save/Cancel
          routes back to whichever tab is contextually right. */}
      <Route
        path="/modules/crm/companies/:id/contacts/add"
        element={<ProtectedRoute><AddContact /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/:id/contacts/:contactId"
        element={<ProtectedRoute><ContactDetail /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/:id/opportunities/new"
        element={<ProtectedRoute><OpportunityForm /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/:id/opportunities/:oppId"
        element={<ProtectedRoute><OpportunityForm /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/:id/activities/new"
        element={<ProtectedRoute><ActivityForm /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/:id/activities/:activityId"
        element={<ProtectedRoute><ActivityForm /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/:id/documents/upload"
        element={<ProtectedRoute><DocumentUploadForm /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/:id/documents/:docId"
        element={<ProtectedRoute><DocumentDetail /></ProtectedRoute>}
      />

      {/* Project Management — project list (grouped by CRM company) +
          create/edit form + Config + module-user management. Declared
          before the /modules/:code placeholder below. */}
      <Route
        path="/modules/project-management"
        element={<ProtectedRoute><Projects /></ProtectedRoute>}
      />
      <Route
        path="/modules/project-management/projects/new"
        element={<ProtectedRoute><ProjectForm key="new" /></ProtectedRoute>}
      />
      <Route
        path="/modules/project-management/projects/:projectId"
        element={<ProtectedRoute><ProjectForm key="edit" /></ProtectedRoute>}
      />
      <Route
        path="/modules/project-management/config"
        element={<ProtectedRoute><PmConfig /></ProtectedRoute>}
      />
      <Route
        path="/modules/project-management/config/company-access"
        element={<ProtectedRoute><ModuleCompanyAccess key="pm" module={PM_MODULE} /></ProtectedRoute>}
      />
      <Route
        path="/modules/project-management/users"
        element={<ProtectedRoute><ModuleUsers key="pm" module={PM_MODULE} /></ProtectedRoute>}
      />
      <Route
        path="/modules/project-management/users/add"
        element={<ProtectedRoute><AddModuleUser key="pm" module={PM_MODULE} /></ProtectedRoute>}
      />

      <Route
        path="/modules/:code"
        element={
          <ProtectedRoute>
            <Placeholder
              title="Module"
              phase="later"
              message="Individual modules (Timekeeping, Accounting, ...) each get their own implementation plan."
            />
          </ProtectedRoute>
        }
      />

      {/* Unknown path — send authed users to their dashboard; the
          protected wrapper will redirect unauth'd traffic to /login. */}
      <Route
        path="*"
        element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>}
      />
    </Routes>
  );
}
