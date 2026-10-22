// Administration → AI Drafting: the model connection and the voice
// used when drafting text anywhere in the portal. Application Admins
// only. Modules decide for themselves whether to use it (each module's
// Configuration has its own switch); this screen shows which have.
//
// The API key is write-only: the screen shows whether one is stored
// (and its last four characters) and takes a replacement; it never
// reads the key back. "Test connection" sends one tiny prompt using
// the form's current values — saved or not — so a change can be
// checked before it's saved.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from './PageLayout.jsx';
import PageCard from './PageCard.jsx';
import { API_BASE_URL } from '../utils/config.js';
import { authenticatedFetchJson } from '../utils/api.js';
import { usePortalUser } from '../contexts/PortalUserContext.jsx';
import { formatDateTime } from './crm/opportunityStages.js';

const toForm = (c) => ({
  enabled: c.enabled, endpoint: c.endpoint, deployment: c.deployment, apiVersion: c.apiVersion, apiStyle: c.apiStyle,
  reasoningModel: c.reasoningModel, temperature: c.temperature == null ? '' : String(c.temperature),
  maxOutputTokens: String(c.maxOutputTokens), perspective: c.perspective, tone: c.tone, length: c.length,
  styleGuide: c.styleGuide, voiceSample: c.voiceSample,
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function AiDrafting() {
  const navigate = useNavigate();
  const { isAppAdmin } = usePortalUser();
  const url = `${API_BASE_URL}/llm-config`;

  useEffect(() => {
    if (!isAppAdmin) navigate('/dashboard', { replace: true });
  }, [isAppAdmin, navigate]);

  const [loaded, setLoaded] = useState(null);
  const [form, setForm] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fill = useCallback((c) => { setLoaded(c); setForm(toForm(c)); setApiKey(''); setClearKey(false); }, []);
  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    setError(null); setConflict(false);
    try {
      fill(await authenticatedFetchJson(url));
    } catch (err) {
      setError(err.message || 'Failed to load the AI drafting settings.');
    } finally {
      if (initial) setLoading(false);
    }
  }, [url, fill]);
  useEffect(() => { if (isAppAdmin) load({ initial: true }); }, [load, isAppAdmin]);

  const dirty = Boolean(loaded && form && (!same(form, toForm(loaded)) || apiKey !== '' || clearKey));
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (field, value) => { setSuccess(null); setForm((f) => ({ ...f, [field]: value })); };
  const payload = () => ({
    ...form,
    temperature: form.temperature === '' ? null : Number(form.temperature),
    maxOutputTokens: Number(form.maxOutputTokens),
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    ...(clearKey ? { clearApiKey: true } : {}),
  });

  async function handleSave(e) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true); setError(null); setSuccess(null); setConflict(false);
    try {
      fill(await authenticatedFetchJson(url, { method: 'PUT', body: { ...payload(), expectedVersion: loaded.version } }));
      setSuccess('Saved.');
    } catch (err) {
      if (err.status === 409) setConflict(true);
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true); setTestResult(null); setError(null);
    try {
      setTestResult(await authenticatedFetchJson(`${url}/test`, { method: 'POST', body: payload() }));
    } catch (err) {
      setTestResult({ ok: false, error: err.message || 'The test could not run.' });
    } finally {
      setTesting(false);
    }
  }

  if (!isAppAdmin) return null;
  if (loading) return <PageLayout title="AI Drafting"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  if (!loaded || !form) {
    return <PageLayout title="AI Drafting"><div className="error-message"><p>{error || 'Settings unavailable.'}</p></div></PageLayout>;
  }

  const style = loaded.options.apiStyles.find((s) => s.value === form.apiStyle);
  const needsVersion = form.apiStyle !== 'v1';
  const urlPreview = style
    ? style.hint.replace('{endpoint}', form.endpoint || '{endpoint}').replace('{deployment}', form.deployment || '{deployment}').replace('{apiVersion}', form.apiVersion || '{apiVersion}')
    : '';
  const modulesOn = loaded.modules.filter((m) => m.enabled);

  return (
    <PageLayout title="AI Drafting">
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        The model the portal uses to draft text, and the voice it writes in. This is application-wide; each module's
        admins decide whether their module uses it from that module's Configuration. People edit and save whatever the
        model drafts; nothing it writes is saved on its own.
      </p>

      {!loaded.canStoreKey && (
        <div className="error-message">
          <p>
            The API has no <code>{loaded.secretsEnv}</code> setting, so it can't store the model API key yet. Add a 32-byte
            base64 key to the API's environment (App Service → Application settings) and restart it; everything else here
            can be saved now.
          </p>
        </div>
      )}
      {error && (
        <div className="error-message">
          <p>{error}{conflict && <>{' '}<button type="button" className="link-button" onClick={() => load()}>Reload</button></>}</p>
        </div>
      )}
      {success && <div className="success-message"><p>{success}</p></div>}

      <form onSubmit={handleSave}>
        <PageCard style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ marginTop: 0 }}>Connection</h3>
          <label className="checkbox-inline">
            <input type="checkbox" checked={form.enabled} disabled={saving} onChange={(e) => set('enabled', e.target.checked)} />
            <span><strong>Drafting is on for the application</strong> <span className="muted">— off hides the AI buttons everywhere, whatever the modules say.</span></span>
          </label>

          <div className="form-stack">
            <div className="form-group">
              <label htmlFor="apiStyle">Endpoint type</label>
              <select id="apiStyle" value={form.apiStyle} disabled={saving} onChange={(e) => set('apiStyle', e.target.value)}>
                {loaded.options.apiStyles.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <small className="muted" style={{ wordBreak: 'break-all' }}>Request goes to: {urlPreview}</small>
            </div>
            <div className="form-group">
              <label htmlFor="endpoint">Endpoint</label>
              <input id="endpoint" type="url" value={form.endpoint} maxLength={500} disabled={saving} placeholder="https://my-resource.openai.azure.com"
                     onChange={(e) => set('endpoint', e.target.value)} />
              <small className="muted">The resource's base URL from Foundry, without the path.</small>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="deployment">Deployment name</label>
                <input id="deployment" type="text" value={form.deployment} maxLength={200} disabled={saving} placeholder="e.g. gpt-4o-proposals"
                       onChange={(e) => set('deployment', e.target.value)} />
                <small className="muted">The deployment's name in Foundry, not the model family.</small>
              </div>
              <div className="form-group">
                <label htmlFor="apiVersion">API version</label>
                <input id="apiVersion" type="text" value={form.apiVersion} maxLength={50} disabled={saving || !needsVersion} placeholder="2024-10-21"
                       onChange={(e) => set('apiVersion', e.target.value)} />
                <small className="muted">{needsVersion ? 'From the endpoint\'s sample code in Foundry.' : 'Not used by the v1 path.'}</small>
              </div>
            </div>

            <label className="checkbox-inline">
              <input type="checkbox" checked={form.reasoningModel} disabled={saving} onChange={(e) => set('reasoningModel', e.target.checked)} />
              <span><strong>Reasoning model</strong> <span className="muted">(gpt-5, o-series) — sends no temperature and uses max_completion_tokens.</span></span>
            </label>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="temperature">Temperature</label>
                <input id="temperature" type="number" min="0" max="2" step="0.1" value={form.temperature} disabled={saving || form.reasoningModel}
                       placeholder="model default" onChange={(e) => set('temperature', e.target.value)} />
                <small className="muted">Lower is more predictable; 0.3–0.5 suits proposals. Blank uses the model default.</small>
              </div>
              <div className="form-group">
                <label htmlFor="maxOutputTokens">Max output tokens</label>
                <input id="maxOutputTokens" type="number" min="100" max="32000" step="100" value={form.maxOutputTokens} disabled={saving}
                       onChange={(e) => set('maxOutputTokens', e.target.value)} />
                <small className="muted">Per section. Reasoning models spend some of this before writing — give them more.</small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="apiKey">API key</label>
              <p className="muted" style={{ margin: '0 0 var(--space-2)' }}>
                {loaded.apiKeySet
                  ? <>A key is stored (ends in <code>{loaded.apiKeyHint}</code>). It's encrypted and never shown again; enter a new one to replace it.</>
                  : 'No key stored yet.'}
              </p>
              <input id="apiKey" type="password" autoComplete="new-password" value={apiKey} maxLength={500}
                     disabled={saving || clearKey || !loaded.canStoreKey}
                     placeholder={loaded.apiKeySet ? 'Enter a new key to replace the stored one' : 'Paste the key from Foundry'}
                     onChange={(e) => { setSuccess(null); setApiKey(e.target.value); }} />
              {loaded.apiKeySet && (
                <label className="checkbox-inline" style={{ marginTop: 'var(--space-2)' }}>
                  <input type="checkbox" checked={clearKey} disabled={saving} onChange={(e) => { setSuccess(null); setClearKey(e.target.checked); if (e.target.checked) setApiKey(''); }} />
                  <span>Remove the stored key on save (turns drafting off)</span>
                </label>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
            <button type="button" className="cancel-button" onClick={handleTest} disabled={testing || saving}>
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            <span className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              Sends one tiny prompt with the values above{apiKey.trim() ? ' and the key you typed' : loaded.apiKeySet ? ' and the stored key' : ''}. Nothing is saved.
            </span>
          </div>
          {testResult && (
            <div className={testResult.ok ? 'success-message' : 'error-message'} style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
              <p>
                {testResult.ok
                  ? <>Connected in {testResult.latencyMs} ms — the model{testResult.model ? ` (${testResult.model})` : ''} replied “{testResult.reply}”.</>
                  : testResult.error}
              </p>
              {testResult.url && <p className="muted" style={{ margin: 0, fontSize: 'var(--font-size-xs)', wordBreak: 'break-all' }}>Request: {testResult.url}</p>}
            </div>
          )}
        </PageCard>

        <PageCard style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ marginTop: 0 }}>Voice</h3>
          <p className="muted" style={{ marginTop: 0 }}>How the drafts should read. The presets become instructions to the model; the house style and sample are passed along word for word.</p>
          <div className="form-stack">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="perspective">Perspective</label>
                <select id="perspective" value={form.perspective} disabled={saving} onChange={(e) => set('perspective', e.target.value)}>
                  {loaded.options.perspectives.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="tone">Tone</label>
                <select id="tone" value={form.tone} disabled={saving} onChange={(e) => set('tone', e.target.value)}>
                  {loaded.options.tones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="length">Length</label>
                <select id="length" value={form.length} disabled={saving} onChange={(e) => set('length', e.target.value)}>
                  {loaded.options.lengths.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="styleGuide">House style</label>
              <textarea id="styleGuide" rows="5" value={form.styleGuide} maxLength={8000} disabled={saving}
                        placeholder={'Rules the drafts must follow, one per line. For example:\nNever mention pricing or discounts.\nCall the client by their company name, never "the client".\nNo buzzwords: synergy, leverage, best-in-class.'}
                        onChange={(e) => set('styleGuide', e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="voiceSample">Voice sample</label>
              <textarea id="voiceSample" rows="7" value={form.voiceSample} maxLength={8000} disabled={saving}
                        placeholder="Paste a few paragraphs from a proposal you were happy with. The model matches the style, not the content."
                        onChange={(e) => set('voiceSample', e.target.value)} />
            </div>
          </div>
        </PageCard>

        <PageCard style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ marginTop: 0 }}>Where it's used</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Each module's admins turn drafting on or off for their module from that module's Configuration.
            {modulesOn.length === 0 && ' No module has turned it on yet.'}
          </p>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
            {loaded.modules.map((m) => (
              <li key={m.code}>
                <strong>{m.name}</strong> — {m.enabled ? 'on' : 'off'}
                {m.code === 'CRM' && m.enabled && <span className="muted"> (opportunity Proposal tab)</span>}
              </li>
            ))}
          </ul>
        </PageCard>

        <PageCard style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ marginTop: 0 }}>What the model is told</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            The standing instructions built from the <strong>saved</strong> voice settings. Each request adds the record's context and the section to write.
          </p>
          <pre className="prompt-preview">{loaded.systemPrompt}</pre>
        </PageCard>

        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>
            {loaded.updatedAt ? <>Saved {formatDateTime(loaded.updatedAt)}{loaded.updatedByName ? ` by ${loaded.updatedByName}` : ''}</> : 'Not saved yet'}
          </span>
          <span>
            {dirty && (
              <button type="button" className="cancel-button" onClick={() => { fill(loaded); setSuccess(null); }} disabled={saving} style={{ marginRight: 'var(--space-3)' }}>
                Discard changes
              </button>
            )}
            <button type="submit" className="save-button" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          </span>
        </div>
      </form>
    </PageLayout>
  );
}
