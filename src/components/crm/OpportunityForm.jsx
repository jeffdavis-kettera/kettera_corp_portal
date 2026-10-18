// OpportunityForm — create a new opportunity. Route:
//   /modules/crm/companies/:id/opportunities/new?contactId=X
//
// Editing happens on the opportunity's own page (OpportunityPageShell
// → OpportunityDetails); creating stays a standalone form because
// there's nothing to put in the tabs until the opportunity exists.
// Saving lands on the new opportunity's Details tab.
//
// The API auto-fills actual_close_date when stage is Won/Lost, so the
// actualCloseDate field is optional.

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { STAGES, CLOSED_STAGES } from './opportunityStages.js';

export default function OpportunityForm() {
  const { id: companyId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const listUrl = `/modules/crm/companies/${companyId}/opportunities`;

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [stage, setStage] = useState('Lead');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [probability, setProbability] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [actualCloseDate, setActualCloseDate] = useState('');
  const [primaryContactId, setPrimaryContactId] = useState(searchParams.get('contactId') || '');
  const [notes, setNotes] = useState('');

  // Contacts for the primary-contact dropdown.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authenticatedFetchJson(`${API_BASE_URL}/crm/companies/${companyId}/contacts`);
        if (!cancelled) setContacts(data.contacts || []);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!name.trim()) return setError('Name is required.');
    setSubmitting(true);
    try {
      const created = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/opportunities`,
        {
          method: 'POST',
          body: {
            name: name.trim(),
            stage,
            value: value === '' ? null : Number(value),
            currency: (currency || 'USD').toUpperCase(),
            probability: probability === '' ? null : Number(probability),
            expectedCloseDate: expectedCloseDate || null,
            actualCloseDate: actualCloseDate || null,
            primaryContactId: primaryContactId ? Number(primaryContactId) : null,
            notes: notes.trim() || null,
          },
        }
      );
      navigate(`${listUrl}/${created.id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const enteringClosed = CLOSED_STAGES.has(stage);

  return (
    <PageLayout title="Add Opportunity">
      <PageCard className="profile-card--form">
        {error && <div className="error-message"><p>{error}</p></div>}

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input id="name" type="text" value={name}
                   onChange={(e) => setName(e.target.value)}
                   maxLength={300} required disabled={submitting} autoFocus
                   placeholder="What are we selling to them?" />
          </div>

          <div className="form-group">
            <label htmlFor="stage">Stage</label>
            <select id="stage" value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    disabled={submitting}>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {enteringClosed && !actualCloseDate && (
              <p className="muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                Saving will set the actual close date to today unless you set one below.
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="value">Value</label>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <input id="value" type="number" min="0" step="0.01" value={value}
                     onChange={(e) => setValue(e.target.value)}
                     disabled={submitting}
                     placeholder="0.00"
                     style={{ flex: 1 }} />
              <input id="currency" type="text" value={currency}
                     onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                     maxLength={3} disabled={submitting}
                     placeholder="USD"
                     style={{ width: 80, textTransform: 'uppercase' }} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="probability">Probability</label>
            <input id="probability" type="number" min="0" max="100" step="1" value={probability}
                   onChange={(e) => setProbability(e.target.value)}
                   disabled={submitting}
                   placeholder="0–100 (optional)" />
          </div>

          <div className="form-group">
            <label htmlFor="expectedCloseDate">Expected close</label>
            <input id="expectedCloseDate" type="date" value={expectedCloseDate}
                   onChange={(e) => setExpectedCloseDate(e.target.value)}
                   disabled={submitting} />
          </div>

          <div className="form-group">
            <label htmlFor="actualCloseDate">Actual close (Won / Lost)</label>
            <input id="actualCloseDate" type="date" value={actualCloseDate}
                   onChange={(e) => setActualCloseDate(e.target.value)}
                   disabled={submitting} />
          </div>

          <div className="form-group">
            <label htmlFor="primaryContactId">Primary contact</label>
            <select id="primaryContactId" value={primaryContactId}
                    onChange={(e) => setPrimaryContactId(e.target.value)}
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
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" rows="6" value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={submitting}
                      placeholder="Scope, budget, competition, next steps…" />
          </div>

          <FormActions
            onCancel={() => navigate(listUrl)}
            cancelText="Cancel"
            submitText="Add opportunity"
            submittingText="Creating…"
            isSubmitting={submitting}
          />
        </form>
      </PageCard>
    </PageLayout>
  );
}
