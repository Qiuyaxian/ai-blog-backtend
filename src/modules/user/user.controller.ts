import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { SetAdminDto } from './dto/set-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListPageResponse } from './dto/user-list-page.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CurrentUser } from './guards/current-user.interface';
import { AdminOnly, AuthOnly } from './guards/auth.decorators';
import { UserService } from './user.service';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 成功外壳、data 类型、状态码、错误响应均全局处理（Swagger 插件推断 + wrapSuccessEnvelope），方法零响应注解

  // 注册：公开接口，无守卫；@Public 为 US2 全局默认拒绝排雷
  @Public()
  @Post()
  @ApiOperation({ summary: '注册新用户（公开）' })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(dto);
  }

  // 登录用户：AuthOnly 自带 RolesGuard（认证-only）与 Bearer 文档
  @AuthOnly()
  @Get('me')
  @ApiOperation({ summary: '查看本人资料（登录用户）' })
  me(@Req() req: { user: CurrentUser }): Promise<UserResponseDto> {
    return this.userService.findById(req.user.id);
  }

  @AuthOnly()
  @Post('me')
  @ApiOperation({
    summary: '修改本人资料（登录用户）',
    description: '当前仅支持修改邮箱。',
  })
  updateMe(
    @Req() req: { user: CurrentUser },
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.updateEmail(req.user.id, dto);
  }

  // 管理员接口：AdminOnly 自带 RolesGuard + admin 角色；写参数全部走 body
  @AdminOnly()
  @Get()
  @ApiOperation({
    summary: '用户分页列表（需要管理员角色）',
    description: '_id 倒序；page 从 1 起，pageSize 缺省 20、封顶 50。',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '页码，整数 ≥1，缺省 1',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: '每页数量，整数 ≥1，缺省 20，超过 50 截断为 50',
  })
  list(@Query() query: UserQueryDto): Promise<UserListPageResponse> {
    return this.userService.list(query);
  }

  @AdminOnly()
  @Get('detail')
  @ApiOperation({ summary: '按 ID 查询用户详情（需要管理员角色）' })
  @ApiQuery({
    name: 'id',
    required: true,
    type: String,
    description: '用户 ID（24 位十六进制 MongoId）',
  })
  detail(@Query('id') id: string): Promise<UserResponseDto | null> {
    return this.userService.findByIdOrNull(id);
  }

  @AdminOnly()
  @Post('admin')
  @ApiOperation({ summary: '设置/取消管理员（需要管理员角色）' })
  setAdmin(@Body() dto: SetAdminDto): Promise<UserResponseDto> {
    return this.userService.setAdmin(dto);
  }

  @AdminOnly()
  @Post('delete')
  @ApiOperation({ summary: '软删除用户（需要管理员角色）' })
  remove(@Body() dto: DeleteUserDto): Promise<null> {
    return this.userService.softDelete(dto);
  }
}
