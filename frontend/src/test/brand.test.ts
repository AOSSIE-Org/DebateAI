import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = join(SRC_ROOT, '..', 'package.json');

/** The pre-rename product name. It must never appear in shipped source. */
const LEGACY_BRAND = /arguehub/i;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      collectSourceFiles(full, acc);
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('brand consistency', () => {
  it('has no source file that still uses the legacy "ArgueHub" product name', () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles(SRC_ROOT)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (LEGACY_BRAND.test(line)) {
            offenders.push(`${relative(SRC_ROOT, file)}:${index + 1}`);
          }
        });
    }

    expect(offenders).toEqual([]);
  });

  it('names the frontend package after the product', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
    expect(pkg.name).toBe('debateai');
  });
});
