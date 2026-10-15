import { HealthCheckError } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';
import { REDIS_CLIENT } from './cache.constants';
import { RedisHealthIndicator } from './redis.health';

describe('RedisHealthIndicator', () => {
  let ping: jest.Mock;
  let indicator: RedisHealthIndicator;

  beforeEach(async () => {
    ping = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        { provide: REDIS_CLIENT, useValue: { ping } },
      ],
    }).compile();
    indicator = moduleRef.get(RedisHealthIndicator);
  });

  it('reports up when ping resolves', async () => {
    ping.mockResolvedValue('PONG');
    await expect(indicator.isHealthy('redis')).resolves.toEqual({
      redis: { status: 'up' },
    });
  });

  it('throws HealthCheckError when ping rejects', async () => {
    ping.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });
});
