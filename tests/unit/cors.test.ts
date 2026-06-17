import { getAllowedOrigins, resolveCorsOrigin } from '../../src/config/cors';

describe('cors config', () => {
  it('defaults to wildcard when no origins are configured', () => {
    expect(getAllowedOrigins(undefined)).toEqual(['*']);
    expect(getAllowedOrigins('')).toEqual(['*']);
  });

  it('parses comma-separated origins', () => {
    expect(
      getAllowedOrigins('https://main.example.amplifyapp.com,http://localhost:5173')
    ).toEqual(['https://main.example.amplifyapp.com', 'http://localhost:5173']);
  });

  it('reflects allowed request origins', () => {
    const allowed = getAllowedOrigins('https://main.example.amplifyapp.com');

    expect(resolveCorsOrigin('https://main.example.amplifyapp.com', allowed)).toBe(
      'https://main.example.amplifyapp.com'
    );
    expect(resolveCorsOrigin('https://evil.example', allowed)).toBe('null');
  });

  it('uses wildcard for unrestricted environments', () => {
    expect(resolveCorsOrigin('http://localhost:3000', ['*'])).toBe('*');
  });
});
