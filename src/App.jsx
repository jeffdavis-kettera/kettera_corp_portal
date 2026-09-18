// Kettera Corp Portal — route table.
//
// Public routes (rendered outside ProtectedRoute):
//   /login          — sign-in form
//   /access-denied  — signed-in but not a portal user
//
// Protected routes (require Firebase auth + portal_user row):
//   /              — redirects to /dashboard
//   /dashboard     — welcome + module cards
//   /users, /users/:id, /users/add — User Management (Phase 4)
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
import CompanyDetail from './components/crm/CompanyDetail.jsx';
import AddContact from './components/crm/AddContact.jsx';
import ContactDetail from './components/crm/ContactDetail.jsx';
import CrmConfig from './components/crm/CrmConfig.jsx';
import CompanyAccess from './components/crm/CompanyAccess.jsx';
import CrmUsers from './components/crm/CrmUsers.jsx';
import AddCrmUser from './components/crm/AddCrmUser.jsx';
import CompanyActivity from './components/crm/CompanyActivity.jsx';
import ActivityForm from './components/crm/ActivityForm.jsx';

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

      {/* User Management (Phase 4). All three components additionally
          guard themselves on isAppAdmin — the sidebar link is only
          shown to Admins, but a stray URL redirects to /dashboard. */}
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

      {/* CRM module (real routes — MUST come before /modules/:code
          catch-all below, or the Placeholder swallows them). */}
      <Route
        path="/modules/crm"
        element={<ProtectedRoute><Companies /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/add"
        element={<ProtectedRoute><AddCompany /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/:id"
        element={<ProtectedRoute><CompanyDetail /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/:id/contacts/add"
        element={<ProtectedRoute><AddContact /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/companies/:id/contacts/:contactId"
        element={<ProtectedRoute><ContactDetail /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/config"
        element={<ProtectedRoute><CrmConfig /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/config/company-access"
        element={<ProtectedRoute><CompanyAccess /></ProtectedRoute>}
      />

      {/* CRM module-user management. Admin-only surfaces guarded
          inside each component via useCrmRole. */}
      <Route
        path="/modules/crm/users"
        element={<ProtectedRoute><CrmUsers /></ProtectedRoute>}
      />
      <Route
        path="/modules/crm/users/add"
        element={<ProtectedRoute><AddCrmUser /></ProtectedRoute>}
      />

      {/* CRM activity — full page + log/edit form. The /new
          static path is declared before /:activityId so route
          matching gets the specific pattern first. */}
      <Route
        path="/modules/crm/companies/:id/activities"
        element={<ProtectedRoute><CompanyActivity /></ProtectedRoute>}
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
