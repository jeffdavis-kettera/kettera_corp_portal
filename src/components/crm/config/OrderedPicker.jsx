// OrderedPicker — an ordered selection built from a pool of items:
// the chosen items in a table with Move up / Move down / Remove, and
// a search box over the rest with Add. Used for the questions in a
// set, the sets in an assessment, and the assessments a tool shows.
//
// Props:
//   selectedIds — ordered ids
//   available   — [{ id, label, sub?, retired? }]
//   onChange(ids)
//   addLabel, searchPlaceholder, emptyText, disabled

import { useState } from 'react';

export default function OrderedPicker({
  selectedIds, available, onChange,
  searchPlaceholder = 'Search…', emptyText = 'Nothing selected yet.', disabled = false,
}) {
  const [q, setQ] = useState('');
  const byId = Object.fromEntries(available.map((a) => [a.id, a]));
  const selectedSet = new Set(selectedIds);
  const needle = q.trim().toLowerCase();
  const candidates = available
    .filter((a) => !selectedSet.has(a.id))
    .filter((a) => !needle || a.label.toLowerCase().includes(needle) || (a.sub || '').toLowerCase().includes(needle))
    .slice(0, 25);

  function move(index, delta) {
    const next = [...selectedIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="ordered-picker">
      {selectedIds.length === 0 ? (
        <div className="no-users">{emptyText}</div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto', marginBottom: 'var(--space-4)' }}>
          <table className="data-table">
            <tbody>
              {selectedIds.map((id, i) => {
                const item = byId[id] || { label: `#${id}` };
                return (
                  <tr key={id}>
                    <td className="muted" style={{ width: 40 }}>{i + 1}</td>
                    <td>
                      <strong>{item.label}</strong>
                      {item.retired && <span className="muted"> (retired)</span>}
                      {item.sub && <div className="muted" style={{ fontSize: 'var(--font-size-xs)' }}>{item.sub}</div>}
                    </td>
                    <td style={{ width: 230, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="link-button" onClick={() => move(i, -1)} disabled={disabled || i === 0}>Move up</button>
                      {' · '}
                      <button type="button" className="link-button" onClick={() => move(i, 1)} disabled={disabled || i === selectedIds.length - 1}>Move down</button>
                      {' · '}
                      <button type="button" className="link-button" onClick={() => onChange(selectedIds.filter((x) => x !== id))} disabled={disabled}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="form-group">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder={searchPlaceholder} aria-label={searchPlaceholder} disabled={disabled} />
      </div>
      {candidates.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
          {available.length === selectedIds.length ? 'Everything available is already selected.' : 'No matches.'}
        </p>
      ) : (
        <ul className="candidate-list">
          {candidates.map((a) => (
            <li key={a.id}>
              <button type="button" className="candidate-list__item" onClick={() => onChange([...selectedIds, a.id])} disabled={disabled}>
                <span className="candidate-list__name">{a.label}{a.retired && <span className="muted"> (retired)</span>}</span>
                <span className="candidate-list__email">{a.sub}</span>
                <span className="role-badge role-badge--basic">Add</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
