// OpportunityForm — one component for both create and edit,
// mirroring ActivityForm's shape. Routes:
//   /modules/crm/companies/:id/opportunities/new?contactId=X   create
//   /modules/crm/companies/:id/opportunities/:oppId            edit
//
// Fields: name, stage, value, currency, probability, expected +
// actual close date, primary contact (dropdown of contacts under
// the company), notes.
//
// The API auto-fills actual_close_date when stage crosses into
// Won/Lost, so this form's actualCloseDate field is optional —
// user can override or backfill, but empty is fine.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../utils/api.js';
import { STAGES, CLOSED_STAGES, toDateInputValue } from './opportunityStages.js';

export default function OpportunityForm() {
  const { id: companyId, oppId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isEdit = Boolean(oppId);
  const initialContactId = searchParams.get('contactId') || '';

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [stage, setStage] = useState('Lead');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [probability, setProbability] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [actualCloseDate, setActualCloseDate] = useState('');
  const [primaryContactId, setPrimaryContactId] = useState(initialContactId);
  const [notes, setNotes] = useState('');

  // Load contacts for the primary-contact dropdown.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authenticatedFetchJson(
          `${API_BASE_URL}/crm/companies/${companyId}/contacts`
        );
        if (!cancelled) setContacts(data.contacts || []);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // Edit mode: load the existing opportunity.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const o = await authenticatedFetchJson(
          `${API_BASE_URL}/crm/companies/${companyId}/opportunities/${oppId}`
        );
        if (cancelled) return;
        setName(o.name);
        setStage(o.stage);
        setValue(o.value == null ? '' : String(o.value));
        setCurrency(o.currency || 'USD');
        setProbability(o.probability == null ? '' : String(o.probability));
        setExpectedCloseDate(toDateInputValue(o.expectedCloseDate));
        setActualCloseDate(toDateInputValue(o.actualCloseDate));
        setPrimaryContactId(o.primaryContactId ? String(o.primaryContactId) : '');
        setNotes(o.notes || '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load opportunity.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, companyId, oppId]);

  const buildBody = useCallback(() => ({
    name: name.trim(),
    stage,
    value: value === '' ? null : Number(value),
    currency: (currency || 'USD').toUpperCase(),
    probability: probability === '' ? null : Number(probability),
    expectedCloseDate: expectedCloseDate || null,
    actualCloseDate: actualCloseDate || null,
    primaryContactId: primaryContactId ? Number(primaryContactId) : null,
    notes: notes.trim() || null,
  }), [name, stage, value, currency, probability, expectedCloseDate, actualCloseDate, primaryContactId, notes]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!name.trim()) return setError('Name is required.');
    setSubmitting(true);
    try {
      if (isEdit) {
        await authenticatedFetchJson(
          `${API_BASE_URL}/crm/companies/${companyId}/opportunities/${oppId}`,
          { method: 'PUT', body: buildBody() }
        );
      } else {
        await authenticatedFetchJson(
          `${API_BASE_URL}/crm/companies/${companyId}/opportunities`,
          { method: 'POST', body: buildBody() }
        );
      }
      const backTo = primaryContactId
        ? `/modules/crm/companies/${companyId}/contacts/${primaryContactId}`
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
    if (!window.confirm(`Delete opportunity "${name}"? This cannot be undone.`)) return;
    setDeleting(true); setError(null);
    try {
      const res = await authenticatedFetch(
        `${API_BASE_URL}/crm/companies/${companyId}/opportunities/${oppId}`,
        { method: 'DELETE' }
      );
      if (res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status}).`);
      }
      navigate(`/modules/crm/companies/${companyId}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <PageLayout title="Opportunity"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  }

  const enteringClosed = CLOSED_STAGES.has(stage);

  return (
    <PageLayout
      title={isEdit ? 'Edit Opportunity' : 'Add Opportunity'}
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
            onCancel={() => {
              const backTo = primaryContactId
                ? `/modules/crm/companies/${companyId}/contacts/${primaryContactId}`
                : `/modules/crm/companies/${companyId}`;
              navigate(backTo);
            }}
            cancelText="Cancel"
            submitText={isEdit ? 'Save changes' : 'Add opportunity'}
            submittingText={isEdit ? 'Saving…' : 'Creating…'}
            isSubmitting={submitting}
          />
        </form>
      </PageCard>
    </PageLayout>
  );
}
