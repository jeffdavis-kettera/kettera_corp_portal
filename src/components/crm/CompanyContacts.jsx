// Contacts tab — full list of contacts for the company.
// Extracted from the old CompanyDetail's inline table.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';

const TYPE_BADGE_CLASS = {
  General: 'role-badge role-badge--basic',
  Billing: 'role-badge role-badge--admin',
  Legal:   'role-badge role-badge--admin',
};

export default function CompanyContacts() {
  const navigate = useNavigate();
  const { company } = useOutletContext();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${company.id}/contacts`
      );
      setContacts(data.contacts || []);
    } catch (err) {
      setError(err.message || 'Failed to load contacts.');
    } finally {
      setLoading(false);
    }
  }, [company.id]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Contacts ({contacts.length})</h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/modules/crm/companies/${company.id}/contacts/add`)}
        >
          Add Contact
        </button>
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading contacts" />
      ) : contacts.length === 0 ? (
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
                    onClick={() => navigate(`/modules/crm/companies/${company.id}/contacts/${c.id}`)}
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
    </>
  );
}
