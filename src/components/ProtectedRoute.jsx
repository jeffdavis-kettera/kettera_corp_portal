// ProtectedRoute — the gate every non-public route wraps.
//
// Renders spinner → login redirect → access-denied redirect → children,
// depending on the auth + portal-user state. Nothing behind this
// mounts until BOTH a Firebase user AND a portal_user row are
// confirmed present.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { usePortalUser } from '../contexts/PortalUserContext.jsx';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { currentUser, loading: authLoading } = useAuth();
  const { portalUser, loading: portalLoading, accessDenied, error } = usePortalUser();

  if (authLoading || (currentUser && portalLoading)) {
    return <div className="spinner" role="status" aria-label="Loading" />;
  }

  if (!currentUser) {
    // Preserve where the user was trying to go so login can bounce
    // them there after they authenticate.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (accessDenied) {
    return <Navigate to="/access-denied" replace />;
  }

  if (error) {
    // Non-403 error contacting /session/me. Render a lightweight
    // inline banner instead of hiding the whole app.
    return (
      <div className="public-page">
        <div className="public-card">
          <h1 className="public-card__brand">Kettera Corp Portal</h1>
          <div className="error-message">
            <p><strong>Could not verify your access.</strong></p>
            <p>{error.message}</p>
          </div>
          <p className="public-card__subtitle">Try refreshing the page. If the problem persists, contact an administrator.</p>
        </div>
      </div>
    );
  }

  if (!portalUser) {
    // Belt and suspenders: portal-user context is still resolving,
    // don't render children mid-hydration.
    return <div className="spinner" role="status" aria-label="Loading" />;
  }

  return children;
}
