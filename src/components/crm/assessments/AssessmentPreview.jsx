// AssessmentPreview — an assessment rendered exactly as users see it,
// with every control disabled. Used by the configuration screens.

import QuestionField from './QuestionField.jsx';

export default function AssessmentPreview({ assessment }) {
  if (!assessment) return null;
  return (
    <div className="assessment-preview">
      {assessment.description && (
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>{assessment.description}</p>
      )}
      {assessment.sections.map((section) => (
        <section key={section.key} className="assessment-section">
          <div className="assessment-section__head">
            {section.title && <h3>{section.title}</h3>}
            {section.description && (
              <p className="muted" style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>{section.description}</p>
            )}
          </div>
          <div className="form-stack">
            {section.questions.filter((q) => !q.retired).map((q) => (
              <QuestionField key={q.key} question={q} value={null} note={null}
                             onChange={() => {}} onNoteChange={() => {}} disabled />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
