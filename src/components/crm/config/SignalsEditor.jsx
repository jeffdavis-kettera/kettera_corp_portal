// SignalsEditor — one tool's scoring for one question: for every
// option, the targets it adds points to. Saves on its own (the
// signals endpoint), independent of the question's other fields.
//
// Props:
//   toolKey, toolTitle, vocabulary [{ target, label }], pointsRange [min, max]
//   options  [{ value, label, retired }]
//   signals  { [value]: [[target, points]] }
//   onSave(signals) → Promise

import { useEffect, useState } from 'react';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function normalize(signals, options) {
  const out = {};
  for (const o of options) out[o.value] = (signals?.[o.value] || []).map(([t, p]) => [t, Number(p)]);
  return out;
}

export default function SignalsEditor({ toolKey, toolTitle, vocabulary, pointsRange, options, signals, onSave }) {
  const [draft, setDraft] = useState(() => normalize(signals, options));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const storedKey = JSON.stringify([signals, options.map((o) => o.value)]);
  useEffect(() => { setDraft(normalize(signals, options)); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [storedKey]);

  const dirty = !same(draft, normalize(signals, options));
  const [min, max] = pointsRange;
  const labelFor = Object.fromEntries(vocabulary.map((v) => [v.target, v.label]));

  function update(value, rows) {
    setSuccess(null);
    setDraft((d) => ({ ...d, [value]: rows }));
  }

  async function handleSave() {
    if (!dirty || saving) return;
    for (const [value, rows] of Object.entries(draft)) {
      const seen = new Set();
      for (const [t] of rows) {
        if (!t) return setError(`Pick a target for every signal on "${options.find((o) => o.value === value)?.label || value}".`);
        if (seen.has(t)) return setError(`"${labelFor[t] || t}" appears twice on "${options.find((o) => o.value === value)?.label || value}".`);
        seen.add(t);
      }
    }
    setSaving(true); setError(null); setSuccess(null);
    try {
      await onSave(draft);
      setSuccess('Scoring saved.');
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="signals-editor">
      <p className="muted" style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
        What each answer adds for <strong>{toolTitle}</strong>. An option with no signals is context only.
        Points run from {min} to {max}.
      </p>
      {error && <div className="error-message"><p>{error}</p></div>}
      {success && <div className="success-message"><p>{success}</p></div>}

      {options.map((o) => {
        const rows = draft[o.value] || [];
        return (
          <div key={o.value} className="signals-option">
            <div className="signals-option__head">
              <strong>{o.label}</strong>
              {o.retired && <span className="muted"> (retired)</span>}
              <span className="muted" style={{ fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-2)' }}><code>{o.value}</code></span>
            </div>
            {rows.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>No signals — context only.</p>}
            {rows.map(([target, points], i) => (
              <div key={i} className="signal-row">
                <select value={target} aria-label="Target" disabled={saving}
                        onChange={(e) => update(o.value, rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))}>
                  <option value="">Choose a target…</option>
                  {vocabulary.map((v) => <option key={v.target} value={v.target}>{v.label}</option>)}
                </select>
                <input type="number" value={points} min={min} max={max} step="1" aria-label="Points" disabled={saving}
                       onChange={(e) => update(o.value, rows.map((r, j) => (j === i ? [r[0], e.target.value === '' ? 0 : Number(e.target.value)] : r)))} />
                <button type="button" className="link-button" disabled={saving}
                        onClick={() => update(o.value, rows.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            <button type="button" className="link-button" disabled={saving} style={{ fontSize: 'var(--font-size-sm)' }}
                    onClick={() => update(o.value, [...rows, ['', 1]])}>+ Add signal</button>
          </div>
        );
      })}

      <div className="form-actions">
        {dirty && (
          <button type="button" className="cancel-button" onClick={() => setDraft(normalize(signals, options))} disabled={saving}>Discard</button>
        )}
        <button type="button" className="save-button" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving…' : `Save scoring for ${toolTitle}`}
        </button>
      </div>
      <input type="hidden" value={toolKey} readOnly />
    </div>
  );
}
