import {
  HealthCheckService,
  MongooseHealthIndicator,
  TerminusModule,
} from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisHealthIndicator } from '../common/cache/redis.health';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let mongooseIndicator: { pingCheck: jest.Mock };
  let redisIndicator: { isHealthy: jest.Mock };

  beforeEach(async () => {
    health = { check: jest.fn() };
    mongooseIndicator = { pingCheck: jest.fn() };
    redisIndicator = { isHealthy: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [RedisHealthIndicator],
    })
      .overrideProvider(HealthCheckService)
      .useValue(health)
      .overrideProvider(MongooseHealthIndicator)
      .useValue(mongooseIndicator)
      .overrideProvider(RedisHealthIndicator)
      .useValue(redisIndicator)
      .compile();

    controller = module.get(HealthController);
  });

  it('liveness should report up without touching DB', async () => {
    expect(controller.live()).toEqual({ status: 'up' });
    expect(health.check).not.toHaveBeenCalled();
  });

  it('readiness should run ping and register the check function', async () => {
    health.check.mockImplementation((indicators) =>
      Promise.all(indicators.map((fn) => fn())),
    );
    mongooseIndicator.pingCheck.mockResolvedValue({
      mongodb: { status: 'up' },
    });
    redisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } });
    await controller.ready();
    expect(mongooseIndicator.pingCheck).toHaveBeenCalledWith('mongodb');
    expect(redisIndicator.isHealthy).toHaveBeenCalledWith('redis');
  });

  it('readiness should reuse cached result within 5s and ping only once', async () => {
    health.check.mockImplementation((indicators) =>
      Promise.all(indicators.map((fn) => fn())),
    );
    mongooseIndicator.pingCheck.mockResolvedValue({
      mongodb: { status: 'up' },
    });
    redisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } });
    await controller.ready();
    await controller.ready();
    expect(mongooseIndicator.pingCheck).toHaveBeenCalledTimes(1);
    expect(redisIndicator.isHealthy).toHaveBeenCalledTimes(1);
  });

  it('readiness should not cache failed pings', async () => {
    health.check.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(controller.ready()).rejects.toThrow('ECONNREFUSED');
    await expect(controller.ready()).rejects.toThrow('ECONNREFUSED');
    expect(health.check).toHaveBeenCalledTimes(2);
  });

  it('readiness should reject when redis indicator is down', async () => {
    health.check.mockImplementation((indicators) =>
      Promise.all(indicators.map((fn) => fn())),
    );
    mongooseIndicator.pingCheck.mockResolvedValue({
      mongodb: { status: 'up' },
    });
    redisIndicator.isHealthy.mockRejectedValue(new Error('redis down'));
    await expect(controller.ready()).rejects.toThrow('redis down');
  });
});
