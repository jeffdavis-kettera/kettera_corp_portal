// Proposal tab — what goes in the proposal / SOW, curated from what
// the tools produced. Rendered inside OpportunityPageShell.
//
// Everything Scoping chose and the deliverables tools selected is
// here and included by default. Untick to leave something out,
// reorder, write the narrative, and save. Nothing done here changes
// the tools; "the tool chose it, we left it out" is a normal state.
// Quantities stay in the tools (one source) with a link to adjust.
//
// Guidance at the top shows what the tools see that the proposal
// doesn't yet reflect: deliverables a tool recommends that weren't
// selected, services Scoping rates Strong that aren't pitched, and
// pitched services with nothing chosen.
//
// The agreement section (SOW number and dates, client contact and
// address, the SOW text, milestones, fees, per-deliverable due dates)
// is what the SOW templates need beyond the summary. Generate fills
// the current template of a type and files the result as a document
// on the opportunity; the proposal must be saved first so the
// document matches what's on screen.
//
// AI drafting (when a CRM Admin has set it up): every text section
// has "Draft with AI" / "Rewrite with AI" with optional instructions,
// and the head card can draft every empty section at once. Requests
// carry the unsaved draft, so what you've just unticked isn't
// proposed back. The text lands in the field, Undo restores what was
// there, and nothing is saved until you save.

import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import PageCard from '../../PageCard.jsx';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson } from '../../../utils/api.js';
import { formatDateTime, formatCurrency } from '../opportunityStages.js';

const BAND_CLASS = {
  Recommended: 'band-chip band-chip--recommended', Strong: 'band-chip band-chip--recommended',
  Consider: 'band-chip band-chip--consider', Moderate: 'band-chip band-chip--consider',
  NotIndicated: 'band-chip band-chip--not', Weak: 'band-chip band-chip--not',
};
const BAND_LABEL = { NotIndicated: 'Not indicated' };

const TEXT_FIELDS = [
  { field: 'executiveSummary', label: 'Executive summary', rows: 5, placeholder: 'The situation, what we propose, and why it matters to them.' },
  { field: 'approach', label: 'Approach', rows: 4, placeholder: 'How the engagement runs end to end.' },
  { field: 'assumptions', label: 'Assumptions', rows: 3, placeholder: 'Access, availability, decisions we\'re relying on.' },
  { field: 'timeline', label: 'Timeline', rows: 3, placeholder: 'Phases, start, duration, milestones.' },
];
const SOW_TEXT_FIELDS = [
  { field: 'background', label: 'Background', rows: 4, ai: true, placeholder: 'The client\'s situation and why they\'re engaging us.' },
  { field: 'scope', label: 'Scope of work', rows: 6, ai: true, placeholder: 'Left blank, the SOW composes this from each included service\'s narrative.' },
  { field: 'outOfScope', label: 'Out of scope', rows: 3, ai: true, placeholder: 'Adjacent work this SOW does not cover.' },
  { field: 'paymentTerms', label: 'Payment terms', rows: 3, ai: false, placeholder: 'e.g. Invoiced monthly in arrears, net 30.' },
  { field: 'acceptanceCriteria', label: 'Acceptance criteria', rows: 3, ai: true, placeholder: 'How each deliverable is confirmed complete.' },
];
const AGREEMENT_FIELDS = ['sowNumber', 'sowDate', 'msaDate', 'clientContactId', 'clientAddress', 'startDate', 'endDate',
  'background', 'scope', 'outOfScope', 'paymentTerms', 'acceptanceCriteria'];

/** The editable part of a view, as the dirty check and the save body see it. */
function editable(view) {
  return {
    proposal: {
      title: view.proposal.title, executiveSummary: view.proposal.executiveSummary, approach: view.proposal.approach,
      assumptions: view.proposal.assumptions, timeline: view.proposal.timeline, status: view.proposal.status,
    },
    agreement: Object.fromEntries(AGREEMENT_FIELDS.map((f) => [f, view.agreement?.[f] ?? (f === 'clientContactId' ? null : '')])),
    milestones: (view.milestones || []).map((m) => ({ name: m.name || '', date: m.date || '', owner: m.owner || '' })),
    fees: (view.fees || []).map((f) => ({ description: f.description || '', amount: f.amount == null ? '' : String(f.amount) })),
    services: view.services.map((s) => ({
      code: s.code, included: s.included, narrative: s.narrative,
      items: s.items.map((i) => ({ code: i.code, included: i.included, scopeNotes: i.scopeNotes, dueDate: i.dueDate || '' })),
    })),
  };
}

