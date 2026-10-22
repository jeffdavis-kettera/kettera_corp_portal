// DeliverablesPicker — the final step of a Deliverables tool: the
// service's catalog ranked from the answers, with a checkbox,
// quantity and notes per item, and notes for the engagement as a
// whole. Saving the selection is what chooses the deliverables.
//
// Ratings come from the API; "Why?" opens the answers behind an item.

import { useEffect, useMemo, useState } from 'react';

const BANDS = [
  { key: 'Recommended',  title: 'Recommended',   hint: 'Core items for this service, and anything the answers point to strongly.' },
  { key: 'Consider',     title: 'Consider',      hint: 'Some signal in the answers. Include if it fits the budget and the room.' },
  { key: 'NotIndicated', title: 'Not indicated', hint: 'Nothing in the answers calls for these. Still available.' },
];
const BAND_CLASS = { Recommended: 'band-chip band-chip--recommended', Consider: 'band-chip band-chip--consider', NotIndicated: 'band-chip band-chip--not' };

const toMap = (items) => Object.fromEntries((items || []).map((i) => [i.code, { quantity: i.quantity ?? 1, notes: i.notes ?? '' }]));
const sameSelection = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

export default function DeliverablesPicker({ result, decision, version, onSave, onReload, onDirtyChange }) {
  const storedMap = useMemo(() => toMap(decision?.items), [decision]);
  const storedNotes = decision?.notes ?? '';

  const [selected, setSelected] = useState(storedMap);   // code → { quantity, notes }
  const [notes, setNotes] = useState(storedNotes);
  const [openCode, setOpenCode] = useState(null);
  const [showNotIndicated, setShowNotIndicated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState(null);

  const storedKey = JSON.stringify([storedMap, storedNotes]);
  useEffect(() => {
    setSelected(storedMap);
    setNotes(storedNotes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey]);

  const dirty = !sameSelection(selected, storedMap) || notes.trim() !== storedNotes.trim();
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const items = result?.items || [];
  const byBand = Object.fromEntries(BANDS.map((b) => [b.key, items.filter((i) => i.band === b.key)]));
  const count = Object.keys(selected).length;

  function toggle(item) {
    setSuccess(null);
    setSelected((cur) => {
      const next = { ...cur };
      if (next[item.code]) delete next[item.code];
      else next[item.code] = { quantity: item.defaultQuantity || 1, notes: '' };
      return next;
    });
  }
  function update(code, patch) {
    setSuccess(null);
    setSelected((cur) => ({ ...cur, [code]: { ...cur[code], ...patch } }));
  }
  function includeRecommended() {
    setSuccess(null);
    setSelected((cur) => {
      const next = { ...cur };
      for (const i of byBand.Recommended) if (!next[i.code]) next[i.code] = { quantity: i.defaultQuantity || 1, notes: '' };
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!dirty || saving) return;
    for (const [code, v] of Object.entries(selected)) {
      const q = Number(v.quantity);
      if (!Number.isInteger(q) || q < 1 || q > 999) {
        return setError(`Quantity for "${items.find((i) => i.code === code)?.name || code}" must be a whole number from 1 to 999.`);
      }
    }
    setSaving(true); setError(null); setSuccess(null); setConflict(false);
    try {
      // Keep catalog order so the proposal reads top to bottom.
      const ordered = items.filter((i) => selected[i.code]).map((i) => ({
        code: i.code, quantity: Number(selected[i.code].quantity), notes: selected[i.code].notes?.trim() || null,
      }));
      await onSave({ items: ordered, notes: notes.trim() || null }, version);
      setSuccess(ordered.length ? 'Deliverables saved.' : 'Selection cleared.');
    } catch (err) {
      if (err.status === 409) setConflict(true);
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setSelected(storedMap); setNotes(storedNotes);
    setError(null); setSuccess(null);
  }

  const lowInfo = result && result.total > 0 && result.answered < result.total / 2;

  function renderRow(item) {
    const picked = selected[item.code];
    const open = openCode === item.code;
    return (
      <div key={item.code} className={`deliverable-row${picked ? ' is-selected' : ''}`}>
        <div className="deliverable-row__main">
          <label className="deliverable-row__pick">
            <input type="checkbox" checked={Boolean(picked)} onChange={() => toggle(item)} disabled={saving} />
            <span>
              <strong>{item.name}</strong>
              {item.category && <span className="deliverable-row__category">{item.category}</span>}
              {item.isCore && <span className="deliverable-row__category">Core</span>}
            </span>
          </label>
          <span className={BAND_CLASS[item.band]}>
            {item.band === 'NotIndicated' ? 'Not indicated' : item.band}{item.points > 0 && !item.isCore ? ` · ${item.points}` : ''}
          </span>
          <button type="button" className="link-button" onClick={() => setOpenCode(open ? null : item.code)}>
            {open ? 'Hide' : 'Why?'}
          </button>
        </div>
        {open && (
          <div className="deliverable-row__why">
            {item.description && <p style={{ marginTop: 0 }}>{item.description}</p>}
            {item.isCore && <p className="muted" style={{ margin: 0 }}>Included in every {''}engagement of this service.</p>}
            {item.contributors.length > 0 ? (
              <ul>
                {item.contributors.map((c, i) => <li key={i}>{c.label} — <em>{c.answer}</em> (+{c.points})</li>)}
              </ul>
            ) : !item.isCore && <p className="muted" style={{ margin: 0 }}>No answers point to this yet.</p>}
          </div>
        )}
        {picked && (
          <div className="deliverable-row__details">
            <label>
              Quantity
              <input type="number" min="1" max="999" step="1" value={picked.quantity}
                     onChange={(e) => update(item.code, { quantity: e.target.value })} disabled={saving} />
              <span className="muted">{item.unit}{Number(picked.quantity) === 1 ? '' : 's'}</span>
            </label>
            <label className="deliverable-row__notes">
              Notes
              <input type="text" value={picked.notes} maxLength={1000}
                     onChange={(e) => update(item.code, { notes: e.target.value })} disabled={saving}
                     placeholder="Scope, audience, timing for this item…" />
            </label>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave}>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        What this engagement could include, ranked from the answers so far. Tick what goes in the
        proposal and set quantities; any item can be included whatever its rating.
      </p>
      {lowInfo && (
        <div className="info-banner" role="note">
          Only {result.answered} of {result.total} scoring questions are answered, so the ranking is rough. It sharpens as the assessments fill in.
        </div>
      )}
      {error && (
        <div className="error-message">
          <p>{error}{conflict && <>{' '}<button type="button" className="link-button" onClick={onReload}>Reload</button></>}</p>
        </div>
      )}
      {success && <div className="success-message"><p>{success}</p></div>}

      <div className="deliverables-toolbar">
        <span className="muted">{count} {count === 1 ? 'item' : 'items'} selected</span>
        <button type="button" className="link-button" onClick={includeRecommended} disabled={saving}>Include all recommended</button>
      </div>

      {BANDS.map((band) => {
        const list = byBand[band.key];
        if (!list.length) return null;
        const collapsed = band.key === 'NotIndicated' && !showNotIndicated;
        return (
          <section key={band.key} className="deliverable-band">
            <div className="deliverable-band__head">
              <h3>{band.title} <span className="muted">({list.length})</span></h3>
              <p className="muted">{band.hint}</p>
              {band.key === 'NotIndicated' && (
                <button type="button" className="link-button" onClick={() => setShowNotIndicated(!showNotIndicated)}>
                  {collapsed ? 'Show' : 'Hide'}
                </button>
              )}
            </div>
            {!collapsed && list.map(renderRow)}
          </section>
        );
      })}

      <div className="form-group" style={{ marginTop: 'var(--space-5)' }}>
        <label htmlFor="deliverableNotes">Engagement notes</label>
        <textarea id="deliverableNotes" rows="4" value={notes}
                  onChange={(e) => { setSuccess(null); setNotes(e.target.value); }}
                  maxLength={4000} disabled={saving}
                  placeholder="Sequencing, assumptions, anything the proposal writer should know." />
      </div>

      <div className="form-actions">
        {dirty && <button type="button" className="cancel-button" onClick={discard} disabled={saving}>Discard changes</button>}
        <button type="submit" className="save-button" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}
