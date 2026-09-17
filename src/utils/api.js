// API helpers.
//
// authenticatedFetchJson  — send a JSON request, get parsed JSON back;
//                           throws an Error with .status + .code +
//                           .details on non-OK responses.
// authenticatedFetch      — same auth headers, raw Response back (used
//                           by callers that need to inspect status
//                           codes or read streams).
//
// Every request carries:
//   Authorization: Bearer <Firebase ID token>
//   X-App-Type: corp-portal
//
// Token acquisition is via getAuth().currentUser.getIdToken() — same
// as Navigator's pattern but a fresh copy in THIS repo per the
// independence rule.

import { auth } from '../firebase/config.js';

async function idToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  return user.getIdToken();
}

async function buildHeaders(extra = {}) {
  const token = await idToken();
  return {
    'Authorization': `Bearer ${token}`,
    'X-App-Type': 'corp-portal',
    ...extra,
  };
}

/**
 * Parse a Response body into an Error, matching the API's error shape
 * `{ error, code, status, details? }`. Attaches those fields to the
 * thrown Error so callers can branch on err.status / err.code.
 */
async function throwFromResponse(res) {
  let body = null;
  try { body = await res.json(); } catch { /* body wasn't JSON */ }
  const err = new Error(body?.error || `Request failed with status ${res.status}.`);
  err.status = res.status;
  err.code = body?.code || 'unknown_error';
  if (body?.details !== undefined) err.details = body.details;
  throw err;
}

/**
 * JSON in, JSON out. Serializes `body` as JSON automatically when
 * it's a plain object.
 */
export async function authenticatedFetchJson(url, options = {}) {
  const method = options.method || 'GET';
  const hasBody = options.body !== undefined && options.body !== null;
  const headers = await buildHeaders({
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  });
  const init = { ...options, method, headers };
  if (hasBody && typeof options.body !== 'string' && !(options.body instanceof FormData)) {
    init.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, init);
  if (!res.ok) await throwFromResponse(res);
  // 204 No Content etc. — return null rather than blowing up on empty body.
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Raw fetch with auth headers. Caller inspects Response themselves.
 */
export async function authenticatedFetch(url, options = {}) {
  const headers = await buildHeaders(options.headers || {});
  return fetch(url, { ...options, headers });
}
