// Company access grant editor. Shared by every module in
// moduleConfigs.js (/modules/crm/config/company-access,
// /modules/project-management/config/company-access); each module
// keeps its own grants on the API side.
//
// UI: pick a company from a dropdown (URL query ?companyId= keeps
// the selection shareable). Table below shows every Basic User of
// the module with a checkbox for whether they have access. Save
// button issues PUT with the checked user ids.
//
// Admins are not shown in the pool — they see everything unconditionally.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import PageCard from '../PageCard.jsx';
import FormActions from '../FormActions.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { useModuleRole } from './useModuleRole.js';

export default function ModuleCompanyAccess({ module }) {
  const { code, label, homePath, configPath, companiesApi, companyAccessApi, companyAccessIntro } = module;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isModuleAdmin } = useModuleRole(code);

  const initialCompanyId = searchParams.get('companyId')
    ? Number(searchParams.get('companyId'))
    : null;

  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [companyAccess, setCompanyAccess] = useState(null); // { companyId, companyName, grants, eligibleUsers }
  const [checked, setChecked] = useState(new Set()); // Set<portalUserId>
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!isModuleAdmin) navigate(homePath, { replace: true });
  }, [isModuleAdmin, navigate, homePath]);

  // Load company list once for the picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authenticatedFetchJson(`${API_BASE_URL}${companiesApi}`);
        if (!cancelled) setCompanies(data.companies || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load companies.');
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companiesApi]);

  // Fetch the grant matrix whenever the selected company changes.
  const loadAccess = useCallback(async (companyId) => {
    if (!companyId) { setCompanyAccess(null); setChecked(new Set()); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const data = await authenticatedFetchJson(
        `${API_BASE_URL}${companyAccessApi}?companyId=${companyId}`
      );
      setCompanyAccess(data);
      setChecked(new Set((data.grants || []).map((g) => g.portalUserId)));
    } catch (err) {
      setError(err.message || 'Failed to load access matrix.');
      setCompanyAccess(null);
      setChecked(new Set());
    } finally {
      setLoading(false);
    }
  }, [companyAccessApi]);

  useEffect(() => { loadAccess(selectedCompanyId); }, [selectedCompanyId, loadAccess]);

  function handleCompanyChange(e) {
    const id = e.target.value ? Number(e.target.value) : null;
    setSelectedCompanyId(id);
    if (id) setSearchParams({ companyId: String(id) });
    else setSearchParams({});
  }

  function toggle(userId) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!selectedCompanyId || saving) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      await authenticatedFetchJson(`${API_BASE_URL}${companyAccessApi}`, {
        method: 'PUT',
        body: {
          companyId: selectedCompanyId,
          userIds: [...checked],
        },
      });
      setSuccess('Access saved.');
      // Reload so we're rendering the server's canonical state (in
      // case defense-in-depth filtered anyone out).
      await loadAccess(selectedCompanyId);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const eligibleUsers = companyAccess?.eligibleUsers || [];

  return (
    <PageLayout title={`${label} — Company Access`}>
      <PageCard className="profile-card--form">
        <p style={{ marginTop: 0, color: 'var(--color-text-secondary)' }}>
          {companyAccessIntro}
        </p>

        {error && <div className="error-message"><p>{error}</p></div>}
        {success && <div className="success-message"><p>{success}</p></div>}

        <div className="form-group">
          <label htmlFor="companyPicker">Company</label>
          <select id="companyPicker"
                  value={selectedCompanyId || ''}
                  onChange={handleCompanyChange}
                  disabled={companiesLoading || saving}>
            <option value="">Select a company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="spinner" role="status" aria-label="Loading access matrix" />
        ) : selectedCompanyId && companyAccess ? (
          <>
            <h3 style={{ marginBottom: 'var(--space-3)' }}>
              Users who can access {companyAccess.companyName}
            </h3>
            {eligibleUsers.length === 0 ? (
              <div className="no-users">
                No {label} Basic Users exist yet. Add users to the portal and
                grant them the {label} Basic User role first.
              </div>
            ) : (
              <form onSubmit={handleSave}>
                <div className="profile-card" style={{ padding: 0, overflowX: 'auto', marginBottom: 'var(--space-4)' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px', textAlign: 'center' }}>Access</th>
                        <th>Email</th>
                        <th>Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleUsers.map((u) => (
                        <tr key={u.id}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={checked.has(u.id)}
                              onChange={() => toggle(u.id)}
                              disabled={saving}
                              aria-label={`Grant access to ${u.email}`}
                            />
                          </td>
                          <td>{u.email}</td>
                          <td className="muted">{u.displayName || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <FormActions
                  onCancel={() => navigate(configPath)}
                  cancelText="Back to Configuration"
                  submitText="Save access"
                  submittingText="Saving…"
                  isSubmitting={saving}
                />
              </form>
            )}
          </>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>
            Pick a company above to edit its access list.
          </p>
        )}
      </PageCard>
    </PageLayout>
  );
}
