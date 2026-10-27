import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The Community page and its comment tree are rendered on every theme the app
 * offers (light, dark and high contrast), so every colour they use has to come
 * from the theme tokens instead of a fixed light palette.
 */
const COMMUNITY_SURFACE = [
  join(SRC_ROOT, 'components', 'CommentTree.tsx'),
  join(SRC_ROOT, 'Pages', 'CommunityFeed.tsx'),
];

/** Utilities that pin a colour to a fixed palette instead of a theme token. */
const FIXED_COLOUR =
  /^(bg|text|border|ring|fill|stroke|divide|placeholder)-(white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?$/;

/** Colour literals that bypass the theme tokens entirely. */
const FIXED_LITERAL = /#[0-9a-fA-F]{3,8}\b/;

function classNames(source: string): string[] {
  const names: string[] = [];
  const attribute = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;

  let match: RegExpExecArray | null;
  while ((match = attribute.exec(source)) !== null) {
    const raw = match[1] ?? match[2] ?? '';
    for (const name of raw.split(/[\s"'`${}]+/)) {
      if (name) names.push(name);
    }
  }

  return names;
}

function utilityOf(name: string): string {
  const parts = name.split(':');
  return parts[parts.length - 1];
}

function colourFamily(utility: string): string {
  return utility.replace(/\/\d+$/, '').replace(/-\d{2,3}$/, '');
}

describe('community theme', () => {
  it('has no colour that is pinned to a fixed palette', () => {
    const offenders: string[] = [];

    for (const file of COMMUNITY_SURFACE) {
      const source = readFileSync(file, 'utf8');

      source.split('\n').forEach((line, index) => {
        if (FIXED_LITERAL.test(line)) {
          offenders.push(`${relative(SRC_ROOT, file)}:${index + 1}`);
        }
      });

      const names = classNames(source);
      const themed = new Set(
        names
          .filter((name) => name.split(':').includes('dark'))
          .map((name) => colourFamily(utilityOf(name)))
      );

      for (const name of names) {
        const variants = name.split(':');
        const utility = variants[variants.length - 1];

        if (variants.length > 1 || !FIXED_COLOUR.test(utility)) continue;
        if (themed.has(colourFamily(utility))) continue;

        offenders.push(`${relative(SRC_ROOT, file)}: ${name}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
