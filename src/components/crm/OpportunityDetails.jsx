// Details tab — the opportunity's fields, editable in place. Rendered
// inside OpportunityPageShell's <Outlet />; gets the loaded
// opportunity via useOutletContext.
//
// Same behaviour as the old edit form: save stays here and shows
// "Saved.", the Save button is disabled until something changes, and
// the server's copy is re-applied after a save (it may have
// auto-filled the actual close date). Delete lives in the shell's
// header now.
//
// Also shows the services we're pitching (Service Scoping's output)
// as chips that link to the tool.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { STAGES, CLOSED_STAGES, toDateInputValue } from './opportunityStages.js';
import { serviceLabel } from './services.js';

// The form's field values for a stored opportunity — used both to
// fill the form and to tell whether anything has changed since.
function toFormValues(o) {
  return {
    name: o.name,
    stage: o.stage,
    value: o.value == null ? '' : String(o.value),
    currency: o.currency || 'USD',
    probability: o.probability == null ? '' : String(o.probability),
    expectedCloseDate: toDateInputValue(o.expectedCloseDate),
    actualCloseDate: toDateInputValue(o.actualCloseDate),
    primaryContactId: o.primaryContactId ? String(o.primaryContactId) : '',
    notes: o.notes || '',
  };
}

export default function OpportunityDetails() {
  const { id: companyId, oppId } = useParams();
  const navigate = useNavigate();
  const { opportunity, applyOpportunity } = useOutletContext();
  const listUrl = `/modules/crm/companies/${companyId}/opportunities`;

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [stage, setStage] = useState('Lead');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [probability, setProbability] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [actualCloseDate, setActualCloseDate] = useState('');
  const [primaryContactId, setPrimaryContactId] = useState('');
  const [notes, setNotes] = useState('');

  const fillForm = useCallback((o) => {
    const v = toFormValues(o);
    setName(v.name);
    setStage(v.stage);
    setValue(v.value);
    setCurrency(v.currency);
    setProbability(v.probability);
    setExpectedCloseDate(v.expectedCloseDate);
    setActualCloseDate(v.actualCloseDate);
    setPrimaryContactId(v.primaryContactId);
    setNotes(v.notes);
  }, []);

  // Resync whenever the shell's copy changes (initial load, a save
  // here, a reload triggered by a tool).
  useEffect(() => { fillForm(opportunity); }, [opportunity, fillForm]);

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

  const storedValues = toFormValues(opportunity);
  const currentValues = {
    name, stage, value, currency, probability,
    expectedCloseDate, actualCloseDate, primaryContactId, notes,
  };
  const dirty = Object.keys(currentValues).some((k) => currentValues[k] !== storedValues[k]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null); setSuccess(null);
    if (!name.trim()) return setError('Name is required.');
    setSubmitting(true);
    try {
      const updated = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${companyId}/opportunities/${oppId}`,
        {
          method: 'PUT',
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
      applyOpportunity(updated);
      setSuccess('Saved.');
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const enteringClosed = CLOSED_STAGES.has(stage);
  const services = opportunity.services || [];
  const scopingUrl = `${listUrl}/${oppId}/tools/scoping`;

  return (
    <PageCard className="profile-card--form">
      {error && <div className="error-message"><p>{error}</p></div>}
      {success && <div className="success-message"><p>{success}</p></div>}

      <div className="form-group">
        <label>Services we're pitching</label>
        {services.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            None chosen yet. <Link to={scopingUrl}>Scope in Tools</Link>.
          </p>
        ) : (
          <div className="service-chips">
            {services.map((s) => (
              <Link key={s.code} to={scopingUrl}
                    className={`service-chip${s.isLead ? ' service-chip--lead' : ''}`}
                    title={s.isLead ? 'Lead service' : undefined}>
                {serviceLabel(s)}{s.isLead && services.length > 1 ? ' (lead)' : ''}
              </Link>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input id="name" type="text" value={name}
                 onChange={(e) => setName(e.target.value)}
                 maxLength={300} required disabled={submitting}
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
          cancelText="Back to Opportunities"
          submitText="Save changes"
          submittingText="Saving…"
          isSubmitting={submitting}
          disableSubmit={!dirty}
        />
      </form>
    </PageCard>
  );
}
