// /modules/project-management — Projects list, the landing screen of
// the Project Management module.
//
// Grouped by company (the CRM company each project belongs to), with
// a company filter, a status filter, and search. Filters live in the
// URL (?companyId=&status=&q=) so a filtered view can be linked to and
// survives a trip into a project and back.
// - PM Admins see every project.
// - PM Basic Users see projects only for companies granted to them
//   (API filters).
// Row click → /modules/project-management/projects/:id.
// Header actions: "Configuration" + "Add Project" (both admin-only).
// Non-PM users are already blocked upstream (the sidebar link only
// appears for module members and the API returns 403).

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { usePmRole } from './usePmRole.js';
import { STATUSES, STATUS_BADGE_CLASS, formatDate } from './projectStatuses.js';

// One request loads the whole filtered list so a company's group never
// splits across pages. The API caps a request at 500.
const LIST_LIMIT = 500;

export default function Projects() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isPmAdmin } = usePmRole();

  const companyId = searchParams.get('companyId') || '';
  const status = searchParams.get('status') || '';
  const urlQ = searchParams.get('q') || '';

  const [q, setQ] = useState(urlQ);
  const [companies, setCompanies] = useState([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Where a project screen should return to: this list, filters intact.
  const listUrl = `${location.pathname}${location.search}`;

  function updateParams(changes) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value); else next.delete(key);
      }
      return next;
    }, { replace: true });
  }

  // Debounce the search box into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = q.trim();
      setSearchParams((prev) => {
        if ((prev.get('q') || '') === trimmed) return prev;
        const next = new URLSearchParams(prev);
        if (trimmed) next.set('q', trimmed); else next.delete('q');
        return next;
      }, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [q, setSearchParams]);

  // Follow the URL when it changes underneath the box (sidebar link,
  // back button). Skipped when the box already matches, so a trailing
  // space the user is mid-typing isn't trimmed away.
  useEffect(() => {
    setQ((current) => (current.trim() === urlQ ? current : urlQ));
  }, [urlQ]);

  // Companies for the filter dropdown — once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authenticatedFetchJson(`${API_BASE_URL}/pm/companies`);
        if (!cancelled) setCompanies(data.companies || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load companies.');
      } finally {
        if (!cancelled) setCompaniesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const params = new URLSearchParams();
        if (companyId) params.set('companyId', companyId);
        if (status) params.set('status', status);
        if (urlQ) params.set('q', urlQ);
        params.set('limit', LIST_LIMIT);
        const data = await authenticatedFetchJson(`${API_BASE_URL}/pm/projects?${params.toString()}`);
        if (!cancelled) setProjects(data.projects || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load projects.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [companyId, status, urlQ]);

  // The API sorts by company, so each company's projects are contiguous.
  const groups = useMemo(() => {
    const out = [];
    for (const p of projects) {
      const last = out[out.length - 1];
      if (last && last.companyId === p.companyId) last.projects.push(p);
      else out.push({ companyId: p.companyId, companyName: p.companyName, projects: [p] });
    }
    return out;
  }, [projects]);

  // Filter choices: companies that have projects, plus the selected one
  // (so a deep link to a company with none still shows its name).
  const companyOptions = companies.filter(
    (c) => c.projectCount > 0 || String(c.id) === companyId
  );

  const hasFilters = Boolean(companyId || status || urlQ);
  const capped = projects.length === LIST_LIMIT;

  function clearFilters() {
    setQ('');
    setSearchParams({}, { replace: true });
  }

  function openProject(id) {
    navigate(`/modules/project-management/projects/${id}`, { state: { from: listUrl } });
  }

  function addProject(forCompanyId) {
    const qs = forCompanyId ? `?companyId=${forCompanyId}` : '';
    navigate(`/modules/project-management/projects/new${qs}`, { state: { from: listUrl } });
  }

  let emptyMessage;
  if (hasFilters) emptyMessage = 'No projects match the current filters.';
  else if (isPmAdmin) emptyMessage = 'No projects yet. Click Add Project to create the first.';
  else if (companiesLoaded && companies.length === 0) {
    emptyMessage = "You don't have access to any companies yet. Ask a Project Management admin to grant you access.";
  } else emptyMessage = 'No projects yet for the companies you can see.';

  return (
    <PageLayout
      title="Project Management — Projects"
      actions={isPmAdmin ? (
        <>
          <button type="button" className="cancel-button" onClick={() => navigate('/modules/project-management/config')}>
            Configuration
          </button>
          <button type="button" className="btn-primary" onClick={() => addProject(companyId)}>
            Add Project
          </button>
        </>
      ) : null}
    >
      <div className="filter-bar filter-bar--row">
        <input
          type="search"
          placeholder="Search projects, companies, or opportunities…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="filter-input"
          aria-label="Search projects"
        />
        <select
          value={companyId}
          onChange={(e) => updateParams({ companyId: e.target.value })}
          className="filter-input"
          aria-label="Filter by company"
        >
          <option value="">All companies</option>
          {companyOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value })}
          className="filter-input"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading projects" />
      ) : projects.length === 0 ? (
        <div className="no-users">{emptyMessage}</div>
      ) : (
        <>
          <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Opportunity</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>Target end</th>
                  <th>Manager</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.companyId}>
                  <tr className="data-table__group-row">
                    <th colSpan={6} scope="rowgroup">
                      <div className="data-table__group-header">
                        <span>
                          {companyId ? (
                            <span className="data-table__group-name">{g.companyName}</span>
                          ) : (
                            <button
                              type="button"
                              className="link-button data-table__group-name"
                              onClick={() => updateParams({ companyId: String(g.companyId) })}
                              title={`Show only ${g.companyName}`}
                            >
                              {g.companyName}
                            </button>
                          )}
                          <span className="data-table__group-count">
                            {g.projects.length} {g.projects.length === 1 ? 'project' : 'projects'}
                          </span>
                        </span>
                        {isPmAdmin && (
                          <button type="button" className="link-button" onClick={() => addProject(g.companyId)}>
                            Add project
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                  {g.projects.map((p) => (
                    <tr key={p.id}
                        onClick={() => openProject(p.id)}
                        className="data-table__row-clickable">
                      <td><strong>{p.name}</strong></td>
                      <td className={p.opportunityName ? undefined : 'muted'}>{p.opportunityName || '—'}</td>
                      <td>
                        <span className={STATUS_BADGE_CLASS[p.status] || 'project-status-badge'}>{p.status}</span>
                      </td>
                      <td className="muted">{formatDate(p.startDate) || '—'}</td>
                      <td className="muted">{formatDate(p.endDate) || '—'}</td>
                      <td className={p.projectManagerName || p.projectManagerEmail ? undefined : 'muted'}>
                        {p.projectManagerName || p.projectManagerEmail || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          {capped && (
            <p className="muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
              Showing the first {LIST_LIMIT} projects. Narrow the list with the filters above.
            </p>
          )}
        </>
      )}
    </PageLayout>
  );
}
