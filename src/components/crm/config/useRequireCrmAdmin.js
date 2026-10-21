// Redirects non-admins away from a CRM configuration screen.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrmRole } from '../useCrmRole.js';

export function useRequireCrmAdmin(redirectTo = '/modules/crm') {
  const navigate = useNavigate();
  const { isCrmAdmin } = useCrmRole();
  useEffect(() => {
    if (!isCrmAdmin) navigate(redirectTo, { replace: true });
  }, [isCrmAdmin, navigate, redirectTo]);
  return isCrmAdmin;
}
