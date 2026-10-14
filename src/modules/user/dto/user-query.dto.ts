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
  @IsOptional()
  @Transform(normalizeLimit)
  @IsInt()
  @Min(1)
  limit: number = DEFAULT_LIMIT;

  @IsOptional()
  @IsMongoId()
  cursor?: string;
}
