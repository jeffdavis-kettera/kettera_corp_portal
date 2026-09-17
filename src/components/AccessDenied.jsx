// AccessDenied — public route rendered when a signed-in Firebase
// user has no active portal_user row.
//
// Two flavors:
//   1. accessDenied=true, suspended=false → not_a_portal_user
//   2. accessDenied=true, suspended=true → portal_user_suspended
//
// Both cases surface a sign-out button (crucial — otherwise the user
// is stuck; every route redirects here as long as Firebase auth is
// live but the portal-user resolve fails).

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { usePortalUser } from '../contexts/PortalUserContext.jsx';

export default function AccessDenied() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { suspended } = usePortalUser();

  async function handleSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  const heading = suspended ? 'Access suspended' : 'Access not granted';
  const body = suspended
    ? 'Your Kettera Corp Portal access has been suspended. Contact a Corp Portal administrator to have it restored.'
    : 'You are signed into Firebase but have not been granted access to Kettera Corp Portal. Contact a Corp Portal administrator to request access.';

  return (
    <div className="public-page">
      <div className="public-card">
        <h1 className="public-card__brand">Kettera Corp Portal</h1>
        <h2 style={{ marginTop: 0 }}>{heading}</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>{body}</p>
        {currentUser?.email && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Signed in as <strong>{currentUser.email}</strong>
          </p>
        )}
        <div className="form-actions" style={{ marginTop: 'var(--space-5)' }}>
          <button type="button" className="cancel-button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
