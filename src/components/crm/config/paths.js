// Routes and small helpers shared by the assessment-configuration
// screens (CRM Configuration → Assessments).

export const CONFIG_BASE = '/modules/crm/config/assessments';

export const QUESTION_TYPES = [
  { value: 'single',     label: 'Single choice' },
  { value: 'multi',      label: 'Multiple choice' },
  { value: 'agree',      label: 'Agree / somewhat / not really' },
  { value: 'text',       label: 'Short text' },
  { value: 'longtext',   label: 'Long text' },
  { value: 'domainGrid', label: 'Per-domain choice (EA / APM / Innovation)' },
];
export const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES.map((t) => [t.value, t.label]));
export const OPTION_TYPES = new Set(['single', 'multi', 'agree', 'domainGrid']);

export const SCOPES = [
  { value: 'opportunity', label: 'Opportunity — answered per deal' },
  { value: 'company',     label: 'Company — shared by every opportunity for the company' },
];

export const AGREE_OPTIONS = [
  { value: 'strong',     label: 'Agree strongly' },
  { value: 'somewhat',   label: 'Somewhat' },
  { value: 'not_really', label: 'Not really' },
];

/** "Renewals catch them by surprise" → "renewalsCatchThemBySurprise" (mirrors the API). */
export function camelCase(text) {
  const words = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return '';
  return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

/** "Fewer than 250" → "fewer_than_250" (mirrors the API). */
export function snakeCase(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
}

export function suggestQuestionKey(scope, label) {
  const name = camelCase(label).slice(0, 60) || 'question';
  return `${scope === 'company' ? 'company' : 'custom'}.${name}`;
}
