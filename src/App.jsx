// Kettera Corp Portal — placeholder App shell.
//
// Phase-0 scaffolding: enough React + Router to produce a real build
// artifact and confirm the deploy pipeline lands somewhere reachable.
// Real routes (/login, /access-denied, /dashboard, /users, /users/:id,
// /users/add), Firebase auth, PortalUserContext, and ProtectedRoute
// all land in Phase 3 per the plan doc.

import { Routes, Route } from 'react-router-dom';

function Placeholder() {
  return (
    <main className="placeholder">
      <div className="placeholder__card">
        <h1>Kettera Corp Portal</h1>
        <p className="placeholder__subtitle">
          Internal application for Kettera consulting services.
        </p>
        <p className="placeholder__note">
          This page is deployment scaffolding. Login, user management,
          and module screens land in Phase 3.
        </p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder />} />
      {/* Catch-all so Static Web Apps deep-links don't 404 on unknown
          paths while the real router is still being built out. */}
      <Route path="*" element={<Placeholder />} />
    </Routes>
  );
}
