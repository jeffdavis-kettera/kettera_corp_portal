// Scoring tab — per tool: the thresholds, which assessments it shows
// and in what order, every question it scores with a summary of its
// signals, and a preview of the grid for a real opportunity under the
// current rules.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageCard from '../../PageCard.jsx';
import OrderedPicker from './OrderedPicker.jsx';
import ScopingGrid from '../opportunityTools/scoping/ScopingGrid.jsx';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson } from '../../../utils/api.js';
import { CONFIG_BASE } from './paths.js';

export default function ScoringPage() {
  const [tools, setTools] = useState([]);
  const [toolKey, setToolKey] = useState('');
  const [data, setData] = useState(null);     // GET /crm/config/scoring/:toolKey
  const [allAssessments, setAllAssessments] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [settings, setSettings] = useState(null);
  const [assessmentIds, setAssessmentIds] = useState([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Preview
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [opportunities, setOpportunities] = useState([]);
  const [opportunityId, setOpportunityId] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, a, c, co] = await Promise.all([
          authenticatedFetchJson(`${API_BASE_URL}/crm/config/scoring`),
          authenticatedFetchJson(`${API_BASE_URL}/crm/config/assessments`),
          authenticatedFetchJson(`${API_BASE_URL}/crm/service-offerings`),
          authenticatedFetchJson(`${API_BASE_URL}/crm/companies?limit=200&offset=0`),
        ]);
        if (cancelled) return;
        setTools(t.tools || []);
        setAllAssessments(a.assessments || []);
        setCatalog(c.services || []);
        setCompanies(co.companies || []);
        setToolKey(t.tools?.[0]?.key || '');
        if (!t.tools?.length) setLoading(false);
      } catch (err) {
        if (!cancelled) { setError(err.message || 'Failed to load scoring.'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadTool = useCallback(async (key) => {
    if (!key) return;
    setError(null);
    try {
      const d = await authenticatedFetchJson(`${API_BASE_URL}/crm/config/scoring/${key}`);
      setData(d);
      setSettings(d.settings);
      setAssessmentIds(d.assessments.map((a) => a.id));
    } catch (err) {
      setError(err.message || 'Failed to load scoring.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadTool(toolKey); }, [toolKey, loadTool]);

  useEffect(() => {
    setOpportunities([]); setOpportunityId(''); setPreview(null);
    if (!companyId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const d = await authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}/opportunities?limit=200`);
        if (!cancelled) setOpportunities(d.opportunities || []);
      } catch { /* leave empty */ }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const settingsDirty = data && JSON.stringify(settings) !== JSON.stringify(data.settings);
  const orderDirty = data && JSON.stringify(assessmentIds) !== JSON.stringify(data.assessments.map((a) => a.id));

  async function saveSettings(e) {
    e.preventDefault();
    if (!settingsDirty || savingSettings) return;
    setSavingSettings(true); setError(null); setSuccess(null);
    try {
      const d = await authenticatedFetchJson(`${API_BASE_URL}/crm/config/scoring/${toolKey}/settings`, { method: 'PUT', body: { settings } });
      setData(d); setSettings(d.settings);
      setSuccess('Thresholds saved. Every opportunity now rates under the new rules.');
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveOrder() {
    if (!orderDirty || savingOrder) return;
    setSavingOrder(true); setError(null); setSuccess(null);
    try {
      const d = await authenticatedFetchJson(`${API_BASE_URL}/crm/config/scoring/${toolKey}/assessments`, { method: 'PUT', body: { assessmentIds } });
      setData(d); setAssessmentIds(d.assessments.map((a) => a.id));
      setSuccess('Assessments saved.');
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSavingOrder(false);
    }
  }

  async function runPreview() {
    if (!companyId || !opportunityId || previewing) return;
    setPreviewing(true); setError(null);
    try {
      setPreview(await authenticatedFetchJson(`${API_BASE_URL}/crm/config/scoring/${toolKey}/preview?companyId=${companyId}&opportunityId=${opportunityId}`));
    } catch (err) {
      setError(err.message || 'Preview failed.');
    } finally {
      setPreviewing(false);
    }
  }

  const num = (path, v) => setSettings((s) => {
    const next = structuredClone(s);
    const [a, b] = path;
    next[a][b] = v === '' ? '' : Number(v);
    return next;
  });

  if (loading) return <div className="spinner" role="status" aria-label="Loading scoring" />;
  if (!tools.length) return <div className="no-users">No tool has scoring to configure.</div>;

  return (
    <>
      <div className="config-list-head">
        <div>
          <h2 style={{ margin: 0 }}>Scoring</h2>
          <p className="muted" style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>
            Changes apply immediately: ratings are computed on read, so every opportunity reflects the new rules at once.
            Services already chosen keep the snapshot they were chosen with, and the tool flags the drift.
          </p>
        </div>
        {tools.length > 1 && (
          <select value={toolKey} onChange={(e) => setToolKey(e.target.value)} className="filter-input" style={{ width: 'auto' }} aria-label="Tool">
            {tools.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
          </select>
        )}
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}
      {success && <div className="success-message"><p>{success}</p></div>}

      {data && (
        <>
          <PageCard className="profile-card--form" style={{ margin: '0 0 var(--space-5)', maxWidth: 'none' }}>
            <h3 style={{ marginTop: 0 }}>{data.tool.title}: thresholds</h3>
            <form onSubmit={saveSettings} className="form-stack">
              <div className="threshold-grid">
                <div className="form-group">
                  <label htmlFor="strong">Strong from (rating, 0–100)</label>
                  <input id="strong" type="number" min="0" max="100" step="1" value={settings.bands.strong} onChange={(e) => num(['bands', 'strong'], e.target.value)} disabled={savingSettings} />
                </div>
                <div className="form-group">
                  <label htmlFor="moderate">Moderate from</label>
                  <input id="moderate" type="number" min="0" max="100" step="1" value={settings.bands.moderate} onChange={(e) => num(['bands', 'moderate'], e.target.value)} disabled={savingSettings} />
                </div>
                <div className="form-group">
                  <label htmlFor="high">High confidence from (share answered, 0–1)</label>
                  <input id="high" type="number" min="0" max="1" step="0.05" value={settings.confidence.high} onChange={(e) => num(['confidence', 'high'], e.target.value)} disabled={savingSettings} />
                </div>
                <div className="form-group">
                  <label htmlFor="medium">Medium confidence from</label>
                  <input id="medium" type="number" min="0" max="1" step="0.05" value={settings.confidence.medium} onChange={(e) => num(['confidence', 'medium'], e.target.value)} disabled={savingSettings} />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="save-button" disabled={!settingsDirty || savingSettings}>{savingSettings ? 'Saving…' : 'Save thresholds'}</button>
              </div>
            </form>
          </PageCard>

          <PageCard className="profile-card--form" style={{ margin: '0 0 var(--space-5)', maxWidth: 'none' }}>
            <h3 style={{ marginTop: 0 }}>Assessments shown, in order</h3>
            <OrderedPicker
              selectedIds={assessmentIds}
              available={allAssessments.map((a) => ({ id: a.id, label: a.title, sub: `${a.setCount} set${a.setCount === 1 ? '' : 's'}`, retired: a.retired }))}
              onChange={setAssessmentIds}
              searchPlaceholder="Add an assessment…"
              emptyText="This tool shows no assessments."
              disabled={savingOrder}
            />
            <div className="form-actions">
              <button type="button" className="save-button" onClick={saveOrder} disabled={!orderDirty || savingOrder}>{savingOrder ? 'Saving…' : 'Save assessments'}</button>
            </div>
          </PageCard>

          <PageCard className="profile-card--form" style={{ margin: '0 0 var(--space-5)', maxWidth: 'none' }}>
            <h3 style={{ marginTop: 0 }}>What each answer scores</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: 'var(--font-size-sm)' }}>
              Every question the tool shows. Open a question to change its signals.
            </p>
            {data.questions.length === 0 ? (
              <div className="no-users">No questions yet.</div>
            ) : (
              <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Question</th><th>Shown in</th><th>Signals</th></tr></thead>
                  <tbody>
                    {data.questions.map((qn) => {
                      const labelFor = Object.fromEntries(data.tool.vocabulary.map((v) => [v.target, v.label]));
                      const lines = qn.options.filter((o) => o.signals.length).map((o) => `${o.label}: ${o.signals.map(([t, p]) => `${labelFor[t] || t} ${p > 0 ? '+' : ''}${p}`).join(', ')}`);
                      return (
                        <tr key={qn.id}>
                          <td>
                            <Link to={`${CONFIG_BASE}/questions/${qn.id}`}><strong>{qn.label}</strong></Link>
                            {qn.retired && <span className="muted"> (retired)</span>}
                            <div className="muted" style={{ fontSize: 'var(--font-size-xs)' }}><code>{qn.key}</code></div>
                          </td>
                          <td className="muted" style={{ fontSize: 'var(--font-size-xs)' }}>{qn.shownIn.join('; ')}</td>
                          <td style={{ fontSize: 'var(--font-size-xs)' }}>
                            {!qn.hasOptions ? <span className="muted">Context only (no options)</span>
                              : lines.length === 0 ? <span className="muted">Context only</span>
                              : lines.map((l, i) => <div key={i}>{l}</div>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PageCard>

          <PageCard className="profile-card--form" style={{ margin: 0, maxWidth: 'none' }}>
            <h3 style={{ marginTop: 0 }}>Preview with a real opportunity</h3>
            <div className="filter-bar filter-bar--row">
              <select className="filter-input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Company">
                <option value="">Choose a company…</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="filter-input" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} aria-label="Opportunity" disabled={!companyId}>
                <option value="">Choose an opportunity…</option>
                {opportunities.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.stage})</option>)}
              </select>
              <button type="button" className="btn-primary" onClick={runPreview} disabled={!opportunityId || previewing}>{previewing ? 'Scoring…' : 'Show grid'}</button>
            </div>
            {preview && (
              <>
                <p className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  <strong>{preview.opportunity.name}</strong> · {preview.opportunity.companyName} · under the current rules (configuration version {preview.configVersion}).
                </p>
                <ScopingGrid result={preview.result} catalog={catalog} decision={null} version={null} progress={[]} readOnly
                             onSave={async () => {}} onReload={() => {}} />
              </>
            )}
          </PageCard>
        </>
      )}
    </>
  );
}
