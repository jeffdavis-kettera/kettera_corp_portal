// /modules/crm/companies/:id/documents/:docId — edit metadata,
// download the file, or delete the record + blob.
//
// File replacement is intentionally not supported here. If a user
// wants to replace the file, they delete the row and re-upload.
// That keeps this form focused on metadata + avoids the "partial
// replacement" edge case (metadata saved, new file failed).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../utils/api.js';
import { DOCUMENT_TYPES, formatBytes, formatDate } from './documentHelpers.js';

export default function DocumentDetail() {
  const { id: companyId, docId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [doc, setDoc] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);

  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('Other');
  const [contactId, setContactId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const [d, c, o] = await Promise.all([
        authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}/documents/${docId}`),
        authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}/contacts`),
        authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}/opportunities?limit=200`),
      ]);
      setDoc(d);
      setTitle(d.title || '');
      setDocumentType(d.documentType || 'Other');
      setContactId(d.contactId ? String(d.contactId) : '');
      setOpportunityId(d.opportunityId ? String(d.opportunityId) : '');
      setNotes(d.notes || '');
      setContacts(c.contacts || []);
      setOpportunities(o.opportunities || []);
    } catch (err) {
      setError(err.message || 'Failed to load document.');
    } finally {
      setLoading(false);
    }
  }, [companyId, docId]);
  useEffect(() => { load(); }, [load]);

  const dirty = doc && (
    title !== (doc.title || '') ||
    documentType !== (doc.documentType || 'Other') ||
    contactId !== (doc.contactId ? String(doc.contactId) : '') ||
    opportunityId !== (doc.opportunityId ? String(doc.opportunityId) : '') ||
    notes !== (doc.notes || '')
  );

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      if (!title.trim()) throw new Error('Title is required.');
      const updated = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/documents/${docId}`,
        {
          method: 'PUT',
          body: {
            title: title.trim(),
            documentType,
            contactId: contactId ? Number(contactId) : null,
            opportunityId: opportunityId ? Number(opportunityId) : null,
            notes: notes.trim() || null,
          },
        }
      );
      setDoc(updated);
      setSuccess('Saved.');
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    if (!window.confirm(`Delete "${doc.title}"? The file will be permanently removed from storage. This cannot be undone.`)) return;
    setDeleting(true); setError(null);
    try {
      const res = await authenticatedFetch(
        `${API_BASE_URL}/crm/companies/${companyId}/documents/${docId}`,
        { method: 'DELETE' }
      );
      if (res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status}).`);
      }
      navigate(`/modules/crm/companies/${companyId}/documents`, { replace: true });
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true); setError(null);
    try {
      const { url } = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/documents/${docId}/download`
      );
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err.message || 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <PageLayout title="Document"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  }
  if (!doc) {
    return (
      <PageLayout title="Document">
        <PageCard className="profile-card--form">
          <div className="error-message"><p>{error || 'Document not found.'}</p></div>
          <FormActions
            onCancel={() => navigate(`/modules/crm/companies/${companyId}/documents`)}
            cancelText="Back to Documents" submitText="" disableSubmit />
        </PageCard>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={doc.title}
      actions={
        <>
          <button
            type="button"
            className="cancel-button"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'Preparing…' : 'Download'}
          </button>
          <button
            type="button"
            className="cancel-button"
            onClick={handleDelete}
            disabled={deleting}
            style={{ color: 'var(--color-danger-tx)', borderColor: 'var(--color-danger-tx)' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </>
      }
    >
      <PageCard className="profile-card--form">
        {error && <div className="error-message"><p>{error}</p></div>}
        {success && <div className="success-message"><p>{success}</p></div>}

        <form onSubmit={handleSave} className="form-stack">
          <div className="form-group">
            <label>File</label>
            <div className="static-field">
              <div><strong>{doc.originalFilename || doc.title}</strong></div>
              <div className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                {formatBytes(doc.sizeBytes)}
                {doc.contentType && ` · ${doc.contentType}`}
                {' · Uploaded '}
                {formatDate(doc.createdAt)}
                {doc.createdByName && ` by ${doc.createdByName}`}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input id="title" type="text" value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   maxLength={300} required disabled={saving} />
          </div>

          <div className="form-group">
            <label htmlFor="documentType">Type</label>
            <select id="documentType" value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    disabled={saving}>
              {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="contactId">Attach to contact</label>
            <select id="contactId" value={contactId}
                    onChange={(e) => setContactId(e.target.value)}
                    disabled={saving}>
              <option value="">— None —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="opportunityId">Attach to opportunity</label>
            <select id="opportunityId" value={opportunityId}
                    onChange={(e) => setOpportunityId(e.target.value)}
                    disabled={saving}>
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
                      disabled={saving} />
          </div>

          <FormActions
            onCancel={() => navigate(`/modules/crm/companies/${companyId}/documents`)}
            cancelText="Back to Documents"
            submitText="Save changes"
            submittingText="Saving…"
            isSubmitting={saving}
            disableSubmit={!dirty}
          />
        </form>
      </PageCard>
    </PageLayout>
  );
}