// A draftable text: { key, field, group, serviceCode?, label }.
const target = (field, label, { serviceCode, group = 'proposal' } = {}) => ({ key: serviceCode ? `${field}:${serviceCode}` : field, field, group, serviceCode, label });
const readValue = (d, t) => {
  if (t.group === 'narrative') return d.services.find((s) => s.code === t.serviceCode)?.narrative ?? '';
  if (t.group === 'agreement') return d.agreement[t.field] ?? '';
  return d.proposal[t.field];
};
const withValue = (d, t, text) => {
  if (t.group === 'narrative') return { ...d, services: d.services.map((s) => (s.code === t.serviceCode ? { ...s, narrative: text } : s)) };
  if (t.group === 'agreement') return { ...d, agreement: { ...d.agreement, [t.field]: text } };
  return { ...d, proposal: { ...d.proposal, [t.field]: text } };
};

function SuggestBar({ t, value, busy, hint, onHint, onSuggest, canUndo, onUndo, disabled }) {
  const working = busy === t.key;
  return (
    <div className="suggest-bar">
      <input type="text" className="suggest-bar__input" value={hint} maxLength={1000} disabled={disabled || Boolean(busy)}
             placeholder={value.trim() ? 'How should it change? e.g. shorter, mention the review board' : 'Anything to emphasise? (optional)'}
             aria-label={`Instructions for drafting ${t.label}`} onChange={(e) => onHint(e.target.value)} />
      <button type="button" className="link-button" disabled={disabled || Boolean(busy)} onClick={onSuggest}>
        {working ? 'Drafting…' : value.trim() ? 'Rewrite with AI' : 'Draft with AI'}
      </button>
      {canUndo && <button type="button" className="link-button" disabled={Boolean(busy)} onClick={onUndo}>Undo</button>}
    </div>
  );
}

