// Shared helpers for Project Management screens: the status list,
// the badge class map, and the date helpers (re-exported from the
// CRM opportunity helpers so DATE columns format the same way
// everywhere).

export { formatDate, toDateInputValue } from '../crm/opportunityStages.js';

// Same order as the API's chk_pm_project_status constraint.
export const STATUSES = ['Planned', 'Active', 'On Hold', 'Completed', 'Cancelled'];

// Maps status → CSS class for the pill. The class definitions live
// in App.css (.project-status-badge + project-status-badge--<slug>).
export const STATUS_BADGE_CLASS = {
  Planned:   'project-status-badge project-status-badge--planned',
  Active:    'project-status-badge project-status-badge--active',
  'On Hold': 'project-status-badge project-status-badge--on-hold',
  Completed: 'project-status-badge project-status-badge--completed',
  Cancelled: 'project-status-badge project-status-badge--cancelled',
};
