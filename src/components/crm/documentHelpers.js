// Small helpers shared by the CRM document screens. Kept out of
// the components so their imports stay tight and the type/badge
// map lives in one place.

export const DOCUMENT_TYPES = ['Proposal', 'Contract', 'Presentation', 'NDA', 'Other'];

export const DOC_TYPE_BADGE_CLASS = {
  Proposal:     'role-badge role-badge--admin',
  Contract:     'role-badge role-badge--admin',
  Presentation: 'role-badge role-badge--basic',
  NDA:          'role-badge role-badge--admin',
  Other:        'role-badge role-badge--basic',
};

/** Human file size — "3.4 MB", "812 KB", "43 B". */
export function formatBytes(n) {
  if (n == null) return '';
  const bytes = Number(n);
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(gb < 10 ? 1 : 0)} GB`;
}

/** ISO → user-locale short date. */
export function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return String(iso).slice(0, 10); }
}
