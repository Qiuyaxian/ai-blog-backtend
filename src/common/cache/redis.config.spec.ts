import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';
import { buildRedisOptions } from './redis.config';

/** 最小 ConfigService 桩：按 key 取值，缺省回退 fallback */
function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in values && values[key] !== undefined ? values[key] : fallback,
    ),
  } as unknown as ConfigService;
}

describe('buildRedisOptions', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('maps env values to connection options', () => {
    const opts = buildRedisOptions(
      configWith({
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: '6379',
        REDIS_PASSWORD: 'secret',
        REDIS_DB: '2',
        REDIS_KEY_PREFIX: 'uat:',
      }),
    ) as RedisOptions & { keyPrefix?: string };

    expect(opts.host).toBe('127.0.0.1');
    expect(opts.port).toBe(6379);
    expect(opts.password).toBe('secret');
    expect(opts.db).toBe(2);
    expect(opts.keyPrefix).toBe('uat:');
  });

  it('omits password when empty (local no-auth)', () => {
    const opts = buildRedisOptions(
      configWith({ REDIS_HOST: '127.0.0.1', REDIS_PASSWORD: '' }),
    );
    expect(opts.password).toBeUndefined();
  });

  it('throws when REDIS_HOST missing (no silent default address)', () => {
    expect(() =>
      buildRedisOptions(configWith({ REDIS_HOST: undefined })),
    ).toThrow(/REDIS_HOST/);
  });

  it('falls back keyPrefix to NODE_ENV when REDIS_KEY_PREFIX absent', () => {
    process.env.NODE_ENV = 'prod';
    const opts = buildRedisOptions(
      configWith({ REDIS_HOST: 'h' }),
    ) as RedisOptions & {
      keyPrefix?: string;
    };
    expect(opts.keyPrefix).toBe('prod:');
  });

  it('falls back keyPrefix to local: when neither prefix nor NODE_ENV set', () => {
    delete process.env.NODE_ENV;
    const opts = buildRedisOptions(
      configWith({ REDIS_HOST: 'h' }),
    ) as RedisOptions & {
      keyPrefix?: string;
    };
    expect(opts.keyPrefix).toBe('local:');
  });

  it('sets fail-fast / offline / timeout / reconnect options', () => {
    const opts = buildRedisOptions(configWith({ REDIS_HOST: 'h' }));
    expect(opts.lazyConnect).toBe(true);
    expect(opts.enableOfflineQueue).toBe(false);
    expect(opts.maxRetriesPerRequest).toBe(3);
    expect(opts.connectTimeout).toBeGreaterThan(0);
    expect(opts.commandTimeout).toBeGreaterThan(0);
    expect(typeof opts.retryStrategy).toBe('function');
  });
});
