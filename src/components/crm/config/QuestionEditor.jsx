// Question editor — a question's wording, type, scope, options, its
// scoring per tool, a live preview, retire and delete. Routes:
//   /modules/crm/config/assessments/questions/new
//   /modules/crm/config/assessments/questions/:id
//
// Rules the screen reflects (the API enforces them):
//   - key is set once; option values are set once;
//   - type and scope lock once the question has answers;
//   - an answered option can be retired but not removed;
//   - an answered question, or one in a set, can be retired but not deleted;
//   - changing the wording of an answered question is recorded.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../PageLayout.jsx';
import PageCard from '../../PageCard.jsx';
import FormActions from '../../FormActions.jsx';
import QuestionField from '../assessments/QuestionField.jsx';
import SignalsEditor from './SignalsEditor.jsx';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../../utils/api.js';
import { DOMAINS } from '../services.js';
import { formatDateTime } from '../opportunityStages.js';
import {
  CONFIG_BASE, QUESTION_TYPES, SCOPES, OPTION_TYPES, AGREE_OPTIONS, snakeCase, suggestQuestionKey,
} from './paths.js';
import { useRequireCrmAdmin } from './useRequireCrmAdmin.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let tempId = -1;

export default function QuestionEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  useRequireCrmAdmin();
  const url = `${API_BASE_URL}/crm/config/questions${isNew ? '' : `/${id}`}`;

  const [loaded, setLoaded] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewValue, setPreviewValue] = useState(null);

  const [scope, setScope] = useState('opportunity');
  const [type, setType] = useState('single');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [label, setLabel] = useState('');
  const [help, setHelp] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [retired, setRetired] = useState(false);
  // [{ id, value, label, retired, answered, valueTouched }]; new options have a negative id
  const [options, setOptions] = useState([]);

  const fill = useCallback((qn) => {
    setLoaded(qn);
    setScope(qn.scope); setType(qn.type); setKey(qn.key); setLabel(qn.label);
    setHelp(qn.help || ''); setPlaceholder(qn.placeholder || '');
    setMaxLength(qn.maxLength == null ? '' : String(qn.maxLength));
    setRetired(qn.retired);
    setOptions(qn.options.map((o) => ({ ...o, valueTouched: true })));
  }, []);

  const load = useCallback(async () => {
    if (isNew) return;
    setError(null);
    try {
      fill(await authenticatedFetchJson(url));
    } catch (err) {
      setError(err.message || 'Failed to load question.');
    } finally {
      setLoading(false);
    }
  }, [isNew, url, fill]);
  useEffect(() => { load(); }, [load]);

  // Suggested key while creating; standard options when switching a new question to "agree".
  useEffect(() => {
    if (isNew && !keyTouched) setKey(suggestQuestionKey(scope, label));
  }, [isNew, keyTouched, scope, label]);
  useEffect(() => {
    if (isNew && type === 'agree' && options.length === 0) {
      setOptions(AGREE_OPTIONS.map((o) => ({ id: tempId--, ...o, retired: false, answered: false, valueTouched: true })));
    }
  }, [isNew, type, options.length]);

  const hasOptions = OPTION_TYPES.has(type);
  const isText = type === 'text' || type === 'longtext';
  const locked = Boolean(loaded?.locked);

  const draftOptions = hasOptions ? options.map((o) => ({ id: o.id > 0 ? o.id : undefined, value: o.id > 0 ? undefined : o.value, label: o.label, retired: o.retired })) : [];
  const dirty = isNew
    ? Boolean(label.trim())
    : loaded && !same(
      { scope, type, label: label.trim(), help: help.trim(), placeholder: placeholder.trim(), maxLength: maxLength === '' ? null : Number(maxLength), retired,
        options: draftOptions.map((o) => [o.id, o.label, o.retired]) },
      { scope: loaded.scope, type: loaded.type, label: loaded.label, help: loaded.help || '', placeholder: loaded.placeholder || '', maxLength: loaded.maxLength ?? null, retired: loaded.retired,
        options: loaded.options.map((o) => [o.id, o.label, o.retired]) },
    );

  function updateOption(i, patch) {
    setSuccess(null);
    setOptions((list) => list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }
  function addOption() {
    setSuccess(null);
    setOptions((list) => [...list, { id: tempId--, value: '', label: '', retired: false, answered: false, valueTouched: false }]);
  }
  function moveOption(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    setOptions(next);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (saving || !dirty) return;
    if (!label.trim()) return setError('Label is required.');
    if (hasOptions && options.some((o) => !o.label.trim())) return setError('Every option needs a label.');
    setSaving(true); setError(null); setSuccess(null);
    try {
      const body = {
        label: label.trim(), help: help.trim() || null, placeholder: placeholder.trim() || null,
        maxLength: isText && maxLength !== '' ? Number(maxLength) : null,
        options: hasOptions ? options.map((o) => ({
          id: o.id > 0 ? o.id : undefined,
          value: o.id > 0 ? undefined : (o.value.trim() || snakeCase(o.label)),
          label: o.label.trim(), retired: o.retired,
        })) : [],
      };
      if (isNew) {
        const created = await authenticatedFetchJson(url, { method: 'POST', body: { ...body, scope, type, key: key.trim() || undefined } });
        navigate(`${CONFIG_BASE}/questions/${created.id}`, { replace: true });
      } else {
        const updated = await authenticatedFetchJson(url, { method: 'PUT', body: { ...body, scope, type, retired, expectedUpdatedAt: loaded.updatedAt } });
        fill(updated);
        setSuccess('Saved.');
      }
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew || deleting) return;
    if (!window.confirm(`Delete question "${loaded.label}"? This cannot be undone.`)) return;
    setDeleting(true); setError(null);
    try {
      const res = await authenticatedFetch(url, { method: 'DELETE' });
      if (res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status}).`);
      }
      navigate(`${CONFIG_BASE}/questions`, { replace: true });
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  async function saveSignals(toolKey, signals) {
    await authenticatedFetchJson(`${API_BASE_URL}/crm/config/scoring/${toolKey}/questions/${id}`, { method: 'PUT', body: { signals } });
    await load();
  }

  if (loading) return <PageLayout title="Question"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;

  // The question as the form renderer sees it, from the draft.
  const previewQuestion = {
    key: key || 'preview', scope, type, label: label || 'Question label', help: help || null, placeholder: placeholder || null,
    options: hasOptions ? options.filter((o) => !o.retired).map((o) => ({ value: o.value || snakeCase(o.label) || String(o.id), label: o.label || '…' })) : null,
    maxLength: isText && maxLength !== '' ? Number(maxLength) : null,
    domains: type === 'domainGrid' ? DOMAINS : undefined,
  };

  return (
    <PageLayout
      title={isNew ? 'Add Question' : `Question — ${loaded?.label || ''}`}
      actions={!isNew && (
        <button type="button" className="cancel-button" onClick={handleDelete} disabled={deleting}
                style={{ color: 'var(--color-danger-tx)', borderColor: 'var(--color-danger-tx)' }}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      )}
    >
      <PageCard className="profile-card--form">
        {error && <div className="error-message"><p>{error}</p></div>}
        {success && <div className="success-message"><p>{success}</p></div>}
        {locked && (
          <div className="info-banner" role="note">
            This question has {loaded.answerCount} {loaded.answerCount === 1 ? 'answer' : 'answers'}, so its type and scope are
            locked and answered options can only be retired. If the meaning needs to change, retire it and create a replacement.
          </div>
        )}

        <form onSubmit={handleSave} className="form-stack">
          <div className="form-group">
            <label htmlFor="label">Question *</label>
            <input id="label" type="text" value={label} onChange={(e) => { setSuccess(null); setLabel(e.target.value); }} maxLength={500} required disabled={saving} autoFocus={isNew} />
            {!isNew && loaded.wordingChangedAt && (
              <p className="question__meta">Wording last changed {formatDateTime(loaded.wordingChangedAt)}.</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="scope">Scope</label>
            <select id="scope" value={scope} onChange={(e) => setScope(e.target.value)} disabled={saving || locked}>
              {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="type">Type</label>
            <select id="type" value={type} onChange={(e) => { setType(e.target.value); setSuccess(null); }} disabled={saving || locked}>
              {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="key">Key</label>
            {isNew ? (
              <input id="key" type="text" value={key} onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }} maxLength={100} disabled={saving}
                     placeholder="group.camelCaseName" />
            ) : (
              <div className="static-field"><code>{loaded.key}</code></div>
            )}
            <p className="question__help">Set once, never changes. Answers and scoring reference it.</p>
          </div>

          <div className="form-group">
            <label htmlFor="help">Help text</label>
            <input id="help" type="text" value={help} onChange={(e) => setHelp(e.target.value)} maxLength={1000} disabled={saving}
                   placeholder="Shown under the question" />
          </div>

          {isText && (
            <>
              <div className="form-group">
                <label htmlFor="placeholder">Placeholder</label>
                <input id="placeholder" type="text" value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} maxLength={300} disabled={saving} />
              </div>
              <div className="form-group">
                <label htmlFor="maxLength">Max length</label>
                <input id="maxLength" type="number" min="1" max="2000" value={maxLength} onChange={(e) => setMaxLength(e.target.value)} disabled={saving}
                       placeholder="2000" style={{ maxWidth: 160 }} />
              </div>
            </>
          )}

          {hasOptions && (
            <div className="form-group">
              <label>Options{type === 'domainGrid' && ' (one choice per domain)'}</label>
              {type === 'agree' && <p className="question__help">Agree questions use the standard three options; you can reword them.</p>}
              {options.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>No options yet.</p>
              ) : (
                <div className="profile-card" style={{ padding: 0, overflowX: 'auto', marginBottom: 'var(--space-3)' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Label</th><th style={{ width: 180 }}>Value</th><th style={{ width: 90 }}>Retired</th><th style={{ width: 220 }}></th></tr>
                    </thead>
                    <tbody>
                      {options.map((o, i) => (
                        <tr key={o.id}>
                          <td>
                            <input type="text" value={o.label} aria-label={`Option ${i + 1} label`} disabled={saving} maxLength={300}
                                   onChange={(e) => updateOption(i, { label: e.target.value, ...(o.id < 0 && !o.valueTouched ? { value: snakeCase(e.target.value) } : {}) })} />
                          </td>
                          <td>
                            {o.id > 0 ? (
                              <code className="muted">{o.value}</code>
                            ) : (
                              <input type="text" value={o.value} aria-label={`Option ${i + 1} value`} disabled={saving} maxLength={50}
                                     onChange={(e) => updateOption(i, { value: e.target.value, valueTouched: true })} placeholder="auto" />
                            )}
                            {o.answered && <div className="muted" style={{ fontSize: 'var(--font-size-xs)' }}>answered</div>}
                          </td>
                          <td>
                            <input type="checkbox" checked={o.retired} aria-label={`Retire option ${i + 1}`} disabled={saving}
                                   onChange={(e) => updateOption(i, { retired: e.target.checked })} />
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button type="button" className="link-button" onClick={() => moveOption(i, -1)} disabled={saving || i === 0}>Up</button>
                            {' · '}
                            <button type="button" className="link-button" onClick={() => moveOption(i, 1)} disabled={saving || i === options.length - 1}>Down</button>
                            {' · '}
                            <button type="button" className="link-button" disabled={saving || o.answered}
                                    title={o.answered ? 'This option has been answered — retire it instead' : undefined}
                                    onClick={() => setOptions((list) => list.filter((_, j) => j !== i))}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button type="button" className="link-button" onClick={addOption} disabled={saving}>+ Add option</button>
            </div>
          )}

          {!isNew && (
            <>
              <div className="form-group">
                <label className="checkbox-list__item" style={{ display: 'inline-flex' }}>
                  <input type="checkbox" checked={retired} onChange={(e) => setRetired(e.target.checked)} disabled={saving} />
                  Retired — hidden from new forms, shown read-only where already answered
                </label>
              </div>
              <div className="form-group">
                <label>Used in sets</label>
                {loaded.usedInSets.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>Not in any set yet.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
                    {loaded.usedInSets.map((s) => <li key={s.id}><Link to={`${CONFIG_BASE}/sets/${s.id}`}>{s.name}</Link></li>)}
                  </ul>
                )}
              </div>
            </>
          )}

          <FormActions
            onCancel={() => navigate(`${CONFIG_BASE}/questions`)}
            cancelText={isNew ? 'Cancel' : 'Back to Questions'}
            submitText={isNew ? 'Add question' : 'Save changes'}
            submittingText="Saving…"
            isSubmitting={saving}
            disableSubmit={!dirty}
          />
        </form>
      </PageCard>

      <PageCard className="profile-card--form">
        <h2 style={{ marginTop: 0 }}>Preview</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 'var(--font-size-sm)' }}>How the question looks in an assessment. Try it — nothing is saved.</p>
        <QuestionField question={previewQuestion} value={previewValue} note={null}
                       onChange={setPreviewValue} onNoteChange={() => {}} />
      </PageCard>

      {!isNew && hasOptions && Object.keys(loaded.scoring || {}).length > 0 && (
        <PageCard className="profile-card--form">
          <h2 style={{ marginTop: 0 }}>Scoring</h2>
          {dirty && <div className="info-banner" role="note">Save the question first — scoring is saved separately and uses the saved options.</div>}
          {Object.entries(loaded.scoring).map(([toolKey, s]) => (
            <SignalsEditor
              key={toolKey}
              toolKey={toolKey}
              toolTitle={s.toolTitle}
              vocabulary={s.vocabulary}
              pointsRange={s.pointsRange}
              options={loaded.options}
              signals={s.signals}
              onSave={(signals) => saveSignals(toolKey, signals)}
            />
          ))}
        </PageCard>
      )}
    </PageLayout>
  );
}
