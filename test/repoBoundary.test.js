// The independence rule, made executable — mirror of kettera_corp_api's.
//
// Corp Portal repos are not allowed to share code, dependencies, or
// workspace linkages with Navigator. This test asserts:
//   1. package.json has no dependency whose name matches a Navigator
//      repo pattern, and no `file:` / `link:` local reference.
//   2. Source files don't import from a Navigator repo path.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;

const FORBIDDEN_NAME_PATTERNS = [
  /^kettera_architect/i,
  /^kettera_admin/i,
  /^kettera_data/i,
  /^@kettera-navigator/i,
];

const FORBIDDEN_IMPORT_SUBSTRINGS = [
  'kettera_architect',
  'kettera_admin',
  'kettera_data',
];

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(js|mjs|cjs|jsx|ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('repo boundary — independence from Navigator', () => {
  it('package.json declares no Navigator-shaped dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {}),
      ...(pkg.optionalDependencies || {}),
    };

    for (const [name, spec] of Object.entries(allDeps)) {
      for (const pat of FORBIDDEN_NAME_PATTERNS) {
        expect(
          pat.test(name),
          `Dependency "${name}" matches forbidden pattern ${pat}. Corp Portal is independent from Navigator.`
        ).toBe(false);
      }
      expect(
        String(spec).startsWith('file:'),
        `Dependency "${name}" uses a local file spec "${spec}". No cross-repo linkages allowed.`
      ).toBe(false);
      expect(
        String(spec).startsWith('link:'),
        `Dependency "${name}" uses a workspace link "${spec}". No cross-repo linkages allowed.`
      ).toBe(false);
    }
  });

  it('no source file imports from a Navigator repo path', () => {
    const files = walk(REPO_ROOT);
    const offenders = [];

    for (const file of files) {
      // Skip this test itself — it contains the patterns as strings.
      if (file.endsWith('repoBoundary.test.js')) continue;

      const src = readFileSync(file, 'utf8');
      const importRe = /(?:import\s.+from\s+|require\s*\(|import\s*\()\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = importRe.exec(src))) {
        const spec = m[1];
        for (const bad of FORBIDDEN_IMPORT_SUBSTRINGS) {
          if (spec.includes(bad)) {
            offenders.push({ file: file.replace(REPO_ROOT, ''), spec });
          }
        }
      }
    }

    expect(
      offenders,
      `Forbidden Navigator imports found:\n` +
      offenders.map((o) => `  ${o.file} → "${o.spec}"`).join('\n')
    ).toEqual([]);
  });
});
