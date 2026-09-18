// /modules/crm/companies/add — new company form, admin only.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { useCrmRole } from './useCrmRole.js';

export default function AddCompany() {
  const navigate = useNavigate();
  const { isCrmAdmin } = useCrmRole();

  useEffect(() => {
    if (!isCrmAdmin) navigate('/modules/crm', { replace: true });
  }, [isCrmAdmin, navigate]);

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!name.trim()) return setError('Company name is required.');
    setSubmitting(true);
    try {
      const created = await authenticatedFetchJson(`${API_BASE_URL}/crm/companies`, {
        method: 'POST',
        body: {
          name: name.trim(),
          website: website.trim() || null,
          notes: notes.trim() || null,
        },
      });
      navigate(`/modules/crm/companies/${created.id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to create company.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title="Add Company">
      <PageCard className="profile-card--form">
        <h2 style={{ marginTop: 0 }}>New Company</h2>
        {error && <div className="error-message"><p>{error}</p></div>}
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label htmlFor="name">Company name *</label>
            <input id="name" type="text" value={name}
                   onChange={(e) => setName(e.target.value)}
                   required maxLength={200} disabled={submitting} autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="website">Website</label>
            <input id="website" type="url" value={website}
                   onChange={(e) => setWebsite(e.target.value)}
                   maxLength={500} disabled={submitting}
                   placeholder="https://example.com" />
          </div>
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" rows="4" value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={submitting}
                      placeholder="Anything worth capturing about this company…" />
          </div>
          <FormActions
            onCancel={() => navigate('/modules/crm')}
            cancelText="Cancel"
            submitText="Create Company"
            submittingText="Creating…"
            isSubmitting={submitting}
          />
        </form>
      </PageCard>
    </PageLayout>
  );
}
