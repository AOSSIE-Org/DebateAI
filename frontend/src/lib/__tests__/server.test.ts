import { describe, expect, it } from 'vitest';
import { getServer, isOfficial, normalize, serverLabel, setServer } from '../server';

const SERVER_KEY = 'debateai:server';

describe('server helpers', () => {
  describe('normalize', () => {
    it.each([
      ['https://api.example.com/some/path', 'https://api.example.com'],
      ['  https://api.example.com  ', 'https://api.example.com'],
      ['http://localhost:1313', 'http://localhost:1313'],
      ['http://127.0.0.1:1313/', 'http://127.0.0.1:1313'],
    ])('accepts %s', (raw, expected) => {
      expect(normalize(raw)).toBe(expected);
    });

    it.each([['http://api.example.com'], ['not a url'], [''], [null], [undefined]])(
      'rejects %s',
      (raw) => {
        expect(normalize(raw)).toBeNull();
      }
    );
  });

  it('treats no stored value as the official server', () => {
    expect(isOfficial()).toBe(true);
    expect(serverLabel()).toBe('Official');
  });

  it('uses a stored custom server without falling back', () => {
    localStorage.setItem(SERVER_KEY, 'https://custom.example.com');
    expect(isOfficial()).toBe(false);
    expect(getServer()).toBe('https://custom.example.com');
    expect(serverLabel()).toBe('custom.example.com');
  });

  it('returns null for an invalid stored server', () => {
    localStorage.setItem(SERVER_KEY, 'ftp://bad.example.com');
    expect(getServer()).toBeNull();
    expect(serverLabel()).toBe('Invalid server URL');
  });

  it('clears auth tokens when switching to a different server', () => {
    localStorage.setItem('token', 'abc');
    localStorage.setItem('userProfile', '{}');
    setServer('https://other.example.com');
    expect(localStorage.getItem(SERVER_KEY)).toBe('https://other.example.com');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userProfile')).toBeNull();
  });

  it('keeps auth tokens when the server does not change', () => {
    localStorage.setItem(SERVER_KEY, 'https://same.example.com');
    localStorage.setItem('token', 'abc');
    setServer('https://same.example.com');
    expect(localStorage.getItem('token')).toBe('abc');
  });
});
