// CompanyProfileCard — the company profile (industry, size, IT
// organization, platforms, sources) on the company Overview tab.
// Editable by anyone with access to the company; the same fields
// appear inside an opportunity's Service Scoping tool and save to the
// same place.

import { useCallback, useEffect, useState } from 'react';
import PageCard from '../PageCard.jsx';
import AssessmentSection from './assessments/AssessmentSection.jsx';
import { API_BASE_URL } from '../../utils/config.js';
import { authenticatedFetchJson } from '../../utils/api.js';

export default function CompanyProfileCard({ companyId }) {
  const url = `${API_BASE_URL}/crm/companies/${companyId}/profile`;
  const [profile, setProfile] = useState(null); // { questions, answers, updatedAt, updatedByName }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProfile(await authenticatedFetchJson(url));
    } catch (err) {
      setError(err.message || 'Failed to load the company profile.');
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (changes) => {
    const fresh = await authenticatedFetchJson(url, {
      method: 'PUT',
      body: { answers: changes.map(({ key, value, note, expectedUpdatedAt }) => ({ key, value, note, expectedUpdatedAt })) },
    });
    setProfile(fresh);
    return fresh.answers;
  }, [url]);

  return (
    <PageCard className="profile-card--form">
      <h2 style={{ marginTop: 0 }}>Company profile</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0 }}>
        Facts about the company that every opportunity shares. Anyone with access
        to the company can update them, here or from an opportunity's Service
        Scoping tool.
      </p>

      {error && <div className="error-message"><p>{error}</p></div>}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading company profile" />
      ) : profile && (
        <AssessmentSection
          assessment={{
            key: 'companyProfile',
            title: 'Company profile',
            description: null,
            usedBy: [],
            sections: [{ key: 'profile', title: null, description: null, questions: profile.questions }],
          }}
          answers={profile.answers}
          save={save}
          onReload={load}
        />
      )}
    </PageCard>
  );
}
