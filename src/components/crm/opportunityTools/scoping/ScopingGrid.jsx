// ScopingGrid — the Recommendation step: the 3×3 grid of services
// (domains as rows, engagement levels as columns), each cell rated
// Strong / Moderate / Weak with a confidence, plus the controls to
// choose what we pitch.
//
// Ratings come from the API; nothing about the scoring is repeated
// here. Clicking a cell opens a panel with the answers behind its
// rating and the service's description from the catalog.
//
// Saving the selection is what chooses the services. The API stamps
// who chose them and when, snapshots the grid, and later flags drift
// (`result.drift`) if answers move the bands.

import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../../opportunityStages.js';

const LEVELS = ['TEACH', 'BUILD', 'EMBED'];
const BAND_CLASS = { Strong: 'scoping-cell--strong', Moderate: 'scoping-cell--moderate', Weak: 'scoping-cell--weak' };

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export default function ScopingGrid({
  result, catalog, decision, version, decidedAt, decidedByName, progress,
  onSave, onReload, onDirtyChange,
}) {
  const storedServices = decision?.services || [];
  const storedLead = decision?.lead ?? null;
  const storedRationale = decision?.rationale ?? '';

  const [selected, setSelected] = useState(storedServices);
  const [lead, setLead] = useState(storedLead);
  const [rationale, setRationale] = useState(storedRationale);
  const [openCode, setOpenCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState(null);

  const dirty = !sameSet(selected, storedServices) || lead !== storedLead || rationale.trim() !== (storedRationale || '').trim();

  // Follow the stored decision when it changes underneath us (a save
  // here, or a Reload after a conflict). The grid isn't remounted for
  // this, so a "Services saved." message survives its own save.
  const storedKey = JSON.stringify([storedServices, storedLead, storedRationale]);
  useEffect(() => {
    setSelected(storedServices);
    setLead(storedLead);
    setRationale(storedRationale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey]);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const cellByCode = useMemo(() => Object.fromEntries((result?.cells || []).map((c) => [c.code, c])), [result]);
  const catalogByCode = useMemo(() => Object.fromEntries(catalog.map((s) => [s.code, s])), [catalog]);
  const domains = result?.domains || [];
  const levelNames = Object.fromEntries(LEVELS.map((L) => [L, cellByCode[`${domains[0]?.code}_${L}`]?.levelName || L]));

  function togglePitch(code) {
    setSuccess(null);
    setSelected((cur) => {
      const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
      if (!next.includes(lead)) setLead(next.length === 1 ? next[0] : null);
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!dirty || saving) return;
    if (selected.length > 1 && !lead) return setError('Pick which service is the lead.');
    setSaving(true); setError(null); setSuccess(null); setConflict(false);
    try {
      await onSave({ services: selected, lead: selected.length ? (lead || selected[0]) : null, rationale: rationale.trim() || null }, version);
      setSuccess(selected.length ? 'Services saved.' : 'Selection cleared.');
    } catch (err) {
      if (err.status === 409) setConflict(true);
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setSelected(storedServices); setLead(storedLead); setRationale(storedRationale);
    setError(null); setSuccess(null);
  }

  const openCell = openCode ? cellByCode[openCode] : null;
  const openService = openCode ? catalogByCode[openCode] : null;
  const answeredTotal = (progress || []).reduce((acc, p) => ({ a: acc.a + p.answered, t: acc.t + p.total }), { a: 0, t: 0 });

  return (
    <form onSubmit={handleSave}>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        How well each service fits what we know so far. Ratings are suggestions — tick
        the services to pitch and mark the lead; any service can be chosen whatever its
        rating. Click a cell to see the answers behind it.
      </p>
      {answeredTotal.t > 0 && answeredTotal.a < answeredTotal.t / 2 && (
        <div className="info-banner" role="note">
          Only {answeredTotal.a} of {answeredTotal.t} questions are answered, so confidence is low. Ratings firm up as Research and Discovery fill in.
        </div>
      )}
      {result?.drift && (
        <div className="info-banner" role="note">
          Ratings have changed since services were chosen
          {decidedAt && ` ${formatDateTime(decidedAt)}`}{decidedByName && ` by ${decidedByName}`} — review the selection.
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>
            {error}
            {conflict && <>{' '}<button type="button" className="link-button" onClick={onReload}>Reload</button></>}
          </p>
        </div>
      )}
      {success && <div className="success-message"><p>{success}</p></div>}

      <div style={{ overflowX: 'auto' }}>
        <table className="scoping-grid">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Domain</span></th>
              {LEVELS.map((L) => <th key={L} scope="col">{levelNames[L]}</th>)}
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.code}>
                <th scope="row">
                  {d.name}
                  <div className="scoping-cell__meta">
                    {d.need == null ? 'Need: not enough information' : `Need ${d.need}/100`}
                  </div>
                </th>
                {LEVELS.map((L) => {
                  const code = `${d.code}_${L}`;
                  const cell = cellByCode[code];
                  const isSelected = selected.includes(code);
                  const previous = result?.previousBands?.[code];
                  const moved = previous !== undefined && previous !== (cell?.band ?? null);
                  return (
                    <td key={code}
                        className={`scoping-cell ${BAND_CLASS[cell?.band] || 'scoping-cell--insufficient'}${openCode === code ? ' is-open' : ''}`}
                        onClick={() => setOpenCode(openCode === code ? null : code)}>
                      <div className="scoping-cell__band">
                        {cell?.band || 'Not enough information'}
                        {cell?.rating != null && <span className="muted"> {cell.rating}</span>}
                      </div>
                      <div className="scoping-cell__meta">
                        {cell?.confidence} confidence · {cell?.answered}/{cell?.total} answered
                        {moved && ` · was ${previous ?? 'unrated'}`}
                      </div>
                      <div className="scoping-cell__controls" onClick={(e) => e.stopPropagation()}>
                        <label>
                          <input type="checkbox" checked={isSelected} onChange={() => togglePitch(code)} disabled={saving} />
                          Pitch
                        </label>
                        <label className={isSelected ? '' : 'muted'}>
                          <input type="radio" name="lead" value={code} checked={lead === code}
                                 onChange={() => { setSuccess(null); setLead(code); }}
                                 disabled={saving || !isSelected} />
                          Lead
                        </label>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openCell && (
        <div className="scoping-detail">
          <h4>{openCell.domainName} · {openCell.levelName}</h4>
          {openService?.description && <p style={{ marginTop: 0 }}>{openService.description}</p>}
          {openCell.contributors.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No answers feed this cell yet.</p>
          ) : (
            <>
              <strong>Why the need</strong>
              <ul>
                {openCell.contributors.filter((c) => c.kind === 'need').map((c, i) => (
                  <li key={i}>{c.label} — <em>{c.answer}</em> (+{c.points})</li>
                ))}
                {openCell.contributors.every((c) => c.kind !== 'need') && <li className="muted">Nothing yet</li>}
              </ul>
              <strong>Why this engagement level</strong>
              <ul>
                {openCell.contributors.filter((c) => c.kind === 'level').map((c, i) => (
                  <li key={i}>{c.label} — <em>{c.answer}</em> (+{c.points})</li>
                ))}
                {openCell.contributors.every((c) => c.kind !== 'level') && <li className="muted">Nothing yet</li>}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="form-group" style={{ marginTop: 'var(--space-5)' }}>
        <label htmlFor="rationale">Rationale</label>
        <textarea id="rationale" rows="4" value={rationale}
                  onChange={(e) => { setSuccess(null); setRationale(e.target.value); }}
                  maxLength={4000} disabled={saving}
                  placeholder="Why these services, and why this lead." />
      </div>

      <div className="form-actions">
        {dirty && (
          <button type="button" className="cancel-button" onClick={discard} disabled={saving}>
            Discard changes
          </button>
        )}
        <button type="submit" className="save-button" disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
