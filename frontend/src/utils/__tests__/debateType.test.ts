import { describe, expect, it } from 'vitest';
import { formatDebateType } from '../debateType';

describe('formatDebateType', () => {
  it.each([
    ['user_vs_bot', 'User vs Bot'],
    ['user_vs_user', 'User vs User'],
  ])('formats %s as "%s"', (type, label) => {
    expect(formatDebateType(type)).toBe(label);
  });

  it('replaces every underscore for unknown types', () => {
    expect(formatDebateType('team_vs_team_v2')).toBe('team vs team v2');
  });
});
