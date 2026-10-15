import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRedisClient } from './cache.module';

// mock ioredis：捕获工厂注册的 error handler，单测不连真实实例（仅 T015 E2E 连本地 Redis）。
// 每次构造返回全新 jest.fn（避免跨用例共享调用次数），其 resolve/reject 行为由下方 behavior 注入。
let connect: jest.Mock;
let ping: jest.Mock;
let disconnect: jest.Mock;
const behavior: { pingError: Error | null } = { pingError: null };
const handlers: Record<string, (err: Error) => void> = {};
const on = jest.fn((event: string, handler: (err: Error) => void) => {
  handlers[event] = handler;
});

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    const instance = {
      connect: jest.fn(async () => undefined),
      ping: jest.fn(async () => {
        if (behavior.pingError) {
          throw behavior.pingError;
        }
        return 'PONG';
      }),
      disconnect: jest.fn(),
      on,
    };
    connect = instance.connect;
    ping = instance.ping;
    disconnect = instance.disconnect;
    return instance;
  }),
}));

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('createRedisClient (startup fail-fast)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    behavior.pingError = null;
  });

  it('connects and pings before returning the client', async () => {
    const client = await createRedisClient(
      configWith({ REDIS_HOST: '127.0.0.1' }),
    );
    expect(connect).toHaveBeenCalledTimes(1);
    expect(ping).toHaveBeenCalledTimes(1);
    expect(client).toBeDefined();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('rejects when REDIS_HOST is missing without touching the socket', async () => {
    await expect(createRedisClient(configWith({}))).rejects.toThrow(
      'REDIS_HOST is required',
    );
    expect(connect).not.toHaveBeenCalled();
  });

  it('disconnects and rejects when startup ping fails', async () => {
    behavior.pingError = new Error('ECONNREFUSED');
    await expect(
      createRedisClient(configWith({ REDIS_HOST: '127.0.0.1' })),
    ).rejects.toThrow('ECONNREFUSED');
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('Redis 连接错误日志（FR-012 脱敏）', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    behavior.pingError = null;
    errorSpy = jest
      .spyOn(Logger, 'error')
      .mockImplementation(() => undefined as void);
  });

  afterEach(() => errorSpy.mockRestore());

  it('只含 host:port/db 与错误首行，不含配置的密码', async () => {
    const secret = 'super-secret-password';
    await createRedisClient(
      configWith({ REDIS_HOST: '127.0.0.1', REDIS_PASSWORD: secret }),
    );

    // ioredis 真实形态的鉴权错误（WRONGPASS 不回显密码）
    handlers.error(new Error('WRONGPASS invalid username-password pair'));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0][0]);
    expect(line).toContain('127.0.0.1:6379/0');
    expect(line).toContain('WRONGPASS');
    expect(line).not.toContain(secret);
  });

  it('多行错误只记录首行，剥离堆栈', async () => {
    await createRedisClient(configWith({ REDIS_HOST: '127.0.0.1' }));
    handlers.error(
      new Error('BOOM\n    at Foo (x.js:1:1)\nat Object (y.js:2:2)'),
    );
    const line = String(errorSpy.mock.calls[0][0]);
    expect(line).toContain('BOOM');
    expect(line).not.toContain('at Foo');
    expect(line).not.toContain('at Object');
  });
});
