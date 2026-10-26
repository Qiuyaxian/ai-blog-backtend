import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/** 超过上限截断为 50（封顶）而非拒绝；非法值留给 @IsInt 报 400 */
function normalizePageSize({ value }: { value: unknown }): number {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_PAGE_SIZE;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > MAX_PAGE_SIZE
    ? MAX_PAGE_SIZE
    : (n as number);
}

/** 管理员用户列表查询：页码分页，page 从 1 起，pageSize 缺省 20、服务端封顶 50 */
export class UserQueryDto {
  @ApiPropertyOptional({
    description: '页码，从 1 起，缺省 1',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    description: '每页数量：整数 ≥1，缺省 20，超过 50 服务端截断为 50',
    example: 20,
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Transform(normalizePageSize)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}
