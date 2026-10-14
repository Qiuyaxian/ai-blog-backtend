import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserQueryDto } from './user-query.dto';

async function dtoFor(query: Record<string, unknown>) {
  return plainToInstance(UserQueryDto, query);
}

describe('UserQueryDto', () => {
  it('defaults limit when absent', async () => {
    const dto = await dtoFor({});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.limit).toBe(20);
    expect(dto.cursor).toBeUndefined();
  });

  it('passes through a valid limit and cursor', async () => {
    const dto = await dtoFor({
      limit: '10',
      cursor: '65ab00000000000000000001',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.limit).toBe(10);
  });

  it('clamps an over-ceiling limit to 50', async () => {
    const dto = await dtoFor({ limit: '999' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.limit).toBe(50);
  });

  it('rejects a non-numeric limit', async () => {
    const dto = await dtoFor({ limit: 'abc' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects a malformed cursor', async () => {
    const dto = await dtoFor({ cursor: 'nope' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'cursor')).toBe(true);
  });
});
