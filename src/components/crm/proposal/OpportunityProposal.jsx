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

import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import PageCard from '../../PageCard.jsx';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson } from '../../../utils/api.js';
import { formatDateTime } from '../opportunityStages.js';

const BAND_CLASS = {
  Recommended: 'band-chip band-chip--recommended', Strong: 'band-chip band-chip--recommended',
  Consider: 'band-chip band-chip--consider', Moderate: 'band-chip band-chip--consider',
  NotIndicated: 'band-chip band-chip--not', Weak: 'band-chip band-chip--not',
};
const BAND_LABEL = { NotIndicated: 'Not indicated' };

/** The editable part of a view, as the dirty check and the save body see it. */
function editable(view) {
  return {
    proposal: {
      title: view.proposal.title, executiveSummary: view.proposal.executiveSummary, approach: view.proposal.approach,
      assumptions: view.proposal.assumptions, timeline: view.proposal.timeline, status: view.proposal.status,
    },
    services: view.services.map((s) => ({
      code: s.code, included: s.included, narrative: s.narrative,
      items: s.items.map((i) => ({ code: i.code, included: i.included, scopeNotes: i.scopeNotes })),
    })),
  };
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

  const setProposalField = (field, value) => { setSuccess(null); setDraft((d) => ({ ...d, proposal: { ...d.proposal, [field]: value } })); };
  const setService = (code, patch) => {
    setSuccess(null);
    setDraft((d) => ({ ...d, services: d.services.map((s) => (s.code === code ? { ...s, ...patch } : s)) }));
  };
  const setItem = (serviceCode, code, patch) => {
    setSuccess(null);
    setDraft((d) => ({ ...d, services: d.services.map((s) => (s.code !== serviceCode ? s : {
      ...s, items: s.items.map((i) => (i.code === code ? { ...i, ...patch } : i)),
    })) }));
  };
  const move = (list, index, delta) => {
    const j = index + delta;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[index], next[j]] = [next[j], next[index]];
    return next;
  };
  const moveService = (index, delta) => { setSuccess(null); setDraft((d) => ({ ...d, services: move(d.services, index, delta) })); };
  const moveItem = (serviceCode, index, delta) => {
    setSuccess(null);
    setDraft((d) => ({ ...d, services: d.services.map((s) => (s.code === serviceCode ? { ...s, items: move(s.items, index, delta) } : s)) }));
  };

  async function handleSave(e) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true); setError(null); setSuccess(null); setConflict(false);
    try {
      const v = await authenticatedFetchJson(url, { method: 'PUT', body: { ...draft, expectedVersion: view.proposal.version } });
      setView(v);
      setDraft(editable(v));
      setPreview(null);
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

  if (loading) return <div className="spinner" role="status" aria-label="Loading proposal" />;
  if (!view || !draft) {
    return <div className="error-message"><p>{error || 'The proposal is unavailable.'}</p></div>;
  }

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

  return (
    <form onSubmit={handleSave}>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        What goes in the proposal. The services Scoping chose and the deliverables the tools selected are here
        and included until you leave them out; leaving something out doesn't change the tools.
        Quantities are set in the tools.
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

      <PageCard style={{ marginBottom: 'var(--space-5)' }}>
        <div className="proposal-head">
          <div className="form-group" style={{ flex: '1 1 320px', margin: 0 }}>
            <label htmlFor="proposalTitle">Proposal title</label>
            <input id="proposalTitle" type="text" value={draft.proposal.title} maxLength={300} disabled={saving}
                   onChange={(e) => setProposalField('title', e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '0 0 180px', margin: 0 }}>
            <label htmlFor="proposalStatus">Status</label>
            <select id="proposalStatus" value={draft.proposal.status} disabled={saving} onChange={(e) => setProposalField('status', e.target.value)}>
              <option value="Draft">Draft</option>
              <option value="Ready">Ready for the document</option>
            </select>
          </div>
          <div className="proposal-head__meta muted">
            {includedServices} {includedServices === 1 ? 'service' : 'services'} · {includedItems} {includedItems === 1 ? 'deliverable' : 'deliverables'} included
            {view.proposal.updatedAt && <><br />Saved {formatDateTime(view.proposal.updatedAt)}{view.proposal.updatedByName ? ` by ${view.proposal.updatedByName}` : ''}</>}
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
                <input type="checkbox" checked={s.included} disabled={saving || info.stale} onChange={(e) => setService(s.code, { included: e.target.checked })} />
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
                <button type="button" className="link-button" onClick={() => moveService(si, -1)} disabled={saving || si === 0}>Up</button>
                <button type="button" className="link-button" onClick={() => moveService(si, 1)} disabled={saving || si === draft.services.length - 1}>Down</button>
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
                      <th style={{ width: 110 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.items.map((i, ii) => {
                      const d = info.items.find((x) => x.code === i.code) || {};
                      return (
                        <tr key={i.code} className={i.included ? undefined : 'is-excluded'}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={i.included} disabled={saving || !s.included} aria-label={`Include ${d.name}`}
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
                            <input type="text" value={i.scopeNotes} maxLength={2000} disabled={saving || !s.included || !i.included}
                                   placeholder="What this covers for this client…" aria-label={`Scope notes for ${d.name}`}
                                   onChange={(e) => setItem(s.code, i.code, { scopeNotes: e.target.value })} />
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button type="button" className="link-button" onClick={() => moveItem(s.code, ii, -1)} disabled={saving || ii === 0}>Up</button>
                            {' · '}
                            <button type="button" className="link-button" onClick={() => moveItem(s.code, ii, 1)} disabled={saving || ii === s.items.length - 1}>Down</button>
                          </td>
                        </tr>
                      );
                    })}
                    {info.staleItems.map((i) => (
                      <tr key={`stale-${i.code}`} className="is-excluded">
                        <td></td>
                        <td colSpan={5}><span className="muted">{i.name} — no longer selected in the tool; left out of the document.</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
              <label htmlFor={`narrative-${s.code}`}>Narrative for {info.label}</label>
              <textarea id={`narrative-${s.code}`} rows="3" value={s.narrative} maxLength={4000} disabled={saving || !s.included}
                        placeholder="How we'd approach this service for this client — becomes the section introduction."
                        onChange={(e) => setService(s.code, { narrative: e.target.value })} />
            </div>
          </PageCard>
        );
      })}

      <PageCard style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ marginTop: 0 }}>Proposal text</h3>
        <div className="form-stack">
          <div className="form-group">
            <label htmlFor="executiveSummary">Executive summary</label>
            <textarea id="executiveSummary" rows="5" value={draft.proposal.executiveSummary} maxLength={8000} disabled={saving}
                      placeholder="The situation, what we propose, and why it matters to them."
                      onChange={(e) => setProposalField('executiveSummary', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="approach">Approach</label>
            <textarea id="approach" rows="4" value={draft.proposal.approach} maxLength={8000} disabled={saving}
                      placeholder="How the engagement runs end to end."
                      onChange={(e) => setProposalField('approach', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="assumptions">Assumptions</label>
            <textarea id="assumptions" rows="3" value={draft.proposal.assumptions} maxLength={8000} disabled={saving}
                      placeholder="Access, availability, decisions we're relying on."
                      onChange={(e) => setProposalField('assumptions', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="timeline">Timeline</label>
            <textarea id="timeline" rows="3" value={draft.proposal.timeline} maxLength={8000} disabled={saving}
                      placeholder="Phases, start, duration, milestones."
                      onChange={(e) => setProposalField('timeline', e.target.value)} />
          </div>
        </div>
      </PageCard>

      <div className="form-actions" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="cancel-button" onClick={showDocument} disabled={dirty || saving} title={dirty ? 'Save first' : undefined}>
          Preview document
        </button>
        <span>
          {dirty && <button type="button" className="cancel-button" onClick={() => { setDraft(editable(view)); setSuccess(null); }} disabled={saving} style={{ marginRight: 'var(--space-3)' }}>Discard changes</button>}
          <button type="submit" className="save-button" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save proposal'}</button>
        </span>
      </div>

      {preview && (
        <PageCard className="proposal-document" style={{ marginTop: 'var(--space-5)' }}>
          <p className="muted" style={{ marginTop: 0, fontSize: 'var(--font-size-sm)' }}>
            What the document generator will receive — included items only, in order.
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
                      <strong>{d.name}</strong> — {d.quantity} {d.unit}{d.quantity === 1 ? '' : 's'}
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
        </PageCard>
      )}
    </form>
  );
}
