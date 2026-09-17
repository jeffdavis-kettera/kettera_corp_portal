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

      <Route
        path="/modules/:code"
        element={
          <ProtectedRoute>
            <Placeholder
              title="Module"
              phase="later"
              message="Individual modules (CRM, Project Management, Timekeeping, ...) each get their own implementation plan."
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
