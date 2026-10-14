import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

async function violations(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateUserDto, payload);
  return validate(dto, { whitelist: true });
}

describe('UpdateUserDto', () => {
  it('accepts an empty body (all fields optional)', async () => {
    expect(await violations({})).toHaveLength(0);
  });

  it('accepts a valid email', async () => {
    expect(await violations({ email: 'new@example.com' })).toHaveLength(0);
  });

  it('rejects a malformed email', async () => {
    expect(
      await violations({ email: 'nope' }).then((e) => e.length),
    ).toBeGreaterThan(0);
  });

  it('strips isAdmin via whitelist (users cannot self-elevate)', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      email: 'new@example.com',
      isAdmin: true,
    });
    expect(await validate(dto, { whitelist: true })).toHaveLength(0);
    expect(dto).not.toHaveProperty('isAdmin');
  });
});
