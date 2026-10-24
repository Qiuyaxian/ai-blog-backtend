import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Min } from 'class-validator';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** 缺省 20；非法值留给 @IsInt 报 400，超过上限截断（封顶）而非拒绝 */
function normalizeLimit({ value }: { value: unknown }): number {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_LIMIT;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > MAX_LIMIT ? MAX_LIMIT : (n as number);
}

/** 管理员用户列表查询：游标倒序分页，limit 服务端封顶 50 */
export class UserQueryDto {
  @ApiPropertyOptional({
    description: '每页数量：整数 ≥1，缺省 20，超过 50 服务端截断为 50',
    example: 20,
    minimum: 1,
    default: 20,
  })
  @IsOptional()
  @Transform(normalizeLimit)
  @IsInt()
  @Min(1)
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description:
      '分页游标：上一页最后一条记录的用户 ID（24 位十六进制 MongoId）；首页不传',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  cursor?: string;
}
