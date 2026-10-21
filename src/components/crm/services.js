// Shared helpers for Kettera service offerings (the 3 domains × 3
// engagement levels catalog). Labels only; the catalog itself comes
// from the API.

export const DOMAINS = [
  { code: 'EA',         name: 'Enterprise Architecture',          short: 'EA' },
  { code: 'APM',        name: 'Application Portfolio Management', short: 'APM' },
  { code: 'INNOVATION', name: 'Innovation Management',            short: 'Innovation' },
];

export const DOMAIN_SHORT = Object.fromEntries(DOMAINS.map((d) => [d.code, d.short]));

/** "APM · Build & Transition" for anything with domainCode + levelName. */
export function serviceLabel(service) {
  if (!service) return '';
  const domain = DOMAIN_SHORT[service.domainCode] || service.domainName || service.domainCode;
  return `${domain} · ${service.levelName}`;
}
