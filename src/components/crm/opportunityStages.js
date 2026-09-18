// Shared helpers for CRM opportunity screens. Kept as a plain
// module (not a hook) so it can be imported by any component that
// needs the stage list, the badge class map, or the currency /
// probability formatters.

export const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export const CLOSED_STAGES = new Set(['Won', 'Lost']);

// Maps stage → CSS class for the pill. The class definitions live
// in App.css (.stage-badge + stage-badge--<lowercase>).
export const STAGE_BADGE_CLASS = {
  Lead:        'stage-badge stage-badge--lead',
  Qualified:   'stage-badge stage-badge--qualified',
  Proposal:    'stage-badge stage-badge--proposal',
  Negotiation: 'stage-badge stage-badge--negotiation',
  Won:         'stage-badge stage-badge--won',
  Lost:        'stage-badge stage-badge--lost',
};

/**
 * Format a numeric monetary value + currency code as a locale-aware
 * currency string. Falls back to the raw number when Intl throws
 * (e.g. an unsupported currency code).
 */
export function formatCurrency(value, currency = 'USD') {
  if (value == null) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${currency || ''} ${Number(value).toLocaleString()}`.trim();
  }
}

/** "YYYY-MM-DD" or ISO → user-locale short date. Empty string if null. */
export function formatDate(iso) {
  if (!iso) return '';
  try {
    // Force UTC-anchored parse for DATE values that come back as
    // "YYYY-MM-DD" so tz offsets don't slide the day.
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Date(`${iso}T00:00:00Z`)
      : new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return String(iso).slice(0, 10); }
}

/** Turn an ISO date to a value acceptable to <input type="date">. */
export function toDateInputValue(iso) {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    // Use UTC parts so a DATE column round-trips without tz drift.
    const y  = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  } catch { return ''; }
}
