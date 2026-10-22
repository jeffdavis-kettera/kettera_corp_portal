// Tools tab — one card per opportunity tool, with its status,
// progress and one-line result. Rendered inside OpportunityPageShell.
// Clicking a card opens the tool under this tab.
//
// Cards are split by relevance: "For this opportunity" holds Service
// Scoping and the tools for the services it chose; everything else
// sits under "Other tools", collapsed.

import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../../utils/config.js';
import { authenticatedFetchJson } from '../../../utils/api.js';
import { formatDateTime } from '../opportunityStages.js';
import { OPPORTUNITY_TOOLS, TOOL_STATUS_LABEL, TOOL_STATUS_CLASS } from './registry.js';

export default function OpportunityTools() {
  const { id: companyId, oppId } = useParams();
  const navigate = useNavigate();
  const { opportunity } = useOutletContext();

  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await authenticatedFetchJson(
          `${API_BASE_URL}/crm/companies/${companyId}/opportunities/${oppId}/tools`
        );
        if (!cancelled) setTools(data.tools || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load tools.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, oppId, opportunity.updatedAt]);

  const titleByKey = Object.fromEntries(tools.map((t) => [t.key, t.title]));
  const relevant = tools.filter((t) => t.relevant);
  const others = tools.filter((t) => !t.relevant);
  const servicesChosen = (opportunity.services || []).length > 0;

  function renderCard(tool) {
    const known = OPPORTUNITY_TOOLS[tool.key];
    const blocked = tool.blockedBy.length > 0;
    return (
      <button
        key={tool.key}
        type="button"
        className="module-card module-card--link tool-card"
        disabled={!known}
        onClick={() => known && navigate(`/modules/crm/companies/${companyId}/opportunities/${oppId}/tools/${tool.key}`)}
      >
        <div className="tool-card__head">
          <h3>{tool.title}</h3>
          <span className={TOOL_STATUS_CLASS[tool.status] || 'tool-status'}>
            {TOOL_STATUS_LABEL[tool.status] || tool.status}
          </span>
        </div>
        <p>{tool.description}</p>
        {tool.summary && <p><strong>{tool.summary}</strong></p>}
        {tool.progress.length > 0 && (
          <p className="tool-card__meta">
            {tool.progress.map((p) => `${p.title} ${p.answered}/${p.total}`).join(' · ')}
          </p>
        )}
        {blocked && (
          <p className="tool-card__meta">
            Needs {tool.blockedBy.map((k) => titleByKey[k] || k).join(', ')} first.
          </p>
        )}
        <p className="tool-card__meta">
          {!known
            ? 'Coming soon'
            : tool.updatedAt
              ? `Updated ${formatDateTime(tool.updatedAt)}${tool.updatedByName ? ` by ${tool.updatedByName}` : ''}`
              : 'Not started yet'}
        </p>
      </button>
    );
  }

  return (
    <>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        Worksheets for working this opportunity. Each tool keeps its own progress;
        answers are shared, so a fact gathered in one tool is there for the next.
      </p>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading tools" />
      ) : tools.length === 0 ? (
        <div className="no-users">No tools are available yet.</div>
      ) : (
        <>
          <div className="tool-group-head">
            <h3>For this opportunity</h3>
            {!servicesChosen && others.length > 0 && (
              <p className="muted">Choose services in Service Scoping and the deliverable tools for them appear here.</p>
            )}
          </div>
          <div className="module-grid">{relevant.map(renderCard)}</div>

          {others.length > 0 && (
            <>
              <div className="tool-group-head" style={{ marginTop: 'var(--space-6)' }}>
                <h3>
                  Other tools <span className="muted">({others.length})</span>
                  {' '}
                  <button type="button" className="link-button" onClick={() => setShowOthers(!showOthers)}>
                    {showOthers ? 'Hide' : 'Show'}
                  </button>
                </h3>
                <p className="muted">Tools for services this opportunity isn't pitching. Still usable if plans change.</p>
              </div>
              {showOthers && <div className="module-grid">{others.map(renderCard)}</div>}
            </>
          )}
        </>
      )}
    </>
  );
}
