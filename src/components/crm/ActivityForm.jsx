// ActivityForm — one component for both create and edit.
//
// Routes:
//   /modules/crm/companies/:id/activities/new?contactId=X   — create
//     (contactId query param optional; determines contact-level vs
//      company-level)
//   /modules/crm/companies/:id/activities/:activityId       — edit
//
// The component detects mode from useParams(). If activityId is
// present, it loads the row and POST becomes PUT; otherwise it's
// a fresh insert. Contact can be reassigned on edit via a picker
// (dropdown of contacts under the company).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../utils/api.js';

const TYPES = ['Call', 'Email', 'Meeting', 'Note', 'Other'];

// Format a Date (or ISO string) as the value shape a
// <input type="datetime-local"> expects: YYYY-MM-DDTHH:mm, in the
// viewer's local timezone.
function toDatetimeLocal(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const y  = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const da = pad(d.getDate());
  const h  = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${y}-${mo}-${da}T${h}:${mi}`;
}

export default function ActivityForm() {
  const { id: companyId, activityId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isEdit = Boolean(activityId);
  const initialContactId = searchParams.get('contactId') || null;

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [contacts, setContacts] = useState([]);
  const [activityType, setActivityType] = useState('Call');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocal(null));
  const [contactId, setContactId] = useState(initialContactId || '');

  // Load contacts for the picker (used by both create and edit modes).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authenticatedFetchJson(
          `${API_BASE_URL}/crm/companies/${companyId}/contacts`
        );
        if (!cancelled) setContacts(data.contacts || []);
      } catch { /* non-fatal; picker just shows Company-level */ }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // In edit mode, load the activity.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const a = await authenticatedFetchJson(
          `${API_BASE_URL}/crm/companies/${companyId}/activities/${activityId}`
        );
        if (cancelled) return;
        setActivityType(a.activityType);
        setSubject(a.subject);
        setBody(a.body || '');
        setOccurredAt(toDatetimeLocal(a.occurredAt));
        setContactId(a.contactId ? String(a.contactId) : '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load activity.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, companyId, activityId]);

  const buildBody = useCallback(() => {
    const payload = {
      activityType,
      subject: subject.trim(),
      body: body.trim() || null,
      // datetime-local values have no timezone; treat as viewer-local
      // and convert to a proper ISO string for the API.
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
      contactId: contactId ? Number(contactId) : null,
    };
    return payload;
  }, [activityType, subject, body, occurredAt, contactId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!subject.trim()) return setError('Subject is required.');
    setSubmitting(true);
    try {
      if (isEdit) {
        await authenticatedFetchJson(
          `${API_BASE_URL}/crm/companies/${companyId}/activities/${activityId}`,
          { method: 'PUT', body: buildBody() }
        );
      } else {
        await authenticatedFetchJson(
          `${API_BASE_URL}/crm/companies/${companyId}/activities`,
          { method: 'POST', body: buildBody() }
        );
      }
      // On successful save, go back to where we came from — the
      // contact page if we were logging contact-level, else the
      // company page. Full activity page → back = whichever.
      const backTo = contactId
        ? `/modules/crm/companies/${companyId}/contacts/${contactId}`
        : `/modules/crm/companies/${companyId}`;
      navigate(backTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || deleting) return;
    if (!window.confirm('Delete this activity entry? This cannot be undone.')) return;
    setDeleting(true); setError(null);
    try {
      const res = await authenticatedFetch(
        `${API_BASE_URL}/crm/companies/${companyId}/activities/${activityId}`,
        { method: 'DELETE' }
      );
      if (res.status !== 204) {
        const bodyRes = await res.json().catch(() => ({}));
        throw new Error(bodyRes.error || `Delete failed (${res.status}).`);
      }
      navigate(`/modules/crm/companies/${companyId}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <PageLayout title="Activity"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  }

  return (
    <PageLayout
      title={isEdit ? 'Edit Activity' : 'Log Activity'}
      actions={
        isEdit ? (
          <button
            type="button"
            className="cancel-button"
            onClick={handleDelete}
            disabled={deleting}
            style={{ color: 'var(--color-danger-tx)', borderColor: 'var(--color-danger-tx)' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        ) : null
      }
    >
      <PageCard className="profile-card--form">
        {error && <div className="error-message"><p>{error}</p></div>}

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label htmlFor="activityType">Type</label>
            <select id="activityType" value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                    disabled={submitting}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="subject">Subject *</label>
            <input id="subject" type="text" value={subject}
                   onChange={(e) => setSubject(e.target.value)}
                   maxLength={300} required disabled={submitting} autoFocus
                   placeholder="Short summary of what happened" />
          </div>

          <div className="form-group">
            <label htmlFor="occurredAt">When</label>
            <input id="occurredAt" type="datetime-local" value={occurredAt}
                   onChange={(e) => setOccurredAt(e.target.value)}
                   disabled={submitting} />
          </div>

          <div className="form-group">
            <label htmlFor="contactId">Contact</label>
            <select id="contactId" value={contactId}
                    onChange={(e) => setContactId(e.target.value)}
                    disabled={submitting}>
              <option value="">Company-level (no specific contact)</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="body">Details</label>
            <textarea id="body" rows="6" value={body}
                      onChange={(e) => setBody(e.target.value)}
                      disabled={submitting}
                      placeholder="Longer notes — what was discussed, next steps, links, etc." />
          </div>

          <FormActions
            onCancel={() => {
              const backTo = contactId
                ? `/modules/crm/companies/${companyId}/contacts/${contactId}`
                : `/modules/crm/companies/${companyId}`;
              navigate(backTo);
            }}
            cancelText="Cancel"
            submitText={isEdit ? 'Save changes' : 'Log activity'}
            submittingText={isEdit ? 'Saving…' : 'Logging…'}
            isSubmitting={submitting}
          />
        </form>
      </PageCard>
    </PageLayout>
  );
}
