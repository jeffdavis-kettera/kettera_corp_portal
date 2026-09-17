// PortalUserContext — the "am I allowed in Corp Portal?" layer.
//
// Runs AFTER AuthContext. When a Firebase user is present, calls
// GET /session/me and exposes:
//   portalUser     — { id, email, displayName, appRole, modules } or null
//   appRole        — 'Admin' | 'BasicUser' | null
//   modules        — [{ id, code, name, role }, ...]
//   isAppAdmin     — boolean shortcut
//   loading        — true during the /session/me fetch
//   accessDenied   — true iff /session/me returned 403 not_a_portal_user
//                    or 403 portal_user_suspended
//   suspended      — true iff status is Suspended (subset of accessDenied)
//   error          — Error object for anything OTHER than an access-denied 403
//   refresh()      — re-fetch /session/me (e.g. after an app-Admin changes
//                    your role in another tab)
//
// A 403 with an unexpected code, or anything non-200 non-403, becomes
// `error` — the UI can render a real error state instead of the
// "access denied" screen.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '../utils/config.js';
import { authenticatedFetchJson } from '../utils/api.js';
import { useAuth } from './AuthContext.jsx';

const PortalUserContext = createContext(null);

const ACCESS_DENIED_CODES = new Set([
  'not_a_portal_user',
  'portal_user_suspended',
]);

export function PortalUserProvider({ children }) {
  const { currentUser, loading: authLoading } = useAuth();
  const [portalUser, setPortalUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!currentUser) {
      setPortalUser(null);
      setAccessDenied(false);
      setSuspended(false);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    setSuspended(false);
    try {
      const data = await authenticatedFetchJson(`${API_BASE_URL}/session/me`);
      setPortalUser(data);
    } catch (err) {
      if (err.status === 403 && ACCESS_DENIED_CODES.has(err.code)) {
        setPortalUser(null);
        setAccessDenied(true);
        setSuspended(err.code === 'portal_user_suspended');
      } else {
        setError(err);
        setPortalUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Auto-load on Firebase auth state change.
  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const value = {
    portalUser,
    appRole: portalUser?.appRole ?? null,
    modules: portalUser?.modules ?? [],
    isAppAdmin: portalUser?.appRole === 'Admin',
    loading: authLoading || loading,
    accessDenied,
    suspended,
    error,
    refresh: load,
  };

  return (
    <PortalUserContext.Provider value={value}>
      {children}
    </PortalUserContext.Provider>
  );
}

export function usePortalUser() {
  const ctx = useContext(PortalUserContext);
  if (!ctx) throw new Error('usePortalUser must be used inside <PortalUserProvider>');
  return ctx;
}
