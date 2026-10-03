// useCrmRole — one place to consult "what's my CRM role?" instead
// of hand-rolling `modules.find(m => m.code === 'CRM')` everywhere.
//
// Returns:
//   role      — 'Admin' | 'BasicUser' | null
//   isCrmAdmin — boolean
//   hasCrmAccess — boolean (true for either role)

import { useModuleRole } from '../modules/useModuleRole.js';

export function useCrmRole() {
  const { role, isModuleAdmin, hasModuleAccess } = useModuleRole('CRM');
  return {
    role,
    isCrmAdmin: isModuleAdmin,
    hasCrmAccess: hasModuleAccess,
  };
}
