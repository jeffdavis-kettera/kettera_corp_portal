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
//   /modules/:code — per-module dashboards (later phases)
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
import AddContact from './components/crm/AddContact.jsx';
import ContactDetail from './components/crm/ContactDetail.jsx';
import CrmConfig from './components/crm/CrmConfig.jsx';
import CompanyAccess from './components/crm/CompanyAccess.jsx';
import CrmUsers from './components/crm/CrmUsers.jsx';
import AddCrmUser from './components/crm/AddCrmUser.jsx';
import ActivityForm from './components/crm/ActivityForm.jsx';
import OpportunityForm from './components/crm/OpportunityForm.jsx';

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

      {/* CRM — company list + Add + Config + module-user management */}
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
        element={<ProtectedRoute><CompanyAccess /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/users"
        element={<ProtectedRoute><CrmUsers /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/users/add"
        element={<ProtectedRoute><AddCrmUser /></ProtectedRoute>}
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
        path="/modules/:code"
        element={
          <ProtectedRoute>
            <Placeholder
              title="Module"
              phase="later"
              message="Individual modules (Project Management, Timekeeping, Accounting, ...) each get their own implementation plan."
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
