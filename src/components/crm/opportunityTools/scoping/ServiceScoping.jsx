// Service Scoping — the first opportunity tool. Rendered inside
// OpportunityPageShell under the Tools tab.
//
// Three steps in a section bar: Research and Discovery are
// assessments (shared answers, saved per section through the answers
// endpoint); Recommendation is the rated 3×3 grid where we choose the
// services to pitch (saved through the tool's decision endpoint).
// Everything stays editable; the grid flags drift when answers move
// after services were chosen.

import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../../../utils/config.js';
import { authenticatedFetchJson } from '../../../../utils/api.js';
import { formatDateTime } from '../../opportunityStages.js';
import AssessmentSection from '../../assessments/AssessmentSection.jsx';
import { TOOL_STATUS_LABEL, TOOL_STATUS_CLASS } from '../registry.js';
import ScopingGrid from './ScopingGrid.jsx';

const RECOMMENDATION = 'recommendation';

export default function ServiceScoping() {
  const { id: companyId, oppId } = useParams();
  const { reloadOpportunity } = useOutletContext();
  const base = `${API_BASE_URL}/crm/companies/${companyId}/opportunities/${oppId}`;
  const toolsUrl = `/modules/crm/companies/${companyId}/opportunities/${oppId}/tools`;

  const [tool, setTool] = useState(null);       // GET …/tools/scoping
  const [catalog, setCatalog] = useState([]);   // GET /crm/service-offerings
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [section, setSection] = useState(null);
  const [sectionDirty, setSectionDirty] = useState(false);

  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) { setLoading(true); setError(null); }
    try {
      const [t, c] = await Promise.all([
        authenticatedFetchJson(`${base}/tools/scoping`),
        initial ? authenticatedFetchJson(`${API_BASE_URL}/crm/service-offerings`) : null,
      ]);
      setTool(t);
      if (c) setCatalog(c.services || []);
      if (initial) {
        // Land on the Recommendation step once services have been
        // chosen; otherwise start at the first assessment.
        setSection(t.decision?.services?.length ? RECOMMENDATION : t.assessments[0]?.key ?? RECOMMENDATION);
      }
    } catch (err) {
      setError(err.message || 'Failed to load Service Scoping.');
    } finally {
      if (initial) setLoading(false);
    }
  }, [base]);
  useEffect(() => { load({ initial: true }); }, [load]);

  const refresh = useCallback(() => load(), [load]);

  const saveAnswers = useCallback(async (assessmentKey, changes) => {
    const fresh = await authenticatedFetchJson(`${base}/answers`, {
      method: 'PUT',
      body: { assessment: assessmentKey, answers: changes },
    });
    setTool((t) => (t ? { ...t, answers: { ...t.answers, ...fresh.answers } } : t));
    // Progress, status and the grid come from the server.
    refresh();
    return fresh.answers;
  }, [base, refresh]);

  const saveDecision = useCallback(async (decision, expectedVersion) => {
    const fresh = await authenticatedFetchJson(`${base}/tools/scoping/decision`, {
      method: 'PUT',
      body: { decision, expectedVersion },
    });
    setTool(fresh);
    reloadOpportunity();   // the Details chips and the summary line
    return fresh;
  }, [base, reloadOpportunity]);

  function switchSection(next) {
    if (next === section) return;
    if (sectionDirty && !window.confirm('You have unsaved changes in this section. Leave without saving?')) return;
    setSectionDirty(false);
    setSection(next);
  }

  if (loading) {
    return <div className="spinner" role="status" aria-label="Loading Service Scoping" />;
  }
  if (!tool) {
    return (
      <>
        <div className="error-message"><p>{error || 'Service Scoping is unavailable.'}</p></div>
        <Link to={toolsUrl} className="cancel-button">All tools</Link>
      </>
    );
  }

  const activeAssessment = tool.assessments.find((a) => a.key === section);

  return (
    <>
      <p style={{ margin: '0 0 var(--space-3)' }}>
        <Link to={toolsUrl} className="link-button" style={{ textDecoration: 'none' }}>← All tools</Link>
      </p>

      <div className="tool-header">
        <h2>{tool.title}</h2>
        <span className={TOOL_STATUS_CLASS[tool.status] || 'tool-status'}>
          {TOOL_STATUS_LABEL[tool.status] || tool.status}
        </span>
        <span className="tool-header__meta">
          {tool.decidedAt
            ? `Services chosen ${formatDateTime(tool.decidedAt)}${tool.decidedByName ? ` by ${tool.decidedByName}` : ''}`
            : tool.updatedAt
              ? `Last saved ${formatDateTime(tool.updatedAt)}${tool.updatedByName ? ` by ${tool.updatedByName}` : ''}`
              : 'Nothing saved yet'}
        </span>
      </div>

      {error && <div className="error-message"><p>{error}</p></div>}

      <nav className="section-bar" aria-label="Scoping steps">
        {tool.assessments.map((a) => {
          const p = tool.progress.find((x) => x.key === a.key);
          return (
            <button key={a.key} type="button"
                    className={`section-bar__item${section === a.key ? ' is-active' : ''}`}
                    onClick={() => switchSection(a.key)}>
              {a.title}
              {p && <span className="section-bar__count">{p.answered}/{p.total}</span>}
            </button>
          );
        })}
        <button type="button"
                className={`section-bar__item${section === RECOMMENDATION ? ' is-active' : ''}`}
                onClick={() => switchSection(RECOMMENDATION)}>
          Recommendation
          {tool.decision?.services?.length > 0 && (
            <span className="section-bar__count">{tool.decision.services.length} chosen</span>
          )}
        </button>
      </nav>

      <div className="profile-card">
        {activeAssessment ? (
          <AssessmentSection
            key={activeAssessment.key}
            assessment={activeAssessment}
            answers={tool.answers}
            save={(changes) => saveAnswers(activeAssessment.key, changes)}
            onReload={refresh}
            onDirtyChange={setSectionDirty}
          />
        ) : (
          <ScopingGrid
            result={tool.result}
            catalog={catalog}
            decision={tool.decision}
            version={tool.version}
            decidedAt={tool.decidedAt}
            decidedByName={tool.decidedByName}
            progress={tool.progress}
            onSave={saveDecision}
            onReload={refresh}
            onDirtyChange={setSectionDirty}
          />
        )}
      </div>
    </>
  );
}
