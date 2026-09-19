// /modules/crm/companies/:id/documents/:docId — edit metadata,
// change sharing, download, or delete.
//
// The owner module is shown read-only ("Owned by CRM"). Sharing is
// a checkbox list of every other active module; toggling a box +
// clicking Save PUTs the new share set (API replaces atomically).
//
// Only the owner module can delete a document — the API enforces
// this; the frontend surfaces the resulting 403 as an error banner.
// From CRM's perspective (this router IS CRM), delete is only
// disabled here if the API-returned ownerModule.code is not 'CRM'
// (which happens for docs that another module owns and shared TO CRM).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../utils/api.js';
import { DOCUMENT_TYPES, formatBytes, formatDate } from './documentHelpers.js';

const VIEWER_MODULE_CODE = 'CRM';

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
  const [allModules, setAllModules] = useState([]);

  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('Other');
  const [contactId, setContactId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [notes, setNotes] = useState('');
  const [sharedModuleIds, setSharedModuleIds] = useState(new Set());
  const [savedShareIds, setSavedShareIds] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const [d, c, o, m] = await Promise.all([
        authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}/documents/${docId}`),
        authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}/contacts`),
        authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}/opportunities?limit=200`),
        authenticatedFetchJson(`${API_BASE_URL}/modules`),
      ]);
      setDoc(d);
      setTitle(d.title || '');
      setDocumentType(d.documentType || 'Other');
      setContactId(d.contactId ? String(d.contactId) : '');
      setOpportunityId(d.opportunityId ? String(d.opportunityId) : '');
      setNotes(d.notes || '');
      const initialShares = new Set((d.sharedModules || []).map((s) => s.id));
      setSharedModuleIds(initialShares);
      setSavedShareIds(new Set(initialShares));
      setContacts(c.contacts || []);
      setOpportunities(o.opportunities || []);
      setAllModules(m || []);
    } catch (err) {
      setError(err.message || 'Failed to load document.');
    } finally {
      setLoading(false);
    }
  }, [companyId, docId]);
  useEffect(() => { load(); }, [load]);

  // Modules eligible for sharing = all active modules except the owner.
  const shareCandidates = doc
    ? allModules.filter((m) => m.id !== doc.ownerModule?.id)
    : [];

  // Detect meaningful edits so Save is only enabled when needed.
  const sharesChanged = doc && (
    sharedModuleIds.size !== savedShareIds.size ||
    [...sharedModuleIds].some((id) => !savedShareIds.has(id))
  );
  const metadataChanged = doc && (
    title !== (doc.title || '') ||
    documentType !== (doc.documentType || 'Other') ||
    contactId !== (doc.contactId ? String(doc.contactId) : '') ||
    opportunityId !== (doc.opportunityId ? String(doc.opportunityId) : '') ||
    notes !== (doc.notes || '')
  );
  const dirty = metadataChanged || sharesChanged;

  function toggleShare(moduleId) {
    setSharedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  const isOwner = doc && doc.ownerModule?.code === VIEWER_MODULE_CODE;

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      if (!title.trim()) throw new Error('Title is required.');
      const body = {
        title: title.trim(),
        documentType,
        contactId: contactId ? Number(contactId) : null,
        opportunityId: opportunityId ? Number(opportunityId) : null,
        notes: notes.trim() || null,
      };
      // Only send sharedModuleIds when they actually changed —
      // omit the field otherwise so the API leaves shares alone.
      if (sharesChanged) {
        body.sharedModuleIds = [...sharedModuleIds];
      }
      const updated = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/documents/${docId}`,
        { method: 'PUT', body }
      );
      setDoc(updated);
      const refreshedShares = new Set((updated.sharedModules || []).map((s) => s.id));
      setSharedModuleIds(refreshedShares);
      setSavedShareIds(new Set(refreshedShares));
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
            disabled={deleting || !isOwner}
            title={isOwner ? '' : `Only ${doc.ownerModule?.name || doc.ownerModule?.code} can delete this document. Ask them to delete it, or remove the CRM share from it.`}
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
        {!isOwner && (
          <div className="info-banner" role="note">
            This document is owned by <strong>{doc.ownerModule?.name || doc.ownerModule?.code}</strong> and
            shared with CRM. You can edit metadata and change sharing, but only the
            owner module can delete it.
          </div>
        )}

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
            <label>Ownership</label>
            <div className="static-field">
              <div>
                <strong>Owned by {doc.ownerModule?.name || doc.ownerModule?.code}</strong>
              </div>
              <div className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                The owning module always sees this document. Change what other
                modules can see it via the Share list below.
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
            <label>Share with other modules</label>
            <div className="muted" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-2)' }}>
              {doc.ownerModule?.name || doc.ownerModule?.code} always sees this document. Choose which other
              modules it should be visible in.
            </div>
            {shareCandidates.length === 0 ? (
              <div className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                No other modules are available to share with.
              </div>
            ) : (
              <div className="checkbox-list">
                {shareCandidates.map((m) => (
                  <label key={m.id} className="checkbox-list__item">
                    <input
                      type="checkbox"
                      checked={sharedModuleIds.has(m.id)}
                      onChange={() => toggleShare(m.id)}
                      disabled={saving}
                    />
                    <span>{m.name}</span>
                  </label>
                ))}
              </div>
            )}
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
