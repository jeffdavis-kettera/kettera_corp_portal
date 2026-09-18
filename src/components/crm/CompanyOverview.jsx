// Overview tab — the "at a glance" summary. Renders:
//   1. Company info card (name/website/notes) — editable for admins,
//      read-only + info banner for basic users.
//   2. Recent Opportunities (via OpportunityInline)
//   3. Recent Activity (via ActivityInline)
//
// Full lists live on their own tabs (Contacts, Opportunities,
// Activity). The Contacts preview is intentionally OMITTED here —
// the Contacts tab is one click away and having it inline made the
// old page too tall. If we find users routinely want the contact
// list without a click, we'll add a compact block back.

import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import OpportunityInline from './OpportunityInline.jsx';
import ActivityInline from './ActivityInline.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { useCrmRole } from './useCrmRole.js';

export default function CompanyOverview() {
  const navigate = useNavigate();
  const { company, reloadCompany } = useOutletContext();
  const { isCrmAdmin } = useCrmRole();

  const [name, setName] = useState(company.name || '');
  const [website, setWebsite] = useState(company.website || '');
  const [notes, setNotes] = useState(company.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Resync form values whenever the shell reloads the company row
  // (e.g. after a save from another tab).
  useEffect(() => {
    setName(company.name || '');
    setWebsite(company.website || '');
    setNotes(company.notes || '');
  }, [company.id, company.name, company.website, company.notes]);

  const dirty =
    name !== (company.name || '') ||
    website !== (company.website || '') ||
    notes !== (company.notes || '');

  async function handleSave(e) {
    e.preventDefault();
    if (saving || !isCrmAdmin) return;
    setError(null); setSuccess(null);
    setSaving(true);
    try {
      await authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${company.id}`, {
        method: 'PUT',
        body: {
          name: name.trim(),
          website: website.trim() || null,
          notes: notes.trim() || null,
        },
      });
      await reloadCompany();
      setSuccess('Saved.');
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageCard className="profile-card--form">
        {error && <div className="error-message"><p>{error}</p></div>}
        {success && <div className="success-message"><p>{success}</p></div>}
        {!isCrmAdmin && (
          <div className="info-banner" role="note">
            You have access to this company as a CRM Basic User. Company details
            are managed by CRM admins.
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

      {/* Deal pipeline for this company — every stage. */}
      <OpportunityInline companyId={company.id} />

      {/* Company-level activity rollup — all activity under this
          company, including activity logged at contact level. */}
      <ActivityInline companyId={company.id} />
    </>
  );
}
