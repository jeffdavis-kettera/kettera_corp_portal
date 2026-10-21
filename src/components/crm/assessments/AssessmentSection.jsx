// AssessmentSection — renders one assessment (its sections and
// questions) with per-section save. Generic: used by Service Scoping
// for Research and Discovery, by the company profile card, and by
// any later questionnaire-style tool.
//
// Props:
//   assessment    — public assessment from the API (sections → questions, usedBy)
//   answers       — map key → { value, note, updatedAt, updatedByName }; may
//                   hold more keys than this assessment uses
//   save(changes) — async; receives [{ key, value, note, expectedUpdatedAt }]
//                   and resolves to the fresh answers map for these keys
//   onSaved(answers), onReload(), onDirtyChange(bool)
//   disabled
//
// Only changed answers are sent, each with the updatedAt the client
// last saw. On 409 answer_conflict the clashing questions are marked
// and the message offers Reload; the user's other unsaved edits are
// kept.

import { useEffect, useState } from 'react';
import QuestionField from './QuestionField.jsx';
import { formatDateTime } from '../opportunityStages.js';

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function metaFor(question, stored) {
  if (!stored.updatedAt) return null;
  let text = `Updated ${formatDateTime(stored.updatedAt)}${stored.updatedByName ? ` by ${stored.updatedByName}` : ''}`;
  if (question.wordingChangedAt && new Date(question.wordingChangedAt) > new Date(stored.updatedAt)) {
    text += ' · the wording of this question changed after it was answered';
  }
  return text;
}

export default function AssessmentSection({
  assessment, answers, save, onSaved, onReload, onDirtyChange, disabled = false,
}) {
  const [draft, setDraft] = useState({});          // key → { value, note }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [conflictKeys, setConflictKeys] = useState([]);

  const stored = (key) => answers[key] || { value: null, note: null };
  const current = (key) => ({
    value: key in draft ? draft[key].value : stored(key).value,
    note: key in draft ? draft[key].note : stored(key).note,
  });

  const changedKeys = Object.keys(draft).filter((key) => {
    const s = stored(key);
    return !same(draft[key].value, s.value) || !same(draft[key].note, s.note);
  });
  const dirty = changedKeys.length > 0;

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function setValue(key, value) {
    setSuccess(null);
    setDraft((d) => ({ ...d, [key]: { value, note: key in d ? d[key].note : stored(key).note } }));
  }
  function setNote(key, note) {
    setSuccess(null);
    setDraft((d) => ({ ...d, [key]: { value: key in d ? d[key].value : stored(key).value, note } }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true); setError(null); setSuccess(null); setConflictKeys([]);
    try {
      const changes = changedKeys.map((key) => ({
        key,
        value: draft[key].value,
        note: draft[key].note ?? null,
        expectedUpdatedAt: stored(key).updatedAt ?? null,
      }));
      const fresh = await save(changes);
      setDraft({});
      setSuccess('Saved.');
      onSaved?.(fresh);
    } catch (err) {
      if (err.status === 409 && err.code === 'answer_conflict') {
        const keys = err.details?.keys || [];
        setConflictKeys(keys);
        // Drop the clashing edits; keep the rest so they aren't lost.
        setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !keys.includes(k))));
        setError(err.message || 'Someone else saved these answers since you opened them.');
      } else {
        setError(err.message || 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleReload() {
    setConflictKeys([]); setError(null);
    onReload?.();
  }

  const usedBy = assessment.usedBy || [];

  return (
    <form onSubmit={handleSave} className="assessment">
      {assessment.description && (
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>{assessment.description}</p>
      )}
      {usedBy.length > 0 && (
        <p className="muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 0 }}>
          Also used by {usedBy.map((t) => t.title).join(', ')}. Answers saved here appear there too.
        </p>
      )}

      {error && (
        <div className="error-message">
          <p>
            {error}
            {conflictKeys.length > 0 && (
              <>
                {' '}
                <button type="button" className="link-button" onClick={handleReload}>Reload</button>
              </>
            )}
          </p>
        </div>
      )}
      {success && <div className="success-message"><p>{success}</p></div>}

      {assessment.sections.map((section) => {
        const visible = section.questions.filter((q) => !q.retired || stored(q.key).value != null);
        if (visible.length === 0) return null;
        const companySection = visible.every((q) => q.scope === 'company');
        return (
          <section key={section.key} className="assessment-section">
            {(section.title || section.description || companySection) && (
              <div className="assessment-section__head">
                {section.title && <h3>{section.title}</h3>}
                {section.description && (
                  <p className="muted" style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>{section.description}</p>
                )}
                {companySection && (
                  <span className="assessment-section__shared">
                    Stored on the company record · shared by every opportunity
                  </span>
                )}
              </div>
            )}
            <div className="form-stack">
              {visible.map((q) => {
                const cur = current(q.key);
                return (
                  <QuestionField
                    key={q.key}
                    question={q}
                    value={cur.value}
                    note={cur.note}
                    onChange={(v) => setValue(q.key, v)}
                    onNoteChange={(n) => setNote(q.key, n)}
                    showNote
                    meta={metaFor(q, stored(q.key))}
                    conflict={conflictKeys.includes(q.key)}
                    disabled={disabled || saving || q.retired}
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="form-actions">
        {dirty && (
          <button type="button" className="cancel-button" onClick={() => setDraft({})} disabled={saving}>
            Discard changes
          </button>
        )}
        <button type="submit" className="save-button" disabled={!dirty || saving || disabled}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
