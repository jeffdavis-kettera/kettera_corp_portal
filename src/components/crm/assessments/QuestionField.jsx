// QuestionField — renders one question-bank question as a form
// control. One renderer per answer type, shared by every assessment
// and by the company profile card.
//
// Props:
//   question   — public question from the API (key, type, label,
//                options, help, placeholder, maxLength, domains, retired)
//   value      — current value (null = Unknown)
//   note       — current note (opportunity-scoped questions only)
//   onChange(value), onNoteChange(note)
//   showNote   — render the collapsible "Source / notes" input
//   meta       — small line under the field ("Updated Oct 3 by Jeff")
//   conflict   — highlight: someone else saved this since we loaded it
//   disabled
//
// Uses the global form classes. Radio and checkbox lists reuse
// .checkbox-list from the document share picker; the global
// .form-group input rule already leaves checkboxes and radios alone.

import { useState } from 'react';

const UNKNOWN = '';

export default function QuestionField({
  question, value, note, onChange, onNoteChange,
  showNote = false, meta = null, conflict = false, disabled = false,
}) {
  const [noteOpen, setNoteOpen] = useState(Boolean(note));
  const id = `q-${String(question.key || 'new').replace(/\W/g, '-')}`;
  const noteVisible = showNote && (noteOpen || Boolean(note));
  const options = question.options || [];

  function renderControl() {
    switch (question.type) {
      case 'single':
      case 'agree':
        return (
          <div className={`checkbox-list${question.type === 'agree' ? ' checkbox-list--row' : ''}`} role="radiogroup" aria-labelledby={`${id}-label`}>
            {options.map((o) => (
              <label key={o.value} className="checkbox-list__item">
                <input type="radio" name={id} value={o.value}
                       checked={value === o.value}
                       onChange={() => onChange(o.value)}
                       disabled={disabled} />
                {o.label}
              </label>
            ))}
            <label className="checkbox-list__item checkbox-list__item--muted">
              <input type="radio" name={id} value={UNKNOWN}
                     checked={value == null}
                     onChange={() => onChange(null)}
                     disabled={disabled} />
              Unknown
            </label>
          </div>
        );

      case 'multi': {
        const selected = new Set(Array.isArray(value) ? value : []);
        return (
          <div className="checkbox-list" role="group" aria-labelledby={`${id}-label`}>
            {options.map((o) => (
              <label key={o.value} className="checkbox-list__item">
                <input type="checkbox" value={o.value}
                       checked={selected.has(o.value)}
                       onChange={(e) => {
                         const next = new Set(selected);
                         if (e.target.checked) next.add(o.value); else next.delete(o.value);
                         onChange(next.size ? options.map((x) => x.value).filter((v) => next.has(v)) : null);
                       }}
                       disabled={disabled} />
                {o.label}
              </label>
            ))}
          </div>
        );
      }

      case 'text':
        return (
          <input id={id} type="text" value={value ?? ''}
                 onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
                 maxLength={question.maxLength || undefined}
                 placeholder={question.placeholder || undefined}
                 disabled={disabled} />
        );

      case 'longtext':
        return (
          <textarea id={id} rows="4" value={value ?? ''}
                    onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
                    maxLength={question.maxLength || undefined}
                    placeholder={question.placeholder || undefined}
                    disabled={disabled} />
        );

      case 'domainGrid': {
        const grid = value && typeof value === 'object' ? value : {};
        return (
          <table className="domain-grid" aria-labelledby={`${id}-label`}>
            <tbody>
              {(question.domains || []).map((d) => (
                <tr key={d.code}>
                  <th scope="row">{d.name}</th>
                  <td>
                    <select value={grid[d.code] ?? UNKNOWN}
                            aria-label={`${question.label} — ${d.name}`}
                            onChange={(e) => {
                              const next = { ...grid };
                              if (e.target.value === UNKNOWN) delete next[d.code];
                              else next[d.code] = e.target.value;
                              onChange(Object.keys(next).length ? next : null);
                            }}
                            disabled={disabled}>
                      <option value={UNKNOWN}>Unknown</option>
                      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      default:
        return <p className="muted">Unsupported question type: {question.type}</p>;
    }
  }

  const usesHtmlFor = question.type === 'text' || question.type === 'longtext';

  return (
    <div className={`form-group question${conflict ? ' question--conflict' : ''}`}>
      <label id={`${id}-label`} htmlFor={usesHtmlFor ? id : undefined}>
        {question.label}
        {question.retired && <span className="muted"> (retired)</span>}
      </label>
      {question.help && <p className="question__help">{question.help}</p>}
      {renderControl()}
      {showNote && !noteVisible && !disabled && (
        <button type="button" className="link-button question__note-toggle" onClick={() => setNoteOpen(true)}>
          Add source / notes
        </button>
      )}
      {noteVisible && (
        <input type="text" className="question__note" value={note ?? ''}
               onChange={(e) => onNoteChange(e.target.value === '' ? null : e.target.value)}
               maxLength={1000}
               placeholder="Source / notes — e.g. CIO, discovery call 10/3"
               aria-label={`Source or notes for: ${question.label}`}
               disabled={disabled} />
      )}
      {conflict && <p className="question__meta question__meta--conflict">Changed by someone else since you opened this.</p>}
      {meta && <p className="question__meta">{meta}</p>}
    </div>
  );
}
