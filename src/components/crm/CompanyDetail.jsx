// /modules/crm/companies/:id — one company + its contacts.
//
// Sections:
//   1. Company info card — read-only for basic users, editable-in-place
//      for CRM admins (Save + Delete + Cancel).
//   2. Contacts table — always visible; Add Contact button visible to
//      anyone with company access (which is everyone rendering this
//      page — the API rejects everyone else).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../utils/api.js';
import { useCrmRole } from './useCrmRole.js';

const TYPE_BADGE_CLASS = {
  General: 'role-badge role-badge--basic',
  Billing: 'role-badge role-badge--admin',
  Legal:   'role-badge role-badge--admin',
};

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isCrmAdmin } = useCrmRole();

  const [company, setCompany] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const [companyData, contactsData] = await Promise.all([
        authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${id}`),
        authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${id}/contacts`),
      ]);
      setCompany(companyData);
      setName(companyData.name || '');
      setWebsite(companyData.website || '');
      setNotes(companyData.notes || '');
      setContacts(contactsData.contacts || []);
    } catch (err) {
      setError(err.message || 'Failed to load company.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const dirty = company && (
    name !== (company.name || '') ||
    website !== (company.website || '') ||
    notes !== (company.notes || '')
  );

  async function handleSave(e) {
    e.preventDefault();
    if (saving || !isCrmAdmin) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const updated = await authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${id}`, {
        method: 'PUT',
        body: {
          name: name.trim(),
          website: website.trim() || null,
          notes: notes.trim() || null,
        },
      });
      setCompany(updated);
      setSuccess('Saved.');
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting || !isCrmAdmin) return;
    if (!window.confirm(`Delete company "${company.name}"? All ${contacts.length} contact(s) will be deleted too. This cannot be undone.`)) return;
    setDeleting(true); setError(null);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/crm/companies/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        navigate('/modules/crm', { replace: true });
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
    return <PageLayout title="Company"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  }
  if (!company) {
    return (
      <PageLayout title="Company">
        <PageCard className="profile-card--form">
          <div className="error-message"><p>{error || 'Company not found.'}</p></div>
          <FormActions onCancel={() => navigate('/modules/crm')} cancelText="Back to Companies" submitText="" disableSubmit />
        </PageCard>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={company.name}
      actions={isCrmAdmin ? (
        <button type="button" className="cancel-button" onClick={handleDelete} disabled={deleting}
                style={{ color: 'var(--color-danger-tx)', borderColor: 'var(--color-danger-tx)' }}>
          {deleting ? 'Deleting…' : 'Delete Company'}
        </button>
      ) : null}
    >
      {/* Company info card */}
      <PageCard className="profile-card--form">
        {error && <div className="error-message"><p>{error}</p></div>}
        {success && <div className="success-message"><p>{success}</p></div>}
        {!isCrmAdmin && (
          <div className="info-banner" role="note">
            You have access to this company as a CRM Basic User. Company
            details are managed by CRM admins.
          </div>
        )}

        <form onSubmit={handleSave} className="form-stack">
          <div className="form-group">
            <label htmlFor="name">Company name</label>
            <input id="name" type="text" value={name}
                   onChange={(e) => setName(e.target.value)}
                   maxLength={200} disabled={!isCrmAdmin || saving} />
          </div>
          <div className="form-group">
            <label htmlFor="website">Website</label>
            <input id="website" type="url" value={website}
                   onChange={(e) => setWebsite(e.target.value)}
                   maxLength={500} disabled={!isCrmAdmin || saving} />
          </div>
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" rows="4" value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={!isCrmAdmin || saving} />
          </div>
          {isCrmAdmin && (
            <FormActions
              onCancel={() => navigate('/modules/crm')}
              cancelText="Back to Companies"
              submitText="Save changes"
              submittingText="Saving…"
              isSubmitting={saving}
              disableSubmit={!dirty}
            />
          )}
        </form>
      </PageCard>

      {/* Contacts section */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: 'var(--space-6) 0 var(--space-3)' }}>
        <h3 style={{ margin: 0 }}>Contacts ({contacts.length})</h3>
        <button type="button" className="btn-primary"
                onClick={() => navigate(`/modules/crm/companies/${id}/contacts/add`)}>
          Add Contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="no-users">No contacts yet. Click Add Contact to create the first.</div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}
                    onClick={() => navigate(`/modules/crm/companies/${id}/contacts/${c.id}`)}
                    className="data-table__row-clickable">
                  <td><strong>{[c.firstName, c.lastName].filter(Boolean).join(' ')}</strong></td>
                  <td className="muted">{c.title || '—'}</td>
                  <td>{c.email || <span className="muted">—</span>}</td>
                  <td>{c.phone || <span className="muted">—</span>}</td>
                  <td>
                    <span className={TYPE_BADGE_CLASS[c.contactType] || 'role-badge role-badge--basic'}>
                      {c.contactType}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}
