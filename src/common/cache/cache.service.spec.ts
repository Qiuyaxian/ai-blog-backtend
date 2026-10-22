import { Test } from '@nestjs/testing';
import { REDIS_CLIENT } from './cache.constants';
import { CacheService } from './cache.service';

/** ioredis 客户端最小桩 */
interface MockMulti {
  incr: jest.Mock;
  expire: jest.Mock;
  exec: jest.Mock;
}

interface MockRedis {
  set: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
  multi: jest.Mock;
}

describe('CacheService', () => {
  let redis: MockRedis;
  let service: CacheService;

  beforeEach(async () => {
    const multi: MockMulti = {
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 0]]),
    };
    redis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      multi: jest.fn().mockReturnValue(multi),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [CacheService, { provide: REDIS_CLIENT, useValue: redis }],
    }).compile();
    service = moduleRef.get(CacheService);
  });
  describe('set', () => {
    it.each(['', '   '])(
      'rejects blank key %p with TypeError without touching client',
      async (key) => {
        await expect(service.set(key, 'v', 10)).rejects.toBeInstanceOf(
          TypeError,
        );
        expect(redis.set).not.toHaveBeenCalled();
      },
    );

    it('writes JSON with mandatory EX ttl in seconds', async () => {
      redis.set.mockResolvedValue('OK');
      await service.set('user:1', { hello: 'world' }, 30);
      expect(redis.set).toHaveBeenCalledWith(
        'user:1',
        JSON.stringify({ hello: 'world' }),
        'EX',
        30,
      );
    });

    it.each([0, -1, 1.5, NaN])(
      'rejects invalid ttl %p with RangeError',
      async (ttl) => {
        await expect(service.set('k', 'v', ttl)).rejects.toBeInstanceOf(
          RangeError,
        );
        expect(redis.set).not.toHaveBeenCalled();
      },
    );

    it('rejects when underlying client rejects (no silent success)', async () => {
      redis.set.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.set('k', 'v', 10)).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('get', () => {
    it('rejects blank key with TypeError without touching client', async () => {
      await expect(service.get('')).rejects.toBeInstanceOf(TypeError);
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('returns parsed value on hit', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ a: 1 }));
      await expect(service.get<{ a: number }>('k')).resolves.toEqual({ a: 1 });
    });

    it('returns null on miss (expired or absent)', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.get('k')).resolves.toBeNull();
    });

    it('throws on dirty non-JSON value instead of returning null', async () => {
      redis.get.mockResolvedValue('not-json{');
      await expect(service.get('k')).rejects.toThrow(SyntaxError);
    });

    it('rejects when client rejects', async () => {
      redis.get.mockRejectedValue(new Error('offline'));
      await expect(service.get('k')).rejects.toThrow('offline');
    });
  });

  describe('del', () => {
    it('rejects blank key with TypeError without touching client', async () => {
      await expect(service.del('')).rejects.toBeInstanceOf(TypeError);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('is idempotent for missing key', async () => {
      redis.del.mockResolvedValue(0);
      await expect(service.del('k')).resolves.toBeUndefined();
      expect(redis.del).toHaveBeenCalledWith('k');
    });

    it('rejects when client rejects', async () => {
      redis.del.mockRejectedValue(new Error('offline'));
      await expect(service.del('k')).rejects.toThrow('offline');
    });
  });

  describe('incrWithTtl', () => {
    it('atomically incr + expire via one multi pipeline', async () => {
      await service.incrWithTtl('auth:fail:u1', 900);
      expect(redis.multi).toHaveBeenCalledTimes(1);
      const multi = redis.multi.mock.results[0].value as MockMulti;
      expect(multi.incr).toHaveBeenCalledWith('auth:fail:u1');
      expect(multi.expire).toHaveBeenCalledWith('auth:fail:u1', 900);
      expect(multi.exec).toHaveBeenCalledTimes(1);
    });

    it('resolves to the incremented counter from the INCR reply', async () => {
      const multi = redis.multi() as MockMulti;
      multi.exec.mockResolvedValue([[null, 3]]);
      await expect(service.incrWithTtl('auth:fail:u1', 900)).resolves.toBe(3);
    });

    it.each(['', '   '])(
      'rejects blank key %p with TypeError without touching client',
      async (key) => {
        await expect(service.incrWithTtl(key, 900)).rejects.toBeInstanceOf(
          TypeError,
        );
        expect(redis.multi).not.toHaveBeenCalled();
      },
    );

    it.each([0, -1, 1.5, NaN])(
      'rejects invalid ttl %p with RangeError',
      async (ttl) => {
        await expect(
          service.incrWithTtl('auth:fail:u1', ttl),
        ).rejects.toBeInstanceOf(RangeError);
        expect(redis.multi).not.toHaveBeenCalled();
      },
    );

    it('rejects when the pipeline rejects (no silent swallow)', async () => {
      const multi = redis.multi() as MockMulti;
      multi.exec.mockRejectedValue(new Error('offline'));
      await expect(service.incrWithTtl('k', 900)).rejects.toThrow('offline');
    });
  });

  describe('key isolation', () => {
    it('passes business namespaces through untouched so different prefixes do not collide', async () => {
      redis.set.mockResolvedValue('OK');
      await service.set('user:1', 'a', 10);
      await service.set('session:abc', 'b', 10);
      expect(redis.set).toHaveBeenNthCalledWith(
        1,
        'user:1',
        JSON.stringify('a'),
        'EX',
        10,
      );
      expect(redis.set).toHaveBeenNthCalledWith(
        2,
        'session:abc',
        JSON.stringify('b'),
        'EX',
        10,
      );
    });
  });

  describe('encapsulation', () => {
    it('CacheModule does not export the raw REDIS_CLIENT token', async () => {
      // 防止业务绕过封装直连客户端（FR-002，宪法 II/IV）：以模块元数据断言 exports
      const metadata = Reflect.getMetadata(
        'exports',
        (await import('./cache.module')).CacheModule,
      );
      const exportedProviders = (metadata ?? []).map((p: unknown) =>
        p && typeof p === 'object' ? (p as { provide?: unknown }).provide : p,
      );
      expect(exportedProviders).not.toContain(REDIS_CLIENT);
      expect(exportedProviders).toContain(CacheService);
    });
  });
});
