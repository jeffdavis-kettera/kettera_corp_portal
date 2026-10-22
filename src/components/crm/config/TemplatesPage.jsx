// CRM Configuration → Templates: the Office files the proposal / SOW
// generator fills in. One card per template type (seeded by
// migration): the current file, an upload form for a new version,
// and the history with "Make current" / Delete. CRM Admins only.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../PageLayout.jsx';
import PageCard from '../../PageCard.jsx';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson } from '../../../utils/api.js';
import { formatBytes } from '../documentHelpers.js';
import { formatDateTime } from '../opportunityStages.js';
import { useRequireCrmAdmin } from './useRequireCrmAdmin.js';

const URL = `${API_BASE_URL}/crm/config/templates`;

function UploadForm({ type, maxBytes, busy, onUpload }) {
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [problem, setProblem] = useState(null);
  const inputRef = useRef(null);

  function pick(e) {
    const f = e.target.files?.[0] || null;
    setProblem(null);
    if (f && !f.name.toLowerCase().endsWith(type.accept.split(',')[0])) {
      setProblem(`${type.name} needs a ${type.fileKindLabel}.`);
      setFile(null);
      return;
    }
    if (f && f.size > maxBytes) {
      setProblem(`That file is ${formatBytes(f.size)}; the limit is ${formatBytes(maxBytes)}.`);
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function submit(e) {
    e.preventDefault();
    if (!file || busy) return;
    const form = new FormData();
    form.append('file', file, file.name);
    if (label.trim()) form.append('label', label.trim());
    if (notes.trim()) form.append('notes', notes.trim());
    form.append('makeCurrent', makeCurrent ? 'true' : 'false');
    const ok = await onUpload(form, file.name);
    if (ok) {
      setFile(null); setLabel(''); setNotes(''); setMakeCurrent(true);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <form onSubmit={submit} className="template-upload">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`file-${type.code}`}>{type.current ? 'Upload a new version' : 'Upload the template'} ({type.fileKindLabel})</label>
          <input id={`file-${type.code}`} ref={inputRef} type="file" accept={type.accept} disabled={busy} onChange={pick} />
          {problem && <small style={{ color: 'var(--color-danger-tx)' }}>{problem}</small>}
        </div>
        <div className="form-group">
          <label htmlFor={`label-${type.code}`}>Label (optional)</label>
          <input id={`label-${type.code}`} type="text" value={label} maxLength={200} disabled={busy} placeholder="e.g. v3 — after legal review"
                 onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor={`notes-${type.code}`}>Notes (optional)</label>
        <input id={`notes-${type.code}`} type="text" value={notes} maxLength={2000} disabled={busy} placeholder="What changed in this version"
               onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <label className="checkbox-inline" style={{ margin: 0 }}>
          <input type="checkbox" checked={makeCurrent} disabled={busy} onChange={(e) => setMakeCurrent(e.target.checked)} />
          <span>Make it the current template{type.current ? ' (replaces the one above for new documents)' : ''}</span>
        </label>
        <button type="submit" className="save-button" disabled={!file || busy}>{busy ? 'Uploading…' : 'Upload'}</button>
      </div>
    </form>
  );
}

function TagReference({ type }) {
  const { single, loops } = type.catalog;
  const Fields = ({ fields, depth = 0 }) => (
    <ul style={{ margin: 'var(--space-1) 0 0', paddingLeft: 'var(--space-5)' }}>
      {fields.map((f) => (
        <li key={f.tag}>
          <code>{f.fields ? `{{#${f.tag}}}…{{/${f.tag}}}` : `{{${f.tag}}}`}</code> <span className="muted">— {f.description}</span>
          {f.fields && depth < 2 && <Fields fields={f.fields} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
  return (
    <details className="tag-ref" style={{ marginTop: 'var(--space-3)' }}>
      <summary>Tags this template can use</summary>
      <p className="muted" style={{ margin: 'var(--space-2) 0' }}>
        Write a tag as <code>{'{{tag}}'}</code>. For a table row, paragraph or bullet that repeats per item, put <code>{'{{#loop}}'}</code> at the
        start and <code>{'{{/loop}}'}</code> at the end and use the item's fields inside. Multi-line text keeps its line breaks; dates read
        "October 22, 2026"; amounts read "$12,500.00".
      </p>
      <strong>Values</strong>
      <Fields fields={single} />
      <strong style={{ display: 'block', marginTop: 'var(--space-2)' }}>Repeating sections</strong>
      <Fields fields={loops} />
    </details>
  );
}

function UnknownTags({ t }) {
  if (!t.unknownTags?.length) return null;
  return (
    <div style={{ color: 'var(--color-danger-tx)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>
      Uses tags the generator doesn't fill (they'll come out blank): {t.unknownTags.map((x) => `{{${x}}}`).join(', ')}
    </div>
  );
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  useRequireCrmAdmin();

  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(null);     // type code or template id being acted on

  const load = useCallback(async () => {
    setError(null);
    try {
      setView(await authenticatedFetchJson(URL));
    } catch (err) {
      setError(err.message || 'Failed to load templates.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(key, fn, message) {
    if (busy) return false;
    setBusy(key); setError(null); setSuccess(null);
    try {
      const v = await fn();
      if (v?.types) setView(v);
      if (message) setSuccess(message);
      return true;
    } catch (err) {
      setError(err.message || 'That didn\'t work.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  const upload = (type) => (form, filename) => act(type.code,
    () => authenticatedFetchJson(`${URL}/${type.code}`, { method: 'POST', body: form }),
    `Uploaded ${filename} for ${type.name}.`);
  const makeCurrent = (type, t) => act(t.id,
    () => authenticatedFetchJson(`${URL}/${t.id}/current`, { method: 'PUT' }),
    `${t.label || t.originalFilename} is now the current ${type.name} template.`);
  const remove = (type, t) => {
    const what = t.label ? `${t.label} (${t.originalFilename})` : t.originalFilename;
    const warn = t.isCurrent ? ` It is the current ${type.name} template; the generator will have nothing to use until another is made current.` : '';
    if (!window.confirm(`Delete ${what}?${warn} This cannot be undone.`)) return;
    act(t.id, () => authenticatedFetchJson(`${URL}/${t.id}`, { method: 'DELETE' }), `Deleted ${what}.`);
  };
  const download = (t) => act(`dl-${t.id}`, async () => {
    const { url } = await authenticatedFetchJson(`${URL}/${t.id}/download`);
    window.open(url, '_blank', 'noopener');
    return null;
  });

  const back = <button type="button" className="cancel-button" onClick={() => navigate('/modules/crm/config')}>Back to Configuration</button>;
  if (loading) return <PageLayout title="CRM — Templates" actions={back}><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  if (!view) return <PageLayout title="CRM — Templates" actions={back}><div className="error-message"><p>{error || 'Templates unavailable.'}</p></div></PageLayout>;

  const who = (t) => `${formatDateTime(t.uploadedAt)}${t.uploadedByName ? ` by ${t.uploadedByName}` : ''}`;

  return (
    <PageLayout title="CRM — Templates" actions={back}>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        The Office files the proposal and SOW generator fills in. Every upload is kept as a version; the one marked
        <strong> current</strong> is what new documents are built from. Up to {formatBytes(view.maxBytes)} per file.
      </p>
      {error && <div className="error-message"><p>{error}</p></div>}
      {success && <div className="success-message"><p>{success}</p></div>}

      {view.types.map((type) => (
        <PageCard key={type.code} style={{ marginBottom: 'var(--space-5)' }}>
          <div className="config-list-head" style={{ marginBottom: 'var(--space-2)' }}>
            <div>
              <h3 style={{ margin: 0 }}>{type.name} <span className="deliverable-row__category">{type.fileKindLabel}</span></h3>
              {type.description && <p className="muted" style={{ margin: 'var(--space-1) 0 0' }}>{type.description}</p>}
            </div>
          </div>

          {type.current ? (
            <div className="info-banner" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div>
                <strong>Current:</strong> {type.current.label ? <>{type.current.label} <span className="muted">({type.current.originalFilename})</span></> : type.current.originalFilename}
                <span className="muted"> · {formatBytes(type.current.sizeBytes)} · uploaded {who(type.current)}</span>
                {type.current.notes && <div className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>{type.current.notes}</div>}
                {type.current.tags?.length > 0 && <div className="muted" style={{ fontSize: 'var(--font-size-xs)' }}>{type.current.tags.length} tags</div>}
                <UnknownTags t={type.current} />
              </div>
              <span style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="link-button" disabled={Boolean(busy)} onClick={() => download(type.current)}>Download</button>
                {' · '}
                <button type="button" className="link-button" disabled={Boolean(busy)} onClick={() => remove(type, type.current)}>Delete</button>
              </span>
            </div>
          ) : (
            <div className="error-message" style={{ marginBottom: 'var(--space-3)' }}>
              <p>No current template — the generator can't produce a {type.name} until one is uploaded.</p>
            </div>
          )}

          <UploadForm type={type} maxBytes={view.maxBytes} busy={busy === type.code} onUpload={upload(type)} />
          <TagReference type={type} />

          {type.history.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 'var(--space-4)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Previous versions</th>
                    <th style={{ width: 100 }}>Size</th>
                    <th style={{ width: 240 }}>Uploaded</th>
                    <th style={{ width: 220 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {type.history.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.label || t.originalFilename}</strong>
                        {t.label && <div className="muted" style={{ fontSize: 'var(--font-size-xs)' }}>{t.originalFilename}</div>}
                        {t.notes && <div className="muted" style={{ fontSize: 'var(--font-size-xs)' }}>{t.notes}</div>}
                        <UnknownTags t={t} />
                      </td>
                      <td className="muted">{formatBytes(t.sizeBytes)}</td>
                      <td className="muted">{who(t)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" className="link-button" disabled={Boolean(busy)} onClick={() => download(t)}>Download</button>
                        {' · '}
                        <button type="button" className="link-button" disabled={Boolean(busy)} onClick={() => makeCurrent(type, t)}>Make current</button>
                        {' · '}
                        <button type="button" className="link-button" disabled={Boolean(busy)} onClick={() => remove(type, t)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageCard>
      ))}
    </PageLayout>
  );
}
