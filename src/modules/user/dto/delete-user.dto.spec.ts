import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeleteUserDto } from './delete-user.dto';

async function violations(payload: Record<string, unknown>) {
  const dto = plainToInstance(DeleteUserDto, payload);
  return validate(dto, { whitelist: true });
}

describe('DeleteUserDto', () => {
  it('accepts a valid objectId', async () => {
    expect(await violations({ id: '65ab00000000000000000001' })).toHaveLength(
      0,
    );
  });

  it('rejects a malformed id', async () => {
    const errors = await violations({ id: 'nope' });
    expect(errors[0].property).toBe('id');
  });

  it('rejects a missing id', async () => {
    const errors = await violations({});
    expect(errors.some((e) => e.property === 'id')).toBe(true);
  });
});
