// Per-module settings for the shared module-admin screens
// (ModuleUsers, AddModuleUser, ModuleCompanyAccess). Every module that
// offers user management + company access gets one entry; the screens
// derive their routes, API calls, and copy from it, so CRM and
// Project Management stay identical apart from what's listed here.
//
// API counterparts: createModuleUsersRouter(code) behind usersApi, and
// each module's own /config/company-access router behind
// companyAccessApi.

export const CRM_MODULE = {
  code: 'CRM',
  label: 'CRM',
  homePath: '/modules/crm',
  configPath: '/modules/crm/config',
  usersPath: '/modules/crm/users',
  usersApi: '/modules/crm/users',
  // CRM's company list caps a page at 200; there's no admin-scale
  // pagination UX on the access screen yet. If Kettera ends up with
  // thousands of companies we swap this for a search-picker.
  companiesApi: '/crm/companies?limit=200&offset=0',
  companyAccessApi: '/crm/config/company-access',
  roleHelp: {
    BasicUser: 'Basic User — needs company access granted separately in Configuration',
    Admin: 'Admin — sees every company automatically, can manage CRM users',
  },
  companyAccessIntro:
    'Choose which CRM Basic Users can see and interact with a specific company. '
    + 'CRM Admins always see every company; only Basic Users appear in the list below.',
};

export const PM_MODULE = {
  code: 'ProjectManagement',
  label: 'Project Management',
  homePath: '/modules/project-management',
  configPath: '/modules/project-management/config',
  usersPath: '/modules/project-management/users',
  usersApi: '/modules/project-management/users',
  companiesApi: '/pm/companies',
  companyAccessApi: '/pm/config/company-access',
  roleHelp: {
    BasicUser: 'Basic User — sees projects only for companies granted in Configuration',
    Admin: 'Admin — sees and manages every project, can manage Project Management users',
  },
  companyAccessIntro:
    "Choose which Project Management Basic Users can see a specific company's projects. "
    + "Project Management Admins always see every company's projects; only Basic Users "
    + 'appear in the list below.',
};
