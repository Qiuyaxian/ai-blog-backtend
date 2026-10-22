import { ConfigService } from '@nestjs/config';
import { SESSION_TTL_DEFAULT } from './auth.constants';
import { AUTH_TOKEN_TTL_KEY, getAuthTokenTtlSeconds } from './auth.config';

describe('auth.config', () => {
  const configOf = (value?: string): ConfigService =>
    ({ get: jest.fn().mockReturnValue(value) } as unknown as ConfigService);

  it('falls back to the 7-day default when AUTH_TOKEN_TTL_SECONDS is unset', () => {
    expect(getAuthTokenTtlSeconds(configOf(undefined))).toBe(
      SESSION_TTL_DEFAULT,
    );
    expect(AUTH_TOKEN_TTL_KEY).toBe('AUTH_TOKEN_TTL_SECONDS');
  });

  it('parses a positive integer string', () => {
    expect(getAuthTokenTtlSeconds(configOf('3600'))).toBe(3600);
  });

  it.each(['0', '-7', '1.5', 'abc'])(
    'throws fail-fast for invalid value %p',
    (value) => {
      expect(() => getAuthTokenTtlSeconds(configOf(value))).toThrow(
        AUTH_TOKEN_TTL_KEY,
      );
    },
  );

  it.each(['', '  '])('treats blank value %p as unset -> default', (value) => {
    expect(getAuthTokenTtlSeconds(configOf(value))).toBe(SESSION_TTL_DEFAULT);
  });
});
