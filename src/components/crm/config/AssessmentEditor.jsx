// Assessment editor — title, description, the ordered question sets,
// which tools show it, a preview, retire and delete. Routes:
//   /modules/crm/config/assessments/new
//   /modules/crm/config/assessments/:id

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../PageLayout.jsx';
import PageCard from '../../PageCard.jsx';
import FormActions from '../../FormActions.jsx';
import AssessmentPreview from '../assessments/AssessmentPreview.jsx';
import OrderedPicker from './OrderedPicker.jsx';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../../utils/api.js';
import { CONFIG_BASE, camelCase } from './paths.js';
import { useRequireCrmAdmin } from './useRequireCrmAdmin.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function AssessmentEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  useRequireCrmAdmin();
  const url = `${API_BASE_URL}/crm/config/assessments${isNew ? '' : `/${id}`}`;

  const [loaded, setLoaded] = useState(null);   // server copy (edit)
  const [sets, setSets] = useState([]);         // every set, for the picker
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(null);

  const [title, setTitle] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [retired, setRetired] = useState(false);
  const [setIds, setSetIds] = useState([]);
  const [toolKeys, setToolKeys] = useState([]);
  const [availableTools, setAvailableTools] = useState([]);

  const fill = useCallback((a) => {
    setLoaded(a);
    setTitle(a.title); setKey(a.key); setDescription(a.description || '');
    setRetired(a.retired); setSetIds(a.sets.map((s) => s.id)); setToolKeys(a.tools);
    setAvailableTools(a.availableTools || []);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [allSets, a] = await Promise.all([
        authenticatedFetchJson(`${API_BASE_URL}/crm/config/question-sets`),
        isNew ? authenticatedFetchJson(`${API_BASE_URL}/crm/config/assessments`) : authenticatedFetchJson(url),
      ]);
      setSets(allSets.sets || []);
      if (isNew) setAvailableTools(a.availableTools || []);
      else fill(a);
    } catch (err) {
      setError(err.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [isNew, url, fill]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isNew && !keyTouched) setKey(camelCase(title).slice(0, 60));
  }, [title, isNew, keyTouched]);

  const dirty = isNew
    ? Boolean(title.trim())
    : loaded && !same(
      { title: title.trim(), description: description.trim(), retired, setIds, toolKeys: [...toolKeys].sort() },
      { title: loaded.title, description: loaded.description || '', retired: loaded.retired, setIds: loaded.sets.map((s) => s.id), toolKeys: [...loaded.tools].sort() },
    );

  async function handleSave(e) {
    e.preventDefault();
    if (saving || !dirty) return;
    if (!title.trim()) return setError('Title is required.');
    setSaving(true); setError(null); setSuccess(null);
    try {
      const body = { title: title.trim(), description: description.trim() || null, setIds, toolKeys };
      if (isNew) {
        const created = await authenticatedFetchJson(url, { method: 'POST', body: { ...body, key: key.trim() || undefined } });
        navigate(`${CONFIG_BASE}/${created.id}`, { replace: true });
      } else {
        const updated = await authenticatedFetchJson(url, { method: 'PUT', body: { ...body, retired, expectedUpdatedAt: loaded.updatedAt } });
        fill(updated);
        setPreview(null);
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
    if (!window.confirm(`Delete assessment "${loaded.title}"? Its question sets and questions are kept.`)) return;
    setDeleting(true); setError(null);
    try {
      const res = await authenticatedFetch(url, { method: 'DELETE' });
      if (res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status}).`);
      }
      navigate(CONFIG_BASE, { replace: true });
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  async function showPreview() {
    setError(null);
    try {
      setPreview(await authenticatedFetchJson(`${url}/preview`));
    } catch (err) {
      setError(err.message || 'Preview failed.');
    }
  }

  if (loading) return <PageLayout title="Assessment"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;

  return (
    <PageLayout
      title={isNew ? 'Add Assessment' : `Assessment — ${loaded?.title || ''}`}
      actions={!isNew && (
        <>
          <button type="button" className="cancel-button" onClick={showPreview} disabled={dirty}>Preview</button>
          <button type="button" className="cancel-button" onClick={handleDelete} disabled={deleting}
                  style={{ color: 'var(--color-danger-tx)', borderColor: 'var(--color-danger-tx)' }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </>
      )}
    >
      <PageCard className="profile-card--form">
        {error && <div className="error-message"><p>{error}</p></div>}
        {success && <div className="success-message"><p>{success}</p></div>}

        <form onSubmit={handleSave} className="form-stack">
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={saving} autoFocus={isNew} />
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
                      placeholder="Shown at the top of the assessment." />
          </div>

          <div className="form-group">
            <label>Question sets, in order</label>
            <OrderedPicker
              selectedIds={setIds}
              available={sets.map((s) => ({ id: s.id, label: s.name, sub: `${s.questionCount} question${s.questionCount === 1 ? '' : 's'}`, retired: s.retired }))}
              onChange={setSetIds}
              searchPlaceholder="Add a question set…"
              emptyText="No question sets yet. Add one below."
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label>Shown in tools</label>
            {availableTools.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No tools available.</p>
            ) : (
              <div className="checkbox-list">
                {availableTools.map((t) => (
                  <label key={t.key} className="checkbox-list__item">
                    <input type="checkbox" checked={toolKeys.includes(t.key)} disabled={saving}
                           onChange={(e) => setToolKeys(e.target.checked ? [...toolKeys, t.key] : toolKeys.filter((k) => k !== t.key))} />
                    {t.title}
                  </label>
                ))}
              </div>
            )}
            <p className="question__help">The order of a tool's assessments is set on the Scoring tab.</p>
          </div>

          {!isNew && (
            <div className="form-group">
              <label className="checkbox-list__item" style={{ display: 'inline-flex' }}>
                <input type="checkbox" checked={retired} onChange={(e) => setRetired(e.target.checked)} disabled={saving} />
                Retired — hidden from tools, kept for history
              </label>
            </div>
          )}

          <FormActions
            onCancel={() => navigate(CONFIG_BASE)}
            cancelText={isNew ? 'Cancel' : 'Back to Assessments'}
            submitText={isNew ? 'Add assessment' : 'Save changes'}
            submittingText="Saving…"
            isSubmitting={saving}
            disableSubmit={!dirty}
          />
        </form>
      </PageCard>

      {preview && (
        <PageCard className="profile-card--form">
          <h2 style={{ marginTop: 0 }}>Preview</h2>
          <AssessmentPreview assessment={preview} />
        </PageCard>
      )}
    </PageLayout>
  );
}
