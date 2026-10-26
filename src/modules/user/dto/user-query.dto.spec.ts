import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserQueryDto } from './user-query.dto';

async function dtoFor(query: Record<string, unknown>) {
  return plainToInstance(UserQueryDto, query);
}

describe('UserQueryDto', () => {
  it('defaults page=1 and pageSize=20 when absent', async () => {
    const dto = await dtoFor({});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
  });

  it('accepts numeric strings for page/pageSize', async () => {
    const dto = await dtoFor({ page: '3', pageSize: '10' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.pageSize).toBe(10);
  });

  it('clamps an over-ceiling pageSize to 50', async () => {
    const dto = await dtoFor({ pageSize: '999' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.pageSize).toBe(50);
  });

  it('rejects a non-numeric pageSize', async () => {
    const dto = await dtoFor({ pageSize: 'abc' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'pageSize')).toBe(true);
  });

  it('rejects page < 1', async () => {
    const dto = await dtoFor({ page: '0' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects pageSize < 1', async () => {
    const dto = await dtoFor({ pageSize: '0' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'pageSize')).toBe(true);
  });
});
