// ProjectForm — one component for create and edit, mirroring
// OpportunityForm's shape. Routes:
//   /modules/project-management/projects/new?companyId=X   create (PM Admin)
//   /modules/project-management/projects/:projectId        edit (PM Admin),
//                                                           view (PM Basic User)
//
// Fields: company (a CRM company — required), opportunity (one of
// that company's CRM opportunities — optional), name, status, start +
// target end date, project manager (an active Project Management
// member), description.
//
// PM Basic Users get the same layout read-only with an info banner,
// the CompanyOverview pattern for admin-managed records.
//
// Save, Cancel, and Delete return to wherever the user came from (the
// list passes its filtered URL in location state), else the list.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson, authenticatedFetch } from '../../utils/api.js';
import { usePmRole } from './usePmRole.js';
import { STATUSES, toDateInputValue } from './projectStatuses.js';

const LIST_PATH = '/modules/project-management';

function personLabel(displayName, email) {
  return displayName || email || 'Unknown user';
}

export default function ProjectForm() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isPmAdmin } = usePmRole();

  const isEdit = Boolean(projectId);
  const readOnly = !isPmAdmin;
  const backTo = location.state?.from || LIST_PATH;
  const initialCompanyId = searchParams.get('companyId') || '';

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [project, setProject] = useState(null); // loaded row (edit / view)
  const [companies, setCompanies] = useState([]);
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [opportunitiesFor, setOpportunitiesFor] = useState(''); // companyId the list belongs to

  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [opportunityId, setOpportunityId] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Planned');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectManagerUserId, setProjectManagerUserId] = useState('');
  const [description, setDescription] = useState('');

  // Basic users can view projects but not create them.
  useEffect(() => {
    if (!isEdit && !isPmAdmin) navigate(LIST_PATH, { replace: true });
  }, [isEdit, isPmAdmin, navigate]);

  // Admin pickers. Basic users only view, so their (disabled) selects
  // are filled from the loaded project instead — and the member list
  // is admin-only on the API anyway.
  useEffect(() => {
    if (!isPmAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await authenticatedFetchJson(`${API_BASE_URL}/pm/companies`);
        if (!cancelled) setCompanies(data.companies || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load companies.');
      }
    })();
    (async () => {
      try {
        const data = await authenticatedFetchJson(`${API_BASE_URL}/modules/project-management/users`);
        if (!cancelled) setMembers((data.members || []).filter((m) => m.status === 'Active'));
      } catch { /* non-fatal — the manager picker just stays empty */ }
      finally {
        if (!cancelled) setMembersLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isPmAdmin]);

  // Opportunities for the selected company.
  useEffect(() => {
    if (!isPmAdmin || !companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await authenticatedFetchJson(
          `${API_BASE_URL}/pm/companies/${companyId}/opportunities`
        );
        if (cancelled) return;
        setOpportunities(data.opportunities || []);
        setOpportunitiesFor(companyId);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load opportunities.');
      }
    })();
    return () => { cancelled = true; };
  }, [isPmAdmin, companyId]);

  // Edit / view: load the project.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const p = await authenticatedFetchJson(`${API_BASE_URL}/pm/projects/${projectId}`);
        if (cancelled) return;
        setProject(p);
        setCompanyId(String(p.companyId));
        setOpportunityId(p.opportunityId ? String(p.opportunityId) : '');
        setName(p.name);
        setStatus(p.status);
        setStartDate(toDateInputValue(p.startDate));
        setEndDate(toDateInputValue(p.endDate));
        setProjectManagerUserId(p.projectManagerUserId ? String(p.projectManagerUserId) : '');
        setDescription(p.description || '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load project.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, projectId]);

  function handleCompanyChange(e) {
    setCompanyId(e.target.value);
    // Opportunities belong to one company, so a new company clears it.
    setOpportunityId('');
  }

  function handleOpportunityChange(e) {
    const value = e.target.value;
    setOpportunityId(value);
    // Projects are usually named for the deal they deliver — offer the
    // opportunity's name while the name box is still empty.
    if (value && !name.trim()) {
      const opp = opportunities.find((o) => String(o.id) === value);
      if (opp) setName(opp.name);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || readOnly) return;
    setError(null);
    if (!companyId) return setError('Company is required.');
    if (!name.trim()) return setError('Name is required.');
    if (startDate && endDate && endDate < startDate) {
      return setError('The target end date cannot be before the start date.');
    }
    const body = {
      companyId: Number(companyId),
      opportunityId: opportunityId ? Number(opportunityId) : null,
      name: name.trim(),
      status,
      startDate: startDate || null,
      endDate: endDate || null,
      projectManagerUserId: projectManagerUserId ? Number(projectManagerUserId) : null,
      description: description.trim() || null,
    };
    setSubmitting(true);
    try {
      if (isEdit) {
        await authenticatedFetchJson(`${API_BASE_URL}/pm/projects/${projectId}`, { method: 'PUT', body });
      } else {
        await authenticatedFetchJson(`${API_BASE_URL}/pm/projects`, { method: 'POST', body });
      }
      navigate(backTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || readOnly || deleting) return;
    if (!window.confirm(`Delete project "${project?.name || name}"? This cannot be undone.`)) return;
    setDeleting(true); setError(null);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/pm/projects/${projectId}`, { method: 'DELETE' });
      if (res.status !== 204) {
        const resBody = await res.json().catch(() => ({}));
        throw new Error(resBody.error || `Delete failed (${res.status}).`);
      }
      navigate(backTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  // A Basic User on the create route is being redirected (see above).
  if (!isEdit && readOnly) return null;
  if (loading) {
    return <PageLayout title="Project"><div className="spinner" role="status" aria-label="Loading" /></PageLayout>;
  }
  if (isEdit && !project) {
    return (
      <PageLayout title="Project">
        <div className="error-message"><p>{error || 'Project not found.'}</p></div>
        <button type="button" className="cancel-button" onClick={() => navigate(backTo)}>
          Back to Projects
        </button>
      </PageLayout>
    );
  }

  // Select options. Read-only views show only the stored values.
  const companyOptions = readOnly
    ? [{ id: project.companyId, name: project.companyName }]
    : companies;
  const opportunityOptions = readOnly
    ? (project.opportunityId
      ? [{ id: project.opportunityId, name: project.opportunityName, stage: project.opportunityStage }]
      : [])
    : (opportunitiesFor === companyId ? opportunities : []);
  const managerOptions = readOnly
    ? (project.projectManagerUserId
      ? [{ portalUserId: project.projectManagerUserId,
           label: personLabel(project.projectManagerName, project.projectManagerEmail) }]
      : [])
    : members.map((m) => ({ portalUserId: m.portalUserId, label: personLabel(m.displayName, m.email) }));
  // Keep a stored manager who has since left the module (or been
  // suspended) selectable, so editing other fields doesn't drop them.
  if (!readOnly && project?.projectManagerUserId
      && !managerOptions.some((m) => m.portalUserId === project.projectManagerUserId)) {
    const label = personLabel(project.projectManagerName, project.projectManagerEmail);
    managerOptions.push({
      portalUserId: project.projectManagerUserId,
      label: membersLoaded ? `${label} (no longer an active member)` : label,
    });
  }
  const companyHasNoOpportunities = !readOnly && companyId
    && opportunitiesFor === companyId && opportunities.length === 0;

  let title = 'Add Project';
  if (isEdit) title = readOnly ? project.name : 'Edit Project';

  return (
    <PageLayout
      title={title}
      actions={
        isEdit && !readOnly ? (
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
        {readOnly && (
          <div className="info-banner" role="note">
            You have access to this project as a Project Management Basic User.
            Projects are managed by Project Management admins.
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label htmlFor="companyId">Company *</label>
            <select id="companyId" value={companyId}
                    onChange={handleCompanyChange}
                    required disabled={readOnly || submitting}
                    autoFocus={!isEdit && !initialCompanyId}>
              <option value="">Select a company…</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="opportunityId">Opportunity</label>
            <select id="opportunityId" value={opportunityId}
                    onChange={handleOpportunityChange}
                    disabled={readOnly || submitting || !companyId}>
              <option value="">— None —</option>
              {opportunityOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.stage})</option>
              ))}
            </select>
            {companyHasNoOpportunities && (
              <p className="muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                This company has no opportunities in CRM yet.
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input id="name" type="text" value={name}
                   onChange={(e) => setName(e.target.value)}
                   maxLength={300} required disabled={readOnly || submitting}
                   autoFocus={!isEdit && Boolean(initialCompanyId)}
                   placeholder="What are we delivering?" />
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select id="status" value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={readOnly || submitting}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="startDate">Start date</label>
            <input id="startDate" type="date" value={startDate}
                   onChange={(e) => setStartDate(e.target.value)}
                   disabled={readOnly || submitting} />
          </div>

          <div className="form-group">
            <label htmlFor="endDate">Target end date</label>
            <input id="endDate" type="date" value={endDate}
                   onChange={(e) => setEndDate(e.target.value)}
                   min={startDate || undefined}
                   disabled={readOnly || submitting} />
          </div>

          <div className="form-group">
            <label htmlFor="projectManagerUserId">Project manager</label>
            <select id="projectManagerUserId" value={projectManagerUserId}
                    onChange={(e) => setProjectManagerUserId(e.target.value)}
                    disabled={readOnly || submitting}>
              <option value="">— None —</option>
              {managerOptions.map((m) => (
                <option key={m.portalUserId} value={m.portalUserId}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea id="description" rows="6" value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={readOnly || submitting}
                      placeholder="Scope, deliverables, key milestones…" />
          </div>

          {readOnly ? (
            <div className="form-actions">
              <button type="button" className="cancel-button" onClick={() => navigate(backTo)}>
                Back to Projects
              </button>
            </div>
          ) : (
            <FormActions
              onCancel={() => navigate(backTo)}
              cancelText="Cancel"
              submitText={isEdit ? 'Save changes' : 'Add project'}
              submittingText={isEdit ? 'Saving…' : 'Creating…'}
              isSubmitting={submitting}
            />
          )}
        </form>
      </PageCard>
    </PageLayout>
  );
}
