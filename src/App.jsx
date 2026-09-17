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

      {/* Phase 4 lands the real screens; scaffolding for now so
          links from the sidebar don't 404. */}
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Placeholder
              title="User Management"
              phase="4"
              message="The user list, detail view, and Add User flow arrive in Phase 4."
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/add"
        element={
          <ProtectedRoute>
            <Placeholder
              title="Add User"
              phase="4"
              message="The Firebase-search-based Add User flow arrives in Phase 4."
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/:id"
        element={
          <ProtectedRoute>
            <Placeholder
              title="User Detail"
              phase="4"
              message="Per-user editing and role assignment arrives in Phase 4."
            />
          </ProtectedRoute>
        }
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
