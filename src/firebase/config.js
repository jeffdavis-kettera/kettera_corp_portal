// Firebase client SDK initialization.
//
// Reads config from VITE_FIREBASE_* env vars at build time — these
// are baked into the bundle when Vite builds. Rotating requires a
// rebuild-and-redeploy (documented in the plan doc).
//
// Values are the PUBLIC config for the kettera-architect project —
// safe to appear in the bundle; Firebase Auth's security lives in
// server-side rules + the local portal_user gate, not in the api key.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Sanity check at boot — if any of the required fields is missing,
// fail loudly so a broken deploy is visible in the browser console
// instead of silently returning cryptic Firebase errors later.
const missing = Object.entries(firebaseConfig)
  .filter(([_, v]) => !v)
  .map(([k]) => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `Firebase config incomplete. Missing build-time env vars: ${missing.join(', ')}.\n` +
    `Set them in the Static Web Apps GitHub Actions workflow (env:) or ` +
    `in Azure portal → Static Web Apps → Configuration → ` +
    `Build environment variables, then rebuild.`
  );
}

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
