// A module's AI drafting switch (/modules/<module>/config/ai-drafting).
// Shared by every module in moduleConfigs.js that has an `aiApi`. The
// model connection and voice are application-wide (Administration →
// AI Drafting, application Admins); this page only decides whether
// THIS module uses them, and tells the module's admins whether the
// application side is ready yet.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { usePortalUser } from '../../contexts/PortalUserContext.jsx';
import { useModuleRole } from './useModuleRole.js';

export default function ModuleAiDrafting({ module }) {
  const { code, label, homePath, configPath, aiApi, aiUsage } = module;
  const navigate = useNavigate();
  const { isModuleAdmin } = useModuleRole(code);
  const { isAppAdmin } = usePortalUser();
  const url = `${API_BASE_URL}${aiApi}`;

  useEffect(() => {
    if (!isModuleAdmin) navigate(homePath, { replace: true });
  }, [isModuleAdmin, navigate, homePath]);

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setState(await authenticatedFetchJson(url));
    } catch (err) {
      setError(err.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => { if (isModuleAdmin) load(); }, [load, isModuleAdmin]);

  async function setEnabled(enabled) {
    if (saving) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      setState(await authenticatedFetchJson(url, { method: 'PUT', body: { enabled } }));
      setSuccess(enabled ? `AI drafting is on for ${label}.` : `AI drafting is off for ${label}.`);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const back = (
    <button type="button" className="cancel-button" onClick={() => navigate(configPath)}>
      Back to Configuration
    </button>
  );
  if (!isModuleAdmin) return null;
  if (loading) return <PageLayout title={`${label} — AI Drafting`} actions={back}><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  if (!state) return <PageLayout title={`${label} — AI Drafting`} actions={back}><div className="error-message"><p>{error || 'Unavailable.'}</p></div></PageLayout>;

  return (
    <PageLayout title={`${label} — AI Drafting`} actions={back}>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        Whether {label} uses the portal's AI drafting. When on, it appears on {aiUsage}. The model connection and the
        voice are application-wide and set by an application Admin under Administration → AI Drafting.
      </p>

      {!state.app.ready && (
        <div className="info-banner" role="note">
          <strong>The application side isn't ready yet.</strong> {state.app.reason}
          {isAppAdmin && <>{' '}<Link to="/ai-drafting">Open AI Drafting settings</Link>.</>}
          {' '}You can still set the switch here; it takes effect once the application side is ready.
        </div>
      )}
      {error && <div className="error-message"><p>{error}</p></div>}
      {success && <div className="success-message"><p>{success}</p></div>}

      <PageCard>
        <label className="checkbox-inline" style={{ margin: 0 }}>
          <input type="checkbox" checked={state.module.enabled} disabled={saving} onChange={(e) => setEnabled(e.target.checked)} />
          <span>
            <strong>Use AI drafting in {label}</strong>
            <br />
            <span className="muted">
              {state.module.enabled
                ? (state.app.ready ? 'On — the AI buttons are showing.' : 'On — the AI buttons will show once the application side is ready.')
                : 'Off — no AI buttons anywhere in this module.'}
            </span>
          </span>
        </label>
      </PageCard>
    </PageLayout>
  );
}
