// Documents tab body — full document list for a company.
// Rendered inside CompanyPageShell's <Outlet />; consumes the
// loaded company via useOutletContext.
//
// Row click → edit metadata page. Download button (per-row) calls
// GET /:docId/download to get a short-lived SAS URL and opens it
// in a new tab. Upload button routes to the upload page.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';
import {
  DOCUMENT_TYPES, DOC_TYPE_BADGE_CLASS, formatBytes, formatDate,
} from './documentHelpers.js';

const PAGE_SIZE = 50;

export default function CompanyDocuments() {
  const { company } = useOutletContext();
  const navigate = useNavigate();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [offset, setOffset] = useState(0);

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setOffset(0); }, [typeFilter]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set('q', debouncedQ);
      if (typeFilter) params.set('type', typeFilter);
      params.set('limit', PAGE_SIZE);
      params.set('offset', offset);
      const data = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${company.id}/documents?${params.toString()}`
      );
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [company.id, debouncedQ, typeFilter, offset]);
  useEffect(() => { load(); }, [load]);

  async function handleDownload(doc, e) {
    // Row click also navigates; stop propagation so download
    // doesn't also fire an edit-page navigation.
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(doc.id); setDownloadError(null);
    try {
      const { url } = await authenticatedFetchJson(
        `${API_BASE_URL}/crm/companies/${company.id}/documents/${doc.id}/download`
      );
      // Open in a new tab so the download starts without leaving
      // the current page. The SAS URL has Content-Disposition:
      // attachment set by the API on upload, so browsers save
      // instead of navigating.
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setDownloadError(err.message || 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  }

  const hasNextPage = documents.length === PAGE_SIZE;
  const hasPrevPage = offset > 0;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Documents</h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/modules/crm/companies/${company.id}/documents/upload`)}
        >
          Upload Document
        </button>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search title, filename, notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="filter-input"
          aria-label="Search documents"
          style={{ maxWidth: 320, marginBottom: 0 }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
          style={{ width: 'auto', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
        >
          <option value="">All types</option>
          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}
      {downloadError && <div className="error-message"><p>{downloadError}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading documents" />
      ) : documents.length === 0 ? (
        <div className="no-users">
          {debouncedQ || typeFilter
            ? 'No documents match those filters.'
            : 'No documents uploaded yet. Click Upload Document to add the first.'}
        </div>
      ) : (
        <div className="profile-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th style={{ width: '130px' }}>Type</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Size</th>
                <th style={{ width: '130px' }}>Uploaded</th>
                <th style={{ width: '160px' }}>Uploaded by</th>
                <th style={{ width: '110px' }}></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}
                    onClick={() => navigate(`/modules/crm/companies/${company.id}/documents/${d.id}`)}
                    className="data-table__row-clickable">
                  <td>
                    <strong>{d.title}</strong>
                    {d.originalFilename && d.originalFilename !== d.title && (
                      <div className="muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 2 }}>
                        {d.originalFilename}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={DOC_TYPE_BADGE_CLASS[d.documentType] || 'role-badge role-badge--basic'}>
                      {d.documentType}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }} className="muted">{formatBytes(d.sizeBytes)}</td>
                  <td className="muted">{formatDate(d.createdAt)}</td>
                  <td className="muted">{d.createdByName || d.createdByEmail || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="cancel-button"
                      style={{
                        padding: 'var(--space-1) var(--space-3)',
                        fontSize: 'var(--font-size-sm)',
                      }}
                      onClick={(e) => handleDownload(d, e)}
                      disabled={downloadingId === d.id}
                    >
                      {downloadingId === d.id ? '…' : 'Download'}
                    </button>
                  </td>
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
          <span className="pagination__label">Showing {offset + 1}–{offset + documents.length}</span>
          <button type="button" className="cancel-button" disabled={!hasNextPage}
                  onClick={() => setOffset(offset + PAGE_SIZE)}>Next →</button>
        </div>
      )}
    </>
  );
}
