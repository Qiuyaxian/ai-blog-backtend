import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

async function violations(payload: Record<string, unknown>) {
  // 对齐全局 ValidationPipe：transform + whitelist + forbidNonWhitelisted
  const dto = plainToInstance(LoginDto, payload);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('LoginDto', () => {
  it('accepts boundary-valid values and trims identifier', async () => {
    const dto = plainToInstance(LoginDto, {
      identifier: '  Alice  ',
      password: '12345678',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).toHaveLength(0);
    expect(dto.identifier).toBe('Alice');
  });

  it('accepts identifier length 2 and 254, password length 8 and 64', async () => {
    const errors = await violations({
      identifier: 'ab',
      password: 'a'.repeat(64),
    });
    expect(errors).toHaveLength(0);

    const errors2 = await violations({
      identifier: 'x'.repeat(254),
      password: 'a'.repeat(8),
    });
    expect(errors2).toHaveLength(0);
  });

  it.each([
    ['missing identifier', { password: '12345678' }],
    [
      'blank after trim identifier',
      { identifier: '   ', password: '12345678' },
    ],
    ['too short identifier', { identifier: 'a', password: '12345678' }],
    [
      'too long identifier',
      { identifier: 'x'.repeat(255), password: '12345678' },
    ],
    ['missing password', { identifier: 'alice' }],
    ['too short password', { identifier: 'alice', password: '1234567' }],
    ['too long password', { identifier: 'alice', password: 'a'.repeat(65) }],
  ])('rejects %s', async (_label, payload) => {
    const errors = await violations(payload as Record<string, unknown>);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects undeclared fields under forbidNonWhitelisted', async () => {
    const errors = await violations({
      identifier: 'alice',
      password: '12345678',
      isAdmin: true,
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
