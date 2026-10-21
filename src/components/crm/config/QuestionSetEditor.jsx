// Question set editor — name, description, the ordered questions,
// retire and delete. Routes:
//   /modules/crm/config/assessments/sets/new
//   /modules/crm/config/assessments/sets/:id

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../PageLayout.jsx';
import PageCard from '../../PageCard.jsx';
import FormActions from '../../FormActions.jsx';
import OrderedPicker from './OrderedPicker.jsx';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../../utils/api.js';
import { CONFIG_BASE, TYPE_LABEL, camelCase } from './paths.js';
import { useRequireCrmAdmin } from './useRequireCrmAdmin.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function QuestionSetEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  useRequireCrmAdmin();
  const url = `${API_BASE_URL}/crm/config/question-sets${isNew ? '' : `/${id}`}`;

  const [loaded, setLoaded] = useState(null);
  const [questions, setQuestions] = useState([]);   // the bank, for the picker
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [retired, setRetired] = useState(false);
  const [questionIds, setQuestionIds] = useState([]);

  const fill = useCallback((s) => {
    setLoaded(s);
    setName(s.name); setKey(s.key); setDescription(s.description || '');
    setRetired(s.retired); setQuestionIds(s.questions.map((q) => q.id));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bank, s] = await Promise.all([
        authenticatedFetchJson(`${API_BASE_URL}/crm/config/questions`),
        isNew ? null : authenticatedFetchJson(url),
      ]);
      setQuestions(bank.questions || []);
      if (s) fill(s);
    } catch (err) {
      setError(err.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [isNew, url, fill]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isNew && !keyTouched) setKey(camelCase(name).slice(0, 60));
  }, [name, isNew, keyTouched]);

  const dirty = isNew
    ? Boolean(name.trim())
    : loaded && !same(
      { name: name.trim(), description: description.trim(), retired, questionIds },
      { name: loaded.name, description: loaded.description || '', retired: loaded.retired, questionIds: loaded.questions.map((q) => q.id) },
    );

  async function handleSave(e) {
    e.preventDefault();
    if (saving || !dirty) return;
    if (!name.trim()) return setError('Name is required.');
    setSaving(true); setError(null); setSuccess(null);
    try {
      const body = { name: name.trim(), description: description.trim() || null, questionIds };
      if (isNew) {
        const created = await authenticatedFetchJson(url, { method: 'POST', body: { ...body, key: key.trim() || undefined } });
        navigate(`${CONFIG_BASE}/sets/${created.id}`, { replace: true });
      } else {
        const updated = await authenticatedFetchJson(url, { method: 'PUT', body: { ...body, retired, expectedUpdatedAt: loaded.updatedAt } });
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
    if (!window.confirm(`Delete question set "${loaded.name}"? Its questions are kept in the bank.`)) return;
    setDeleting(true); setError(null);
    try {
      const res = await authenticatedFetch(url, { method: 'DELETE' });
      if (res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status}).`);
      }
      navigate(`${CONFIG_BASE}/sets`, { replace: true });
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <PageLayout title="Question set"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;

  return (
    <PageLayout
      title={isNew ? 'Add Question Set' : `Question set — ${loaded?.name || ''}`}
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

        <form onSubmit={handleSave} className="form-stack">
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required disabled={saving} autoFocus={isNew}
                   placeholder="Shown as the section heading" />
          </div>
          <div className="form-group">
            <label htmlFor="key">Key</label>
            {isNew ? (
              <input id="key" type="text" value={key} onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }} maxLength={100} disabled={saving}
                     placeholder="camelCase, set once" />
            ) : (
              <div className="static-field"><code>{loaded.key}</code></div>
            )}
            <p className="question__help">Set once, never changes.</p>
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea id="description" rows="2" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} disabled={saving}
                      placeholder="Shown under the section heading." />
          </div>

          <div className="form-group">
            <label>Questions, in order</label>
            <OrderedPicker
              selectedIds={questionIds}
              available={questions.map((q) => ({
                id: q.id, label: q.label, retired: q.retired,
                sub: `${q.key} · ${TYPE_LABEL[q.type] || q.type}${q.scope === 'company' ? ' · company' : ''}`,
              }))}
              onChange={setQuestionIds}
              searchPlaceholder="Add a question from the bank…"
              emptyText="No questions yet. Add some below."
              disabled={saving}
            />
            <p className="question__help">
              Need a question that isn't in the bank? <Link to={`${CONFIG_BASE}/questions/new`}>Create it</Link> first.
            </p>
          </div>

          {!isNew && (
            <>
              <div className="form-group">
                <label className="checkbox-list__item" style={{ display: 'inline-flex' }}>
                  <input type="checkbox" checked={retired} onChange={(e) => setRetired(e.target.checked)} disabled={saving} />
                  Retired — kept for history
                </label>
              </div>
              <div className="form-group">
                <label>Used by</label>
                {loaded.usedBy.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>No assessment uses this set yet.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
                    {loaded.usedBy.map((a) => <li key={a.id}><Link to={`${CONFIG_BASE}/${a.id}`}>{a.title}</Link></li>)}
                  </ul>
                )}
              </div>
            </>
          )}

          <FormActions
            onCancel={() => navigate(`${CONFIG_BASE}/sets`)}
            cancelText={isNew ? 'Cancel' : 'Back to Question Sets'}
            submitText={isNew ? 'Add question set' : 'Save changes'}
            submittingText="Saving…"
            isSubmitting={saving}
            disableSubmit={!dirty}
          />
        </form>
      </PageCard>
    </PageLayout>
  );
}
