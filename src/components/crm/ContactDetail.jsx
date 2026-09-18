// /modules/crm/companies/:id/contacts/:contactId — view/edit/delete a contact.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../utils/api.js';
import ActivityInline from './ActivityInline.jsx';

export default function ContactDetail() {
  const { id: companyId, contactId } = useParams();
  const navigate = useNavigate();

  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [contactType, setContactType] = useState('General');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const data = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/contacts/${contactId}`
      );
      setContact(data);
      setFirstName(data.firstName || '');
      setLastName(data.lastName || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setTitle(data.title || '');
      setContactType(data.contactType || 'General');
      setNotes(data.notes || '');
    } catch (err) {
      setError(err.message || 'Failed to load contact.');
    } finally {
      setLoading(false);
    }
  }, [companyId, contactId]);

  useEffect(() => { load(); }, [load]);

  const dirty = contact && (
    firstName !== (contact.firstName || '') ||
    lastName !== (contact.lastName || '') ||
    email !== (contact.email || '') ||
    phone !== (contact.phone || '') ||
    title !== (contact.title || '') ||
    contactType !== (contact.contactType || 'General') ||
    notes !== (contact.notes || '')
  );

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      if (!firstName.trim()) throw new Error('First name is required.');
      const updated = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/contacts/${contactId}`,
        {
          method: 'PUT',
          body: {
            firstName: firstName.trim(),
            lastName: lastName.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            title: title.trim() || null,
            contactType,
            notes: notes.trim() || null,
          },
        }
      );
      setContact(updated);
      setSuccess('Saved.');
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'this contact';
    if (!window.confirm(`Delete ${displayName}? This cannot be undone.`)) return;
    setDeleting(true); setError(null);
    try {
      const res = await authenticatedFetch(
        `${API_BASE_URL}/crm/companies/${companyId}/contacts/${contactId}`,
        { method: 'DELETE' }
      );
      if (res.status === 204) {
        navigate(`/modules/crm/companies/${companyId}`, { replace: true });
        return;
      }
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Delete failed (${res.status}).`);
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <PageLayout title="Contact"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  }
  if (!contact) {
    return (
      <PageLayout title="Contact">
        <PageCard className="profile-card--form">
          <div className="error-message"><p>{error || 'Contact not found.'}</p></div>
          <FormActions
            onCancel={() => navigate(`/modules/crm/companies/${companyId}`)}
            cancelText="Back to Company" submitText="" disableSubmit />
        </PageCard>
      </PageLayout>
    );
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Contact';

  return (
    <PageLayout
      title={displayName}
      actions={
        <button type="button" className="cancel-button" onClick={handleDelete} disabled={deleting}
                style={{ color: 'var(--color-danger-tx)', borderColor: 'var(--color-danger-tx)' }}>
          {deleting ? 'Deleting…' : 'Delete Contact'}
        </button>
      }
    >
      <PageCard className="profile-card--form">
        {error && <div className="error-message"><p>{error}</p></div>}
        {success && <div className="success-message"><p>{success}</p></div>}

        <form onSubmit={handleSave} className="form-stack">
          <div className="form-group">
            <label htmlFor="firstName">First name</label>
            <input id="firstName" type="text" value={firstName}
                   onChange={(e) => setFirstName(e.target.value)}
                   maxLength={100} disabled={saving} />
          </div>
          <div className="form-group">
            <label htmlFor="lastName">Last name</label>
            <input id="lastName" type="text" value={lastName}
                   onChange={(e) => setLastName(e.target.value)}
                   maxLength={100} disabled={saving} />
          </div>
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input id="title" type="text" value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   maxLength={200} disabled={saving} />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   maxLength={320} disabled={saving} />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input id="phone" type="tel" value={phone}
                   onChange={(e) => setPhone(e.target.value)}
                   maxLength={50} disabled={saving} />
          </div>
          <div className="form-group">
            <label htmlFor="contactType">Contact type</label>
            <select id="contactType" value={contactType}
                    onChange={(e) => setContactType(e.target.value)}
                    disabled={saving}>
              <option value="General">General</option>
              <option value="Billing">Billing</option>
              <option value="Legal">Legal</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" rows="3" value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={saving} />
          </div>
          <FormActions
            onCancel={() => navigate(`/modules/crm/companies/${companyId}`)}
            cancelText="Back to Company"
            submitText="Save changes"
            submittingText="Saving…"
            isSubmitting={saving}
            disableSubmit={!dirty}
          />
        </form>
      </PageCard>

      {/* Contact-scoped activity — just this contact's rows. Company
          rollup lives on the company detail page. */}
      <ActivityInline companyId={companyId} contactId={Number(contactId)} />
    </PageLayout>
  );
}
