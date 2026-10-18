// Shared helpers for Kettera service offerings (the 3 domains × 3
// engagement levels catalog). Labels only; the catalog itself comes
// from the API.

export const DOMAIN_SHORT = { EA: 'EA', APM: 'APM', INNOVATION: 'Innovation' };

/** "APM · Build & Transition" for anything with domainCode + levelName. */
export function serviceLabel(service) {
  if (!service) return '';
  const domain = DOMAIN_SHORT[service.domainCode] || service.domainName || service.domainCode;
  return `${domain} · ${service.levelName}`;
}
