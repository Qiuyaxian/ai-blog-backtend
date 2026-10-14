import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetAdminDto } from './set-admin.dto';

async function violations(payload: Record<string, unknown>) {
  const dto = plainToInstance(SetAdminDto, payload);
  return validate(dto, { whitelist: true });
}

describe('SetAdminDto', () => {
  const id = '65ab00000000000000000001';

  it('accepts a valid objectId and boolean isAdmin', async () => {
    expect(await violations({ id, isAdmin: true })).toHaveLength(0);
    expect(await violations({ id, isAdmin: false })).toHaveLength(0);
  });

  it('rejects a malformed id', async () => {
    const errors = await violations({ id: 'not-an-id', isAdmin: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('id');
  });

  it('rejects a non-boolean isAdmin', async () => {
    const errors = await violations({ id, isAdmin: 'yes' });
    expect(errors.some((e) => e.property === 'isAdmin')).toBe(true);
  });
});
