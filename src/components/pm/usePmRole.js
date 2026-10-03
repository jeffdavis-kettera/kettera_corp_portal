// usePmRole — "what's my Project Management role?"
//
// Returns:
//   role        — 'Admin' | 'BasicUser' | null
//   isPmAdmin   — boolean
//   hasPmAccess — boolean (true for either role)

import { useModuleRole } from '../modules/useModuleRole.js';

export function usePmRole() {
  const { role, isModuleAdmin, hasModuleAccess } = useModuleRole('ProjectManagement');
  return {
    role,
    isPmAdmin: isModuleAdmin,
    hasPmAccess: hasModuleAccess,
  };
}
