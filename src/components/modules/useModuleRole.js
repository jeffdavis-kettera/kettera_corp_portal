// useModuleRole — "what's my role in module X?" without hand-rolling
// `modules.find(m => m.code === X)` everywhere. Module-specific hooks
// (useCrmRole, usePmRole) wrap this with their own field names.
//
// Returns:
//   role            — 'Admin' | 'BasicUser' | null
//   isModuleAdmin   — boolean
//   hasModuleAccess — boolean (true for either role)

import { usePortalUser } from '../../contexts/PortalUserContext.jsx';

export function useModuleRole(code) {
  const { modules } = usePortalUser();
  const assignment = (modules || []).find((m) => m.code === code);
  const role = assignment?.role ?? null;
  return {
    role,
    isModuleAdmin: role === 'Admin',
    hasModuleAccess: role != null,
  };
}
