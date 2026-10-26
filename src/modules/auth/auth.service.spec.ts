import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { CacheService } from '../../common/cache/cache.service';
import * as securityLog from '../../common/logger/security-log';
import { UserService } from '../user/user.service';
import {
  AUTH_FAIL_PREFIX,
  AUTH_LOCK_PREFIX,
  AUTH_SESSION_PREFIX,
  FAIL_THRESHOLD,
  LOCK_TTL_SECONDS,
} from './auth.constants';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomBytes: jest.fn(),
  };
});

const TTL = 604800;
const userId = '65ab00000000000000000001';
const userView = {
  id: userId,
  username: 'Alice',
  email: 'alice@example.com',
  isAdmin: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};
const credential = { id: userId, passwordHash: 'hash', user: userView };

function setup(overrides: {
  credential?: Awaited<ReturnType<UserService['findLoginCredential']>>;
  compare?: boolean;
  cacheSetImpl?: () => Promise<void>;
  ttlString?: string;
}) {
  const findLoginCredential = jest
    .fn()
    .mockResolvedValue(
      overrides.credential === undefined ? credential : overrides.credential,
    );
  // @ts-expect-error 注入最小 UserService 桩
  const userService: UserService = { findLoginCredential };
  const cache = {
    set: jest
      .fn()
      .mockImplementation(overrides.cacheSetImpl ?? (async () => undefined)),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(undefined),
    incrWithTtl: jest.fn(),
  };
  const config = {
    get: jest
      .fn()
      .mockImplementation((key: string) =>
        key === 'AUTH_TOKEN_TTL_SECONDS'
          ? overrides.ttlString ?? String(TTL)
          : undefined,
      ),
  };
  // @ts-expect-error 注入最小 CacheService/ConfigService 桩
  const service = new AuthService(cache as CacheService, userService, config);
  (bcrypt.compare as jest.Mock).mockResolvedValue(overrides.compare ?? true);
  return { service, cache, userService, config, findLoginCredential };
}

beforeEach(() => {
  jest.clearAllMocks();
  (randomBytes as jest.Mock).mockReturnValue(Buffer.alloc(32, 0xab));
});

