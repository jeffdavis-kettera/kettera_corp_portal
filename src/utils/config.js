// Runtime configuration read at build time.
//
// VITE_API_BASE_URL — the URL of kettera_corp_api. Bakes into the
// bundle; changing it requires a rebuild. In local dev:
//   http://localhost:3100
// In Azure: the App Service URL of the API, e.g.
//   https://kettera-corp-api-<...>.azurewebsites.net

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100';