export default function OpportunityProposal() {
  const { id: companyId, oppId } = useParams();
  const { opportunity } = useOutletContext();
  const url = `${API_BASE_URL}/crm/companies/${companyId}/opportunities/${oppId}/proposal`;
  const toolsUrl = `/modules/crm/companies/${companyId}/opportunities/${oppId}/tools`;

  const [view, setView] = useState(null);      // the server's view (guidance, bands, stale rows…)
  const [draft, setDraft] = useState(null);    // editable(view) with the user's changes
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null);      // target key being drafted, 'all', or 'generate:<type>'
  const [hints, setHints] = useState({});      // target key → instructions typed
  const [undo, setUndo] = useState({});        // target key → text before the last suggestion
  const [generated, setGenerated] = useState(null);   // the last generated document

  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    setError(null); setConflict(false);
    try {
      const v = await authenticatedFetchJson(url);
      setView(v);
      setDraft(editable(v));
      setPreview(null);
    } catch (err) {
      setError(err.message || 'Failed to load the proposal.');
    } finally {
      if (initial) setLoading(false);
    }
  }, [url]);
  useEffect(() => { load({ initial: true }); }, [load]);

  const dirty = view && draft && JSON.stringify(draft) !== JSON.stringify(editable(view));
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const touch = (fn) => { setSuccess(null); setDraft(fn); };
  const setProposalField = (field, value) => touch((d) => ({ ...d, proposal: { ...d.proposal, [field]: value } }));
  const setAgreement = (field, value) => touch((d) => ({ ...d, agreement: { ...d.agreement, [field]: value } }));
  const setService = (code, patch) => touch((d) => ({ ...d, services: d.services.map((s) => (s.code === code ? { ...s, ...patch } : s)) }));
  const setItem = (serviceCode, code, patch) => touch((d) => ({ ...d, services: d.services.map((s) => (s.code !== serviceCode ? s : {
    ...s, items: s.items.map((i) => (i.code === code ? { ...i, ...patch } : i)),
  })) }));
  const move = (list, index, delta) => {
    const j = index + delta;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[index], next[j]] = [next[j], next[index]];
    return next;
  };
  const moveService = (index, delta) => touch((d) => ({ ...d, services: move(d.services, index, delta) }));
  const moveItem = (serviceCode, index, delta) => touch((d) => ({ ...d, services: d.services.map((s) => (s.code === serviceCode ? { ...s, items: move(s.items, index, delta) } : s)) }));
  // Milestones and fees: plain row lists.
  const setRow = (list, index, patch) => touch((d) => ({ ...d, [list]: d[list].map((r, i) => (i === index ? { ...r, ...patch } : r)) }));
  const addRow = (list, row) => touch((d) => ({ ...d, [list]: [...d[list], row] }));
  const removeRow = (list, index) => touch((d) => ({ ...d, [list]: d[list].filter((_, i) => i !== index) }));
  const moveRow = (list, index, delta) => touch((d) => ({ ...d, [list]: move(d[list], index, delta) }));

  async function handleSave(e) {
    e.preventDefault();
    if (!dirty || saving || busy) return;
    setSaving(true); setError(null); setSuccess(null); setConflict(false);
    try {
      const v = await authenticatedFetchJson(url, { method: 'PUT', body: { ...draft, expectedVersion: view.proposal.version } });
      setView(v);
      setDraft(editable(v));
      setPreview(null);
      setUndo({});
      setSuccess('Proposal saved.');
    } catch (err) {
      if (err.status === 409) setConflict(true);
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function showDocument() {
    setError(null);
    try {
      setPreview(await authenticatedFetchJson(`${url}/document`));
    } catch (err) {
      setError(err.message || 'Could not build the document.');
    }
  }

  // ── Generating documents ──────────────────────────────────────

  async function generate(type) {
    if (busy || dirty) return;
    setBusy(`generate:${type.code}`); setError(null); setSuccess(null); setGenerated(null);
    try {
      const r = await authenticatedFetchJson(`${url}/generate`, { method: 'POST', body: { templateType: type.code } });
      setGenerated({ type, ...r });
      window.open(r.downloadUrl, '_blank', 'noopener');
    } catch (err) {
      setError(err.message || 'The document could not be generated.');
    } finally {
      setBusy(null);
    }
  }

  // ── AI drafting ───────────────────────────────────────────────

  async function suggest(t) {
    if (busy) return;
    const current = readValue(draft, t);
    setBusy(t.key); setError(null); setSuccess(null);
    try {
      const r = await authenticatedFetchJson(`${url}/suggest`, {
        method: 'POST',
        body: { field: t.field, serviceCode: t.serviceCode, current, instructions: hints[t.key] || '', draft },
      });
      setUndo((u) => ({ ...u, [t.key]: current }));
      setHints((h) => ({ ...h, [t.key]: '' }));
      setDraft((d) => withValue(d, t, r.text));
    } catch (err) {
      setError(err.message || 'Drafting failed.');
    } finally {
      setBusy(null);
    }
  }

  function undoSuggest(t) {
    const previous = undo[t.key];
    if (previous == null) return;
    setDraft((d) => withValue(d, t, previous));
    setUndo((u) => { const next = { ...u }; delete next[t.key]; return next; });
  }

  async function draftEmpty() {
    if (busy) return;
    const byCodeNow = Object.fromEntries(view.services.map((s) => [s.code, s]));
    // Narratives first, so the summary, approach and scope can build on them.
    const targets = [
      ...draft.services
        .filter((s) => s.included && !byCodeNow[s.code]?.stale && !s.narrative.trim())
        .map((s) => target('narrative', `the ${byCodeNow[s.code].label} narrative`, { serviceCode: s.code, group: 'narrative' })),
      ...TEXT_FIELDS.filter((f) => !draft.proposal[f.field].trim()).map((f) => target(f.field, f.label)),
      ...SOW_TEXT_FIELDS.filter((f) => f.ai && !(draft.agreement[f.field] || '').trim()).map((f) => target(f.field, f.label, { group: 'agreement' })),
    ];
    if (!targets.length) { setSuccess('Every section already has text — use Rewrite with AI on a section instead.'); return; }
    setBusy('all'); setError(null); setSuccess(null);
    let working = draft;
    let done = 0;
    try {
      for (const t of targets) {
        const r = await authenticatedFetchJson(`${url}/suggest`, { method: 'POST', body: { field: t.field, serviceCode: t.serviceCode, draft: working } });
        working = withValue(working, t, r.text);
        setDraft(working);
        done += 1;
      }
      setSuccess(`Drafted ${done} ${done === 1 ? 'section' : 'sections'}. Review, edit and save.`);
    } catch (err) {
      setError(`${err.message || 'Drafting failed.'}${done ? ` (${done} of ${targets.length} sections were drafted.)` : ''}`);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="spinner" role="status" aria-label="Loading proposal" />;
  if (!view || !draft) {
    return <div className="error-message"><p>{error || 'The proposal is unavailable.'}</p></div>;
  }

  const drafting = view.drafting || { available: false, reason: null };
  const generation = view.generation || { types: [] };
  const locked = saving || busy === 'all';
  const bar = (t, value, disabled) => drafting.available && (
    <SuggestBar t={t} value={value} busy={busy} hint={hints[t.key] || ''} disabled={disabled}
                onHint={(v) => setHints((h) => ({ ...h, [t.key]: v }))} onSuggest={() => suggest(t)}
                canUndo={undo[t.key] != null} onUndo={() => undoSuggest(t)} />
  );

  const byCode = Object.fromEntries(view.services.map((s) => [s.code, s]));
  const g = view.guidance;
  const notices = [
    ...g.recommendedNotSelected.map((s) => ({
      key: `rns-${s.code}`,
      text: `${s.label}: the tool recommends ${s.items.map((i) => i.name).join(', ')} but ${s.items.length === 1 ? 'it isn\'t' : 'they aren\'t'} selected.`,
      link: `${toolsUrl}/${s.toolKey}`, linkText: 'Review in tool',
    })),
    ...g.strongNotPitched.map((s) => ({
      key: `snp-${s.code}`, text: `Service Scoping rates ${s.label} Strong, but it isn't being pitched.`,
      link: `${toolsUrl}/scoping`, linkText: 'Review Scoping',
    })),
    ...g.pitchedWithoutDeliverables.map((s) => ({
      key: `pwd-${s.code}`, text: `${s.label} is pitched but no deliverables have been chosen for it yet.`,
      link: `${toolsUrl}/${s.toolKey}`, linkText: 'Open tool',
    })),
  ];
  const includedServices = draft.services.filter((s) => s.included && !byCode[s.code]?.stale).length;
  const includedItems = draft.services.filter((s) => s.included).flatMap((s) => s.items).filter((i) => i.included).length;
  const feesTotal = draft.fees.reduce((sum, f) => sum + (Number(String(f.amount).replace(/[,$\s]/g, '')) || 0), 0);
  const currency = opportunity.currency || 'USD';

  return (
    <form onSubmit={handleSave}>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        What goes in the proposal. The services Scoping chose and the deliverables the tools selected are here
        and included until you leave them out; leaving something out doesn't change the tools.
        Quantities are set in the tools.
        {drafting.available && <> <em>Draft with AI</em> writes a first version of any text section from the answers and what's included; you edit, and nothing is saved until you save.</>}
      </p>

      {(notices.length > 0 || g.hasNew || g.hasStale) && (
        <div className="info-banner" role="note">
          <strong>From the tools</strong>
          <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)' }}>
            {g.hasNew && <li>New items from the tools since the proposal was last saved are marked <em>New</em> and included.</li>}
            {g.hasStale && <li>Items marked <em>no longer selected</em> were deselected in a tool and won't appear in the document.</li>}
            {notices.map((n) => (
              <li key={n.key}>{n.text} <Link to={n.link}>{n.linkText}</Link></li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}{conflict && <>{' '}<button type="button" className="link-button" onClick={() => load()}>Reload</button></>}</p>
        </div>
      )}
      {success && <div className="success-message"><p>{success}</p></div>}
      {generated && (
        <div className="success-message">
          <p>
            <strong>{generated.type.name} generated</strong> — <a href={generated.downloadUrl} target="_blank" rel="noopener noreferrer">download {generated.document.filename}</a>
            {' '}(link valid for 5 minutes). It's filed under the company's documents as “{generated.document.title}”.
          </p>
          {generated.warnings?.length > 0 && (
            <>
              <p style={{ margin: 'var(--space-2) 0 0' }}>Left blank in the document:</p>
              <ul style={{ margin: 'var(--space-1) 0 0', paddingLeft: 'var(--space-5)' }}>
                {generated.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      <PageCard style={{ marginBottom: 'var(--space-5)' }}>
        <div className="proposal-head">
          <div className="form-group" style={{ flex: '1 1 320px', margin: 0 }}>
            <label htmlFor="proposalTitle">Proposal title</label>
            <input id="proposalTitle" type="text" value={draft.proposal.title} maxLength={300} disabled={locked}
                   onChange={(e) => setProposalField('title', e.target.value)} />
            {bar(target('title', 'the title'), draft.proposal.title, locked)}
          </div>
          <div className="form-group" style={{ flex: '0 0 180px', margin: 0 }}>
            <label htmlFor="proposalStatus">Status</label>
            <select id="proposalStatus" value={draft.proposal.status} disabled={locked} onChange={(e) => setProposalField('status', e.target.value)}>
              <option value="Draft">Draft</option>
              <option value="Ready">Ready for the document</option>
            </select>
          </div>
          <div className="proposal-head__meta muted">
            {includedServices} {includedServices === 1 ? 'service' : 'services'} · {includedItems} {includedItems === 1 ? 'deliverable' : 'deliverables'} included
            {view.proposal.updatedAt && <><br />Saved {formatDateTime(view.proposal.updatedAt)}{view.proposal.updatedByName ? ` by ${view.proposal.updatedByName}` : ''}</>}
            {drafting.available && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <button type="button" className="cancel-button" onClick={draftEmpty} disabled={saving || Boolean(busy)}>
                  {busy === 'all' ? 'Drafting…' : 'Draft empty sections with AI'}
                </button>
              </div>
            )}
          </div>
        </div>
      </PageCard>

      {draft.services.length === 0 ? (
        <div className="no-users">
          Nothing to include yet. Choose services in <Link to={`${toolsUrl}/scoping`}>Service Scoping</Link> and deliverables in each service's tool.
        </div>
      ) : draft.services.map((s, si) => {
        const info = byCode[s.code];
        return (
          <PageCard key={s.code} className={`proposal-service${s.included && !info.stale ? '' : ' is-excluded'}`} style={{ marginBottom: 'var(--space-4)' }}>
            <div className="proposal-service__head">
              <label className="proposal-service__pick">
                <input type="checkbox" checked={s.included} disabled={locked || info.stale} onChange={(e) => setService(s.code, { included: e.target.checked })} />
                <span>
                  <strong>{info.label}</strong>
                  {info.isLead && <span className="deliverable-row__category">Lead</span>}
                  {info.isNew && <span className="deliverable-row__category">New</span>}
                  {!info.pitched && !info.stale && <span className="deliverable-row__category" title="Deliverables were chosen for this service, but Scoping didn't choose it">Not pitched</span>}
                  {info.stale && <span className="deliverable-row__category">No longer pitched or chosen</span>}
                </span>
              </label>
              <span className="proposal-service__tags">
                {info.scopingBand && (
                  <span className={BAND_CLASS[info.scopingBand] || 'band-chip'} title="Service Scoping's rating">
                    Scoping: {info.scopingBand}{info.scopingRating != null ? ` ${info.scopingRating}` : ''}
                  </span>
                )}
                {info.toolKey && <Link to={`${toolsUrl}/${info.toolKey}`} className="link-button">Adjust in tool</Link>}
                <button type="button" className="link-button" onClick={() => moveService(si, -1)} disabled={locked || si === 0}>Up</button>
                <button type="button" className="link-button" onClick={() => moveService(si, 1)} disabled={locked || si === draft.services.length - 1}>Down</button>
              </span>
            </div>

            {s.items.length === 0 && info.staleItems.length === 0 ? (
              <p className="muted" style={{ margin: 'var(--space-2) 0 0' }}>
                No deliverables chosen yet.{info.toolKey && <> <Link to={`${toolsUrl}/${info.toolKey}`}>Choose them in the tool</Link>.</>}
              </p>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 'var(--space-3)' }}>
                <table className="data-table proposal-items">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Include</th>
                      <th>Deliverable</th>
                      <th style={{ width: 110 }}>Quantity</th>
                      <th style={{ width: 140 }}>Tool rating</th>
                      <th>Scope notes for the document</th>
                      <th style={{ width: 150 }}>Due date</th>
                      <th style={{ width: 110 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.items.map((i, ii) => {
                      const d = info.items.find((x) => x.code === i.code) || {};
                      const off = locked || !s.included || !i.included;
                      return (
                        <tr key={i.code} className={i.included ? undefined : 'is-excluded'}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={i.included} disabled={locked || !s.included} aria-label={`Include ${d.name}`}
                                   onChange={(e) => setItem(s.code, i.code, { included: e.target.checked })} />
                          </td>
                          <td>
                            <strong>{d.name}</strong>
                            {d.category && <span className="deliverable-row__category">{d.category}</span>}
                            {d.isCore && <span className="deliverable-row__category">Core</span>}
                            {d.isNew && <span className="deliverable-row__category">New</span>}
                            {d.toolNotes && <div className="muted" style={{ fontSize: 'var(--font-size-xs)' }}>Tool notes: {d.toolNotes}</div>}
                          </td>
                          <td className="muted">{d.quantity} {d.unit}{d.quantity === 1 ? '' : 's'}</td>
                          <td>{d.band && <span className={BAND_CLASS[d.band] || 'band-chip'}>{BAND_LABEL[d.band] || d.band}</span>}</td>
                          <td>
                            <input type="text" value={i.scopeNotes} maxLength={2000} disabled={off}
                                   placeholder="What this covers for this client…" aria-label={`Scope notes for ${d.name}`}
                                   onChange={(e) => setItem(s.code, i.code, { scopeNotes: e.target.value })} />
                          </td>
                          <td>
                            <input type="date" value={i.dueDate} disabled={off} aria-label={`Due date for ${d.name}`}
                                   onChange={(e) => setItem(s.code, i.code, { dueDate: e.target.value })} />
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button type="button" className="link-button" onClick={() => moveItem(s.code, ii, -1)} disabled={locked || ii === 0}>Up</button>
                            {' · '}
                            <button type="button" className="link-button" onClick={() => moveItem(s.code, ii, 1)} disabled={locked || ii === s.items.length - 1}>Down</button>
                          </td>
                        </tr>
                      );
                    })}
                    {info.staleItems.map((i) => (
                      <tr key={`stale-${i.code}`} className="is-excluded">
                        <td></td>
                        <td colSpan={6}><span className="muted">{i.name} — no longer selected in the tool; left out of the document.</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
              <label htmlFor={`narrative-${s.code}`}>Narrative for {info.label}</label>
              <textarea id={`narrative-${s.code}`} rows="3" value={s.narrative} maxLength={4000} disabled={locked || !s.included}
                        placeholder="How we'd approach this service for this client — becomes the section introduction."
                        onChange={(e) => setService(s.code, { narrative: e.target.value })} />
              {bar(target('narrative', `the ${info.label} narrative`, { serviceCode: s.code, group: 'narrative' }), s.narrative, locked || !s.included || info.stale)}
            </div>
          </PageCard>
        );
      })}

      <PageCard style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ marginTop: 0 }}>Proposal text</h3>
        {!drafting.available && drafting.reason && (
          <p className="muted" style={{ marginTop: 0, fontSize: 'var(--font-size-sm)' }}>{drafting.reason}</p>
        )}
        <div className="form-stack">
          {TEXT_FIELDS.map((f) => (
            <div className="form-group" key={f.field}>
              <label htmlFor={f.field}>{f.label}</label>
              <textarea id={f.field} rows={f.rows} value={draft.proposal[f.field]} maxLength={8000} disabled={locked}
                        placeholder={f.placeholder} onChange={(e) => setProposalField(f.field, e.target.value)} />
              {bar(target(f.field, f.label), draft.proposal[f.field], locked)}
            </div>
          ))}
        </div>
      </PageCard>

      <PageCard style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ marginTop: 0 }}>Agreement details (SOW)</h3>
        <p className="muted" style={{ marginTop: 0 }}>What the Statement of Work needs beyond the proposal. The MSA date is only used by the SOW with MSA.</p>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="sowNumber">SOW number</label>
            <input id="sowNumber" type="text" value={draft.agreement.sowNumber} maxLength={50} disabled={locked} placeholder="e.g. SOW-2026-012"
                   onChange={(e) => setAgreement('sowNumber', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="sowDate">SOW date</label>
            <input id="sowDate" type="date" value={draft.agreement.sowDate} disabled={locked} onChange={(e) => setAgreement('sowDate', e.target.value)} />
            <small className="muted">Blank → the date it's generated.</small>
          </div>
          <div className="form-group">
            <label htmlFor="msaDate">MSA date</label>
            <input id="msaDate" type="date" value={draft.agreement.msaDate} disabled={locked} onChange={(e) => setAgreement('msaDate', e.target.value)} />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 'var(--space-3)' }}>
          <div className="form-group">
            <label htmlFor="clientContactId">Client contact</label>
            <select id="clientContactId" value={draft.agreement.clientContactId ?? ''} disabled={locked}
                    onChange={(e) => setAgreement('clientContactId', e.target.value ? Number(e.target.value) : null)}>
              <option value="">— none —</option>
              {view.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.title ? ` — ${c.title}` : ''}</option>)}
            </select>
            {view.contacts.length === 0 && <small className="muted">Add contacts on the company first.</small>}
          </div>
          <div className="form-group">
            <label htmlFor="startDate">Start date</label>
            <input id="startDate" type="date" value={draft.agreement.startDate} disabled={locked} onChange={(e) => setAgreement('startDate', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="endDate">End date</label>
            <input id="endDate" type="date" value={draft.agreement.endDate} disabled={locked} onChange={(e) => setAgreement('endDate', e.target.value)} />
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
          <label htmlFor="clientAddress">Client address</label>
          <textarea id="clientAddress" rows="2" value={draft.agreement.clientAddress} maxLength={500} disabled={locked}
                    placeholder="As it should appear on the SOW." onChange={(e) => setAgreement('clientAddress', e.target.value)} />
        </div>
        <div className="form-stack" style={{ marginTop: 'var(--space-3)' }}>
          {SOW_TEXT_FIELDS.map((f) => (
            <div className="form-group" key={f.field}>
              <label htmlFor={`ag-${f.field}`}>{f.label}</label>
              <textarea id={`ag-${f.field}`} rows={f.rows} value={draft.agreement[f.field]} maxLength={16000} disabled={locked}
                        placeholder={f.placeholder} onChange={(e) => setAgreement(f.field, e.target.value)} />
              {f.ai && bar(target(f.field, f.label, { group: 'agreement' }), draft.agreement[f.field], locked)}
            </div>
          ))}
        </div>
      </PageCard>

      <PageCard style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ marginTop: 0 }}>Milestones</h3>
        {draft.milestones.length === 0 ? <p className="muted" style={{ marginTop: 0 }}>No milestones yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table proposal-rows">
              <thead><tr><th>Milestone</th><th style={{ width: 170 }}>Date</th><th style={{ width: 220 }}>Owner</th><th style={{ width: 170 }}></th></tr></thead>
              <tbody>
                {draft.milestones.map((m, i) => (
                  <tr key={i}>
                    <td><input type="text" value={m.name} maxLength={200} disabled={locked} placeholder="e.g. Kickoff" aria-label={`Milestone ${i + 1}`} onChange={(e) => setRow('milestones', i, { name: e.target.value })} /></td>
                    <td><input type="date" value={m.date} disabled={locked} aria-label={`Milestone ${i + 1} date`} onChange={(e) => setRow('milestones', i, { date: e.target.value })} /></td>
                    <td><input type="text" value={m.owner} maxLength={200} disabled={locked} placeholder="Kettera / client" aria-label={`Milestone ${i + 1} owner`} onChange={(e) => setRow('milestones', i, { owner: e.target.value })} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="link-button" disabled={locked || i === 0} onClick={() => moveRow('milestones', i, -1)}>Up</button>{' · '}
                      <button type="button" className="link-button" disabled={locked || i === draft.milestones.length - 1} onClick={() => moveRow('milestones', i, 1)}>Down</button>{' · '}
                      <button type="button" className="link-button" disabled={locked} onClick={() => removeRow('milestones', i)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="cancel-button" disabled={locked || draft.milestones.length >= 50} style={{ marginTop: 'var(--space-3)' }}
                onClick={() => addRow('milestones', { name: '', date: '', owner: '' })}>Add milestone</button>
      </PageCard>

      <PageCard style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ marginTop: 0 }}>Fees</h3>
        {draft.fees.length === 0 ? <p className="muted" style={{ marginTop: 0 }}>No fee lines yet — the SOW's total will show {formatCurrency(0, currency)}.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table proposal-rows">
              <thead><tr><th>Description</th><th style={{ width: 180 }}>Amount ({currency})</th><th style={{ width: 170 }}></th></tr></thead>
              <tbody>
                {draft.fees.map((f, i) => (
                  <tr key={i}>
                    <td><input type="text" value={f.description} maxLength={300} disabled={locked} placeholder="e.g. Coaching retainer, 3 months" aria-label={`Fee ${i + 1}`} onChange={(e) => setRow('fees', i, { description: e.target.value })} /></td>
                    <td><input type="text" inputMode="decimal" value={f.amount} disabled={locked} placeholder="0.00" aria-label={`Fee ${i + 1} amount`} onChange={(e) => setRow('fees', i, { amount: e.target.value })} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="link-button" disabled={locked || i === 0} onClick={() => moveRow('fees', i, -1)}>Up</button>{' · '}
                      <button type="button" className="link-button" disabled={locked || i === draft.fees.length - 1} onClick={() => moveRow('fees', i, 1)}>Down</button>{' · '}
                      <button type="button" className="link-button" disabled={locked} onClick={() => removeRow('fees', i)}>Remove</button>
                    </td>
                  </tr>
                ))}
                <tr><td style={{ textAlign: 'right' }}><strong>Total</strong></td><td><strong>{formatCurrency(feesTotal, currency)}</strong></td><td></td></tr>
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="cancel-button" disabled={locked || draft.fees.length >= 50} style={{ marginTop: 'var(--space-3)' }}
                onClick={() => addRow('fees', { description: '', amount: '' })}>Add fee line</button>
      </PageCard>

      <PageCard style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ marginTop: 0 }}>Generate documents</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Fills the current template with what's on this screen and files the result under the company's documents.
          {dirty && <strong> Save first — the document is built from what's saved.</strong>}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {generation.types.map((t) => (
            <button key={t.code} type="button" className="save-button" disabled={dirty || locked || Boolean(busy) || !t.available}
                    title={!t.available ? `No current template for ${t.name} — a CRM Admin can upload one under CRM Configuration → Templates.` : dirty ? 'Save first' : `Uses template: ${t.template}`}
                    onClick={() => generate(t)}>
              {busy === `generate:${t.code}` ? 'Generating…' : `Generate ${t.name}`}
            </button>
          ))}
        </div>
        {generation.types.some((t) => !t.available) && (
          <p className="muted" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--font-size-sm)' }}>
            No template yet for: {generation.types.filter((t) => !t.available).map((t) => t.name).join(', ')}. A CRM Admin uploads them under CRM Configuration → Templates.
          </p>
        )}
      </PageCard>

      <div className="form-actions" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="cancel-button" onClick={showDocument} disabled={dirty || saving} title={dirty ? 'Save first' : undefined}>
          Preview content
        </button>
        <span>
          {dirty && <button type="button" className="cancel-button" onClick={() => { setDraft(editable(view)); setUndo({}); setSuccess(null); }} disabled={locked} style={{ marginRight: 'var(--space-3)' }}>Discard changes</button>}
          <button type="submit" className="save-button" disabled={!dirty || locked || Boolean(busy)}>{saving ? 'Saving…' : 'Save proposal'}</button>
        </span>
      </div>

      {preview && (
        <PageCard className="proposal-document" style={{ marginTop: 'var(--space-5)' }}>
          <p className="muted" style={{ marginTop: 0, fontSize: 'var(--font-size-sm)' }}>
            What the templates receive — included items only, in order.
          </p>
          <h2 style={{ marginTop: 0 }}>{preview.title}</h2>
          <p className="muted">{preview.opportunity.companyName} · {preview.opportunity.name} · {preview.status}</p>
          {preview.executiveSummary && <><h3>Executive summary</h3><p>{preview.executiveSummary}</p></>}
          {preview.approach && <><h3>Approach</h3><p>{preview.approach}</p></>}
          {preview.services.length === 0 && <p className="muted">No services included.</p>}
          {preview.services.map((s) => (
            <section key={s.code}>
              <h3>{s.label}{s.isLead ? ' (lead service)' : ''}</h3>
              {s.narrative && <p>{s.narrative}</p>}
              {s.deliverables.length === 0 ? <p className="muted">No deliverables included.</p> : (
                <ul>
                  {s.deliverables.map((d) => (
                    <li key={d.code}>
                      <strong>{d.name}</strong> — {d.quantity} {d.unit}{d.quantity === 1 ? '' : 's'}{d.dueDate ? ` · due ${d.dueDate}` : ''}
                      {d.description && <div className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>{d.description}</div>}
                      {d.scopeNotes && <div style={{ fontSize: 'var(--font-size-sm)' }}>{d.scopeNotes}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          {preview.assumptions && <><h3>Assumptions</h3><p>{preview.assumptions}</p></>}
          {preview.timeline && <><h3>Timeline</h3><p>{preview.timeline}</p></>}
          {preview.milestones?.length > 0 && <><h3>Milestones</h3><ul>{preview.milestones.map((m, i) => <li key={i}>{m.name}{m.date ? ` — ${m.date}` : ''}{m.owner ? ` (${m.owner})` : ''}</li>)}</ul></>}
          {preview.fees?.length > 0 && <><h3>Fees</h3><ul>{preview.fees.map((f, i) => <li key={i}>{f.description} — {formatCurrency(f.amount, currency)}</li>)}</ul><p><strong>Total {formatCurrency(preview.feesTotal, currency)}</strong></p></>}
        </PageCard>
      )}
    </form>
  );
}
