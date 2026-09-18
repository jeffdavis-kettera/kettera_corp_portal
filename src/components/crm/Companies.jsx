// /modules/crm — Companies list, the landing screen of the CRM module.
//
// Search + pagination follows the Users list pattern.
// - CRM Admins see all companies.
// - CRM Basic Users see only companies granted to them (API filters).
// Row click → /modules/crm/companies/:id.
// Header actions: "Configuration" + "Add Company" (both admin-only).
// Non-CRM users are already blocked upstream (the sidebar link only
// appears for module members and the API returns 403); we don't need
// an additional guard here.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../PageLayout.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import { useCrmRole } from './useCrmRole.js';

const PAGE_SIZE = 50;

export default function Companies() {
  const navigate = useNavigate();
  const { isCrmAdmin } = useCrmRole();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedQ) params.set('q', debouncedQ);
        params.set('limit', PAGE_SIZE);
        params.set('offset', offset);
        const data = await authenticatedFetchJson(`${API_BASE_URL}/crm/companies?${params.toString()}`);
        if (!cancelled) setCompanies(data.companies || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load companies.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [debouncedQ, offset]);

  const hasNextPage = companies.length === PAGE_SIZE;
  const hasPrevPage = offset > 0;

  return (
    <PageLayout
      title="CRM — Companies"
      actions={isCrmAdmin ? (
        <>
          <button type="button" className="cancel-button" onClick={() => navigate('/modules/crm/config')}>
            Configuration
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/modules/crm/companies/add')}>
            Add Company
          </button>
        </>
      ) : null}
    >
      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search by company name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="filter-input"
          aria-label="Search companies"
        />
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading companies" />
      ) : companies.length === 0 ? (
        <div className="no-users">
          {debouncedQ ? `No companies match "${debouncedQ}".`
            : isCrmAdmin ? 'No companies yet. Click Add Company to create the first.'
            : "You don't have access to any companies yet. Ask a CRM admin to grant you access."}
        </div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Website</th>
                <th style={{ textAlign: 'right' }}>Contacts</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}
                    onClick={() => navigate(`/modules/crm/companies/${c.id}`)}
                    className="data-table__row-clickable">
                  <td><strong>{c.name}</strong></td>
                  <td className="muted">{c.website || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{c.contactCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(hasPrevPage || hasNextPage) && (
        <div className="pagination">
          <button type="button" className="cancel-button" disabled={!hasPrevPage}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>← Previous</button>
          <span className="pagination__label">Showing {offset + 1}–{offset + companies.length}</span>
          <button type="button" className="cancel-button" disabled={!hasNextPage}
                  onClick={() => setOffset(offset + PAGE_SIZE)}>Next →</button>
        </div>
      )}
    </PageLayout>
  );
}
