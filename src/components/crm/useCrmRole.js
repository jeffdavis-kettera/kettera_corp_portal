// useCrmRole — one place to consult "what's my CRM role?" instead
// of hand-rolling `modules.find(m => m.code === 'CRM')` everywhere.
//
// Returns:
//   role      — 'Admin' | 'BasicUser' | null
//   isCrmAdmin — boolean
//   hasCrmAccess — boolean (true for either role)

import { usePortalUser } from '../../contexts/PortalUserContext.jsx';

export function useCrmRole() {
  const { modules } = usePortalUser();
  const assignment = (modules || []).find((m) => m.code === 'CRM');
  const role = assignment?.role ?? null;
  return {
    role,
    isCrmAdmin: role === 'Admin',
    hasCrmAccess: role != null,
  };
}
