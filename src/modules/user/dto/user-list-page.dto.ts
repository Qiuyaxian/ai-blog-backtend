import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

/** 用户分页列表（_id 倒序），service 返回类型与 Swagger 文档模型共用 */
export class UserListPageResponse {
  @ApiProperty({ description: '未软删用户总条数' })
  total: number;

  @ApiProperty({
    type: [UserResponseDto],
    description:
      '本页用户（最多等于 pageSize，缺省 20/封顶 50）；越界页为空数组',
  })
  list: UserResponseDto[];

  @ApiProperty({ description: '当前页码，从 1 起', example: 1 })
  page: number;

  @ApiProperty({
    description: '总页数 = ceil(total/pageSize)；无数据为 0',
    example: 1,
  })
  pageTotal: number;

  @ApiProperty({
    description: '本页首条全局序号（从 1 起）= (page-1)*pageSize+1',
    example: 1,
  })
  index: number;
}
