import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

async function violations(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateUserDto, payload);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('CreateUserDto', () => {
  it('accepts a valid payload', async () => {
    const errors = await violations({
      username: 'Alice',
      email: 'alice@example.com',
      password: 'abc12345',
    });
    expect(errors).toHaveLength(0);
  });

  it.each([
    [
      'too short username',
      { username: 'a', email: 'a@b.com', password: 'abc12345' },
    ],
    [
      'too long username',
      { username: 'x'.repeat(33), email: 'a@b.com', password: 'abc12345' },
    ],
    ['bad email', { username: 'alice', email: 'nope', password: 'abc12345' }],
    [
      'short password',
      { username: 'alice', email: 'a@b.com', password: 'ab1' },
    ],
    [
      'password without digit',
      { username: 'alice', email: 'a@b.com', password: 'abcdefgh' },
    ],
    [
      'password without letter',
      { username: 'alice', email: 'a@b.com', password: '12345678' },
    ],
  ])('rejects %s', async (_label, payload) => {
    const errors = await violations(payload);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('never declares isAdmin: whitelist strips it silently', async () => {
    const dto = plainToInstance(CreateUserDto, {
      username: 'alice',
      email: 'a@b.com',
      password: 'abc12345',
      isAdmin: true,
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto).not.toHaveProperty('isAdmin');
  });

  it('does not declare isAdmin on the DTO shape', () => {
    expect(new CreateUserDto()).not.toHaveProperty('isAdmin');
  });
});
