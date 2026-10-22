// DeliverablesTool — the screen for every Deliverables tool (one per
// Kettera service). Rendered inside OpportunityPageShell under the
// Tools tab; the registry passes `toolKey`.
//
// Steps in a section bar: the tool's assessments (shared sets such as
// "Teaching engagement", plus a symptom-based set for the domain),
// then "Deliverables": the service's catalog ranked Recommended /
// Consider / Not indicated from the answers, where we choose what
// goes in the proposal, with quantities and notes.

import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../../../utils/config.js';
import { authenticatedFetchJson } from '../../../../utils/api.js';
import { formatDateTime } from '../../opportunityStages.js';
import AssessmentSection from '../../assessments/AssessmentSection.jsx';
import { TOOL_STATUS_LABEL, TOOL_STATUS_CLASS } from '../registry.js';
import DeliverablesPicker from './DeliverablesPicker.jsx';

const PICK = 'deliverables';

export default function DeliverablesTool({ toolKey }) {
  const { id: companyId, oppId } = useParams();
  const { reloadOpportunity } = useOutletContext();
  const base = `${API_BASE_URL}/crm/companies/${companyId}/opportunities/${oppId}`;
  const toolsUrl = `/modules/crm/companies/${companyId}/opportunities/${oppId}/tools`;

  const [tool, setTool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [section, setSection] = useState(null);
  const [sectionDirty, setSectionDirty] = useState(false);

  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) { setLoading(true); setError(null); }
    try {
      const t = await authenticatedFetchJson(`${base}/tools/${toolKey}`);
      setTool(t);
      if (initial) setSection(t.decision?.items?.length ? PICK : t.assessments[0]?.key ?? PICK);
    } catch (err) {
      setError(err.message || 'Failed to load the tool.');
    } finally {
      if (initial) setLoading(false);
    }
  }, [base, toolKey]);
  useEffect(() => { load({ initial: true }); }, [load]);

  const refresh = useCallback(() => load(), [load]);

  const saveAnswers = useCallback(async (assessmentKey, changes) => {
    const fresh = await authenticatedFetchJson(`${base}/answers`, {
      method: 'PUT',
      body: { assessment: assessmentKey, answers: changes },
    });
    setTool((t) => (t ? { ...t, answers: { ...t.answers, ...fresh.answers } } : t));
    refresh();
    return fresh.answers;
  }, [base, refresh]);

  const saveDecision = useCallback(async (decision, expectedVersion) => {
    const fresh = await authenticatedFetchJson(`${base}/tools/${toolKey}/decision`, {
      method: 'PUT',
      body: { decision, expectedVersion },
    });
    setTool(fresh);
    reloadOpportunity();
    return fresh;
  }, [base, toolKey, reloadOpportunity]);

  function switchSection(next) {
    if (next === section) return;
    if (sectionDirty && !window.confirm('You have unsaved changes in this section. Leave without saving?')) return;
    setSectionDirty(false);
    setSection(next);
  }

  if (loading) return <div className="spinner" role="status" aria-label="Loading tool" />;
  if (!tool) {
    return (
      <>
        <div className="error-message"><p>{error || 'This tool is unavailable.'}</p></div>
        <Link to={toolsUrl} className="cancel-button">All tools</Link>
      </>
    );
  }

  const activeAssessment = tool.assessments.find((a) => a.key === section);
  const chosen = tool.decision?.items?.length || 0;

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
            ? `Deliverables chosen ${formatDateTime(tool.decidedAt)}${tool.decidedByName ? ` by ${tool.decidedByName}` : ''}`
            : tool.updatedAt
              ? `Last saved ${formatDateTime(tool.updatedAt)}${tool.updatedByName ? ` by ${tool.updatedByName}` : ''}`
              : 'Nothing saved yet'}
        </span>
      </div>

      {!tool.relevant && tool.relevanceReason && (
        <div className="info-banner" role="note">{tool.relevanceReason}</div>
      )}
      {error && <div className="error-message"><p>{error}</p></div>}

      <nav className="section-bar" aria-label="Steps">
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
                className={`section-bar__item${section === PICK ? ' is-active' : ''}`}
                onClick={() => switchSection(PICK)}>
          Deliverables
          {chosen > 0 && <span className="section-bar__count">{chosen} chosen</span>}
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
          <DeliverablesPicker
            result={tool.result}
            decision={tool.decision}
            version={tool.version}
            onSave={saveDecision}
            onReload={refresh}
            onDirtyChange={setSectionDirty}
          />
        )}
      </div>
    </>
  );
}
