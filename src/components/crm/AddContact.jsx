// /modules/crm/companies/:id/contacts/add — new contact under a company.
// Available to anyone with access to the parent company (admin or
// basic user with grant). If they lack access, the API's assertCompanyAccess
// returns 404 and the form surfaces that message.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';

export default function AddContact() {
  const { id: companyId } = useParams();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [contactType, setContactType] = useState('General');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!firstName.trim()) return setError('First name is required.');
    setSubmitting(true);
    try {
      const created = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/contacts`,
        {
          method: 'POST',
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
      navigate(`/modules/crm/companies/${companyId}/contacts/${created.id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to add contact.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title="Add Contact">
      <PageCard className="profile-card--form">
        <h2 style={{ marginTop: 0 }}>New Contact</h2>
        {error && <div className="error-message"><p>{error}</p></div>}
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label htmlFor="firstName">First name *</label>
            <input id="firstName" type="text" value={firstName}
                   onChange={(e) => setFirstName(e.target.value)}
                   required maxLength={100} disabled={submitting} autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="lastName">Last name</label>
            <input id="lastName" type="text" value={lastName}
                   onChange={(e) => setLastName(e.target.value)}
                   maxLength={100} disabled={submitting} />
          </div>
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input id="title" type="text" value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   maxLength={200} disabled={submitting} />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   maxLength={320} disabled={submitting} />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input id="phone" type="tel" value={phone}
                   onChange={(e) => setPhone(e.target.value)}
                   maxLength={50} disabled={submitting} />
          </div>
          <div className="form-group">
            <label htmlFor="contactType">Contact type</label>
            <select id="contactType" value={contactType}
                    onChange={(e) => setContactType(e.target.value)}
                    disabled={submitting}>
              <option value="General">General</option>
              <option value="Billing">Billing</option>
              <option value="Legal">Legal</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" rows="3" value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={submitting} />
          </div>
          <FormActions
            onCancel={() => navigate(`/modules/crm/companies/${companyId}`)}
            cancelText="Cancel"
            submitText="Create Contact"
            submittingText="Creating…"
            isSubmitting={submitting}
          />
        </form>
      </PageCard>
    </PageLayout>
  );
}
