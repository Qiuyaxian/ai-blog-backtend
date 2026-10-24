import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  DeleteResultResponse,
  ErrorResponse,
  UserListPageResponse,
} from '../../common/swagger/response-schemas';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { SetAdminDto } from './dto/set-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CurrentUser } from './guards/current-user.interface';
import { Roles, RolesGuard } from './guards/roles.guard';
import { UserService } from './user.service';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 注册：公开接口，无守卫；@Public 为 US2 全局默认拒绝排雷
  @Public()
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: '注册新用户（公开）' })
  @ApiResponse({ status: 201, type: UserResponseDto, description: '注册成功' })
  @ApiResponse({
    status: 400,
    type: ErrorResponse,
    description: '参数校验失败（VALIDATION_ERROR）',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponse,
    description: '用户名或邮箱已存在（USERNAME_EXISTS / EMAIL_EXISTS）',
  })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(dto);
  }

  // 以下两个路由挂 RolesGuard 但不声明 @Roles：认证-only 模式
  @UseGuards(RolesGuard)
  @Get('me')
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: '查看本人资料（登录用户）' })
  @ApiResponse({ status: 200, type: UserResponseDto, description: '本人资料' })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: '未登录或令牌无效',
  })
  me(@Req() req: { user: CurrentUser }): Promise<UserResponseDto> {
    return this.userService.findById(req.user.id);
  }

  @UseGuards(RolesGuard)
  @Post('me')
  @HttpCode(200)
  @ApiBearerAuth('Bearer')
  @ApiOperation({
    summary: '修改本人资料（登录用户）',
    description: '当前仅支持修改邮箱。',
  })
  @ApiResponse({
    status: 200,
    type: UserResponseDto,
    description: '更新后的本人资料',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponse,
    description: '参数校验失败（VALIDATION_ERROR）',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: '未登录或令牌无效',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponse,
    description: '邮箱已存在（EMAIL_EXISTS）',
  })
  updateMe(
    @Req() req: { user: CurrentUser },
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.updateEmail(req.user.id, dto);
  }

  // 管理员接口：写参数全部走 body
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  @ApiBearerAuth('Bearer')
  @ApiOperation({
    summary: '用户分页列表（需要管理员角色）',
    description: '_id 游标倒序；limit 缺省 20、封顶 50。',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '每页数量，整数 ≥1，缺省 20，超过 50 截断',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: '分页游标（上一页最后一条用户 ID），首页不传',
  })
  @ApiResponse({
    status: 200,
    type: UserListPageResponse,
    description: '分页用户列表',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponse,
    description: '查询参数校验失败（VALIDATION_ERROR）',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: '未登录或令牌无效',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponse,
    description: '已登录但非管理员',
  })
  list(@Query() query: UserQueryDto) {
    return this.userService.list(query);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('detail')
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: '按 ID 查询用户详情（需要管理员角色）' })
  @ApiQuery({
    name: 'id',
    required: true,
    type: String,
    description: '用户 ID（24 位十六进制 MongoId）',
  })
  @ApiResponse({ status: 200, type: UserResponseDto, description: '用户资料' })
  @ApiResponse({
    status: 400,
    type: ErrorResponse,
    description: 'ID 非法（INVALID_ID）',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: '未登录或令牌无效',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponse,
    description: '已登录但非管理员',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponse,
    description: '用户不存在（USER_NOT_FOUND）',
  })
  detail(@Query('id') id: string): Promise<UserResponseDto> {
    return this.userService.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('admin')
  @HttpCode(200)
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: '设置/取消管理员（需要管理员角色）' })
  @ApiResponse({
    status: 200,
    type: UserResponseDto,
    description: '更新后的用户资料',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponse,
    description: 'ID 非法或参数校验失败（INVALID_ID / VALIDATION_ERROR）',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: '未登录或令牌无效',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponse,
    description: '已登录但非管理员',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponse,
    description: '用户不存在（USER_NOT_FOUND）',
  })
  setAdmin(@Body() dto: SetAdminDto): Promise<UserResponseDto> {
    return this.userService.setAdmin(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('delete')
  @HttpCode(200)
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: '软删除用户（需要管理员角色）' })
  @ApiResponse({
    status: 200,
    type: DeleteResultResponse,
    description: '软删除成功',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponse,
    description: 'ID 非法或参数校验失败（INVALID_ID / VALIDATION_ERROR）',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponse,
    description: '未登录或令牌无效',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponse,
    description: '已登录但非管理员',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponse,
    description: '用户不存在（USER_NOT_FOUND）',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponse,
    description: '最后一个管理员受保护，不可删除（LAST_ADMIN_PROTECTED）',
  })
  remove(@Body() dto: DeleteUserDto): Promise<{ id: string }> {
    return this.userService.softDelete(dto);
  }
}
