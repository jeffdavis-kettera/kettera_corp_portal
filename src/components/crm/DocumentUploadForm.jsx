// /modules/crm/companies/:id/documents/upload — file upload form.
// Multipart POST via FormData; api.js sends it through without
// forcing a JSON Content-Type.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { DOCUMENT_TYPES, formatBytes } from './documentHelpers.js';

const MAX_UPLOAD_MB = 100;

export default function DocumentUploadForm() {
  const { id: companyId } = useParams();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [documentType, setDocumentType] = useState('Other');
  const [contactId, setContactId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load contacts + opportunities for the anchor dropdowns.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, o] = await Promise.all([
          authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}/contacts`),
          authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}/opportunities?limit=200`),
        ]);
        if (cancelled) return;
        setContacts(c.contacts || []);
        setOpportunities(o.opportunities || []);
      } catch { /* non-fatal; user can still upload without anchoring */ }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const handleFileChange = useCallback((e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    // Auto-fill title from filename if the user hasn't touched
    // the title field yet.
    if (f && !titleTouched) {
      // Strip extension for a nicer default.
      const withoutExt = f.name.replace(/\.[^.]+$/, '');
      setTitle(withoutExt || f.name);
    }
  }, [titleTouched]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!file) return setError('Please choose a file to upload.');
    if (!title.trim()) return setError('Title is required.');
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return setError(`File exceeds the ${MAX_UPLOAD_MB} MB limit.`);
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title.trim());
      form.append('documentType', documentType);
      if (contactId) form.append('contactId', contactId);
      if (opportunityId) form.append('opportunityId', opportunityId);
      if (notes.trim()) form.append('notes', notes.trim());

      const created = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/documents`,
        { method: 'POST', body: form }
      );
      navigate(`/modules/crm/companies/${companyId}/documents/${created.id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title="Upload Document">
      <PageCard className="profile-card--form">
        {error && <div className="error-message"><p>{error}</p></div>}
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label htmlFor="file">File *</label>
            <input
              id="file"
              type="file"
              onChange={handleFileChange}
              disabled={submitting}
              // Not restricting accept="..." — CRM docs vary widely
              // (PDF, DOCX, XLSX, PPTX, images, ZIP). API enforces
              // the size cap; browser lets anything through.
            />
            {file && (
              <div className="muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                {file.name} · {formatBytes(file.size)}
                {file.type && ` · ${file.type}`}
              </div>
            )}
            <div className="muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>
              Max size {MAX_UPLOAD_MB} MB. For anything larger, link to a cloud-storage
              URL from the notes field instead.
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input id="title" type="text" value={title}
                   onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
                   maxLength={300} required disabled={submitting}
                   placeholder="How this document is referenced in the app" />
            <div className="muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>
              Defaults to the filename; edit for a friendlier label.
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="documentType">Type</label>
            <select id="documentType" value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    disabled={submitting}>
              {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="contactId">Attach to contact (optional)</label>
            <select id="contactId" value={contactId}
                    onChange={(e) => setContactId(e.target.value)}
                    disabled={submitting}>
              <option value="">— None —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="opportunityId">Attach to opportunity (optional)</label>
            <select id="opportunityId" value={opportunityId}
                    onChange={(e) => setOpportunityId(e.target.value)}
                    disabled={submitting}>
              <option value="">— None —</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {o.stage}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" rows="4" value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={submitting}
                      placeholder="Context, source, related URLs…" />
          </div>

          <FormActions
            onCancel={() => navigate(`/modules/crm/companies/${companyId}/documents`)}
            cancelText="Cancel"
            submitText="Upload"
            submittingText="Uploading…"
            isSubmitting={submitting}
          />
        </form>
      </PageCard>
    </PageLayout>
  );
}
