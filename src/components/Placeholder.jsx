// Placeholder — reusable "coming in the next phase" screen used by
// routes whose real implementations land in Phase 4 (Users, UserDetail,
// AddUser) or future module phases (CRM, PM, Timekeeping).
//
// Living inside PageLayout means the sidebar + header are the real
// thing — clicking around the app feels close to the finished
// product, just with a candid inline note about what's not built yet.

import PageLayout from './PageLayout.jsx';
import PageCard from './PageCard.jsx';

export default function Placeholder({ title, phase, message }) {
  return (
    <PageLayout title={title}>
      <PageCard className="profile-card--form">
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          {message || `This screen lands in Phase ${phase} of the Corp Portal build.`}
        </p>
      </PageCard>
    </PageLayout>
  );
}