describe('AuthService.login', () => {
  it('issues an opaque token on username login: 64 hex, session in Redis with TTL, sanitized user, fail counter cleared', async () => {
    const { service, cache, findLoginCredential } = setup({});
    const result = await service.login({
      identifier: ' Alice ',
      password: 'secret123',
    });

    const token = Buffer.alloc(32, 0xab).toString('hex');
    expect(result.token).toBe(token);
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.user).toEqual(userView);
    expect(result.user).not.toHaveProperty('password');

    expect(findLoginCredential).toHaveBeenCalledWith('alice');

    const expectedKey =
      AUTH_SESSION_PREFIX + createHash('sha256').update(token).digest('hex');
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(expectedKey, { sub: userId }, TTL);
    expect(cache.del).toHaveBeenCalledWith(AUTH_FAIL_PREFIX + userId);

    const expiresAt = new Date(result.expiresAt).getTime();
    const drift = expiresAt - Date.now();
    expect(drift).toBeGreaterThan(TTL * 1000 - 5000);
    expect(drift).toBeLessThanOrEqual(TTL * 1000);
  });

  it('normalizes email login with surrounding spaces and uppercase', async () => {
    const { service, findLoginCredential } = setup({});
    await service.login({
      identifier: '  ALICE@EXAMPLE.COM  ',
      password: 'secret123',
    });
    expect(findLoginCredential).toHaveBeenCalledWith('alice@example.com');
  });

  it('reads TTL from ConfigService (3600 override)', async () => {
    const { service, cache } = setup({ ttlString: '3600' });
    await service.login({ identifier: 'alice', password: 'secret123' });
    expect(cache.set.mock.calls[0][2]).toBe(3600);
  });

  it('throws 401 INVALID_CREDENTIALS on wrong password, with no session written', async () => {
    const { service, cache } = setup({ compare: false });
    await expect(
      service.login({ identifier: 'alice', password: 'secret123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({ identifier: 'alice', password: 'secret123' }),
    ).rejects.toMatchObject({ status: 401, message: 'INVALID_CREDENTIALS' });
    expect(cache.set).not.toHaveBeenCalled();
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('throws 401 for unknown identifier after one dummy bcrypt.compare, touching no Redis keys', async () => {
    const { service, cache, findLoginCredential } = setup({ credential: null });
    await expect(
      service.login({ identifier: 'ghost', password: 'secret123' }),
    ).rejects.toMatchObject({ status: 401, message: 'INVALID_CREDENTIALS' });
    expect(findLoginCredential).toHaveBeenCalledWith('ghost');
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    expect(cache.set).not.toHaveBeenCalled();
    expect(cache.del).not.toHaveBeenCalled();
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('throws 401 for a soft-deleted account (lookup null) identical to unknown', async () => {
    const { service } = setup({ credential: null });
    await expect(
      service.login({ identifier: 'alice', password: 'secret123' }),
    ).rejects.toMatchObject({ status: 401, message: 'INVALID_CREDENTIALS' });
  });

  it('fails closed: session write error propagates and no token is returned', async () => {
    const { service } = setup({
      cacheSetImpl: async () => {
        throw new Error('redis down');
      },
    });
    await expect(
      service.login({ identifier: 'alice', password: 'secret123' }),
    ).rejects.toThrow('redis down');
  });

  it('propagates bcrypt/mongo errors without swallowing', async () => {
    const { service } = setup({});
    (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('bcrypt boom'));
    await expect(
      service.login({ identifier: 'alice', password: 'secret123' }),
    ).rejects.toThrow('bcrypt boom');
  });
});

describe('AuthService.login lockout (US4)', () => {
  function setupLock(overrides: {
    locked?: boolean;
    compare?: boolean;
    incrResult?: number;
    getImpl?: (key: string) => Promise<unknown>;
  }) {
    const findLoginCredential = jest.fn().mockResolvedValue(credential);
    const set = jest.fn().mockResolvedValue(undefined);
    const get = jest
      .fn()
      .mockImplementation(
        overrides.getImpl ??
          (async (key: string) =>
            key === AUTH_LOCK_PREFIX + userId && overrides.locked ? '1' : null),
      );
    const del = jest.fn().mockResolvedValue(undefined);
    const incrWithTtl = jest.fn().mockResolvedValue(overrides.incrResult ?? 1);
    const cache = { set, get, del, incrWithTtl };
    // @ts-expect-error 注入最小 UserService 桩
    const userService: UserService = { findLoginCredential };
    const config = {
      get: jest
        .fn()
        .mockImplementation((key: string) =>
          key === 'AUTH_TOKEN_TTL_SECONDS' ? String(TTL) : undefined,
        ),
    };
    // @ts-expect-error 注入最小桩
    const service = new AuthService(cache as CacheService, userService, config);
    (bcrypt.compare as jest.Mock).mockResolvedValue(overrides.compare ?? false);
    return { service, cache, findLoginCredential, set, get, del, incrWithTtl };
  }

  const dto = { identifier: 'alice', password: 'wrongpass1' };

  it('increments the sliding fail counter on wrong password (counts 1..4 do not lock)', async () => {
    const { service, incrWithTtl, set } = setupLock({ incrResult: 3 });
    await expect(service.login(dto)).rejects.toMatchObject({
      status: 401,
      message: 'INVALID_CREDENTIALS',
    });
    expect(incrWithTtl).toHaveBeenCalledWith(
      AUTH_FAIL_PREFIX + userId,
      LOCK_TTL_SECONDS,
    );
    // 未到阈值，不置锁、不写会话
    expect(set).not.toHaveBeenCalled();
  });

  it('sets the lock key when the counter reaches FAIL_THRESHOLD (4 -> 5)', async () => {
    const { service, incrWithTtl, set } = setupLock({
      incrResult: FAIL_THRESHOLD,
    });
    await expect(service.login(dto)).rejects.toMatchObject({
      message: 'INVALID_CREDENTIALS',
    });
    expect(incrWithTtl).toHaveBeenCalledWith(
      AUTH_FAIL_PREFIX + userId,
      LOCK_TTL_SECONDS,
    );
    expect(set).toHaveBeenCalledWith(
      AUTH_LOCK_PREFIX + userId,
      '1',
      LOCK_TTL_SECONDS,
    );
  });

  it('locked account: rejects even the correct password after one bcrypt, writes no fail/lock keys', async () => {
    const logSpy = jest.spyOn(securityLog, 'logLoginLockHit');
    const { service, incrWithTtl, set, del } = setupLock({
      locked: true,
      compare: true,
    });
    await expect(
      service.login({ identifier: 'alice', password: 'correct-pass1' }),
    ).rejects.toMatchObject({
      status: 401,
      message: 'INVALID_CREDENTIALS',
    });
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    expect(incrWithTtl).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    // 锁定期不置锁（不延长）：仅登录成功路径与第 5 次失败会 set，锁内 set 零调用
    expect(set).not.toHaveBeenCalled();
    // 服务端记录真实原因码，日志参数不含密码/令牌
    expect(logSpy).toHaveBeenCalledWith(userId);
    const serialized = JSON.stringify(logSpy.mock.calls);
    expect(serialized).not.toContain('correct-pass1');
    logSpy.mockRestore();
  });

  it('successful login deletes the fail counter key', async () => {
    const { service, del } = setupLock({ compare: true });
    await service.login({ identifier: 'alice', password: 'correct-pass1' });
    expect(del).toHaveBeenCalledWith(AUTH_FAIL_PREFIX + userId);
  });
});

describe('AuthService.resolveSession', () => {
  function setup(session: unknown, getReject?: Error) {
    const get = getReject
      ? jest.fn().mockRejectedValue(getReject)
      : jest.fn().mockResolvedValue(session);
    const cache = {
      set: jest.fn(),
      get,
      del: jest.fn(),
    };
    // @ts-expect-error 注入最小桩
    const service = new AuthService(cache as CacheService, {}, {});
    return { service, cache, get };
  }

  it('looks up auth:sess:<sha256(rawToken)> and returns the payload on hit', async () => {
    const rawToken = 'a'.repeat(64);
    const payload = { sub: '65ab00000000000000000001' };
    const { service, get } = setup(payload);

    await expect(service.resolveSession(rawToken)).resolves.toEqual(payload);
    expect(get).toHaveBeenCalledWith(
      AUTH_SESSION_PREFIX + createHash('sha256').update(rawToken).digest('hex'),
    );
  });

  it('returns null on miss (expired/forged/revoked)', async () => {
    const { service } = setup(null);
    await expect(service.resolveSession('b'.repeat(64))).resolves.toBeNull();
  });

  it('propagates Redis errors so the Guard fails closed', async () => {
    const { service } = setup(undefined, new Error('redis down'));
    await expect(service.resolveSession('c'.repeat(64))).rejects.toThrow(
      'redis down',
    );
  });
});

describe('AuthService.logout', () => {
  function setup(delImpl?: () => Promise<void>) {
    const del = jest
      .fn()
      .mockImplementation(delImpl ?? (async () => undefined));
    const cache = { set: jest.fn(), get: jest.fn(), del };
    // @ts-expect-error 注入最小桩
    const service = new AuthService(cache as CacheService, {}, {});
    return { service, cache, del };
  }

  it('deletes only auth:sess:<sha256(rawToken)> (idempotent)', async () => {
    const rawToken = 'a'.repeat(64);
    const { service, del } = setup();

    await expect(service.logout(rawToken)).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(
      AUTH_SESSION_PREFIX + createHash('sha256').update(rawToken).digest('hex'),
    );
  });

  it('does not touch any other key when a different token is revoked', async () => {
    const { service, del } = setup();
    await service.logout('token-a');
    expect(del).not.toHaveBeenCalledWith(
      AUTH_SESSION_PREFIX +
        createHash('sha256').update('token-b').digest('hex'),
    );
  });
});
