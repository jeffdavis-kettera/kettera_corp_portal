// Login — the one public route. Firebase email+password sign-in.
//
// On success:
//   - Firebase's onAuthStateChanged fires → AuthContext updates
//   - PortalUserContext auto-loads /session/me
//   - This component navigates to /dashboard (or the ?from= location
//     ProtectedRoute preserved earlier)
//
// No signup link. Portal users are added by an Admin.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { usePortalUser } from '../contexts/PortalUserContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loading: authLoading, login } = useAuth();
  const { portalUser, loading: portalLoading, accessDenied } = usePortalUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const fromPath = location.state?.from?.pathname || '/dashboard';

  // Already signed in and resolved as a portal user — bounce forward.
  // Also handles the case where a user hits /login while already
  // authenticated: don't strand them on the login screen.
  useEffect(() => {
    if (authLoading || portalLoading) return;
    if (currentUser && portalUser) navigate(fromPath, { replace: true });
    if (currentUser && accessDenied) navigate('/access-denied', { replace: true });
  }, [authLoading, portalLoading, currentUser, portalUser, accessDenied, fromPath, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // The useEffect above handles the redirect once contexts update.
    } catch (err) {
      // Firebase error codes we choose to translate for the user.
      const msg = translateFirebaseError(err.code) || err.message;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="public-page">
      <div className="public-card">
        <h1 className="public-card__brand">Kettera Corp Portal</h1>
        <p className="public-card__subtitle">Sign in with your Kettera account.</p>

        {error && (
          <div className="error-message"><p>{error}</p></div>
        )}

        <form onSubmit={handleSubmit} className="form-stack" autoComplete="on">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

function translateFirebaseError(code) {
  switch (code) {
    case 'auth/invalid-email':        return 'That doesn\'t look like a valid email address.';
    case 'auth/user-disabled':        return 'This account has been disabled. Contact an administrator.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':   return 'Email or password is incorrect.';
    case 'auth/too-many-requests':    return 'Too many sign-in attempts. Please wait a minute and try again.';
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
    default: return null;
  }
}
