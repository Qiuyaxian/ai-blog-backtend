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

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 注册：公开接口，无守卫；@Public 为 US2 全局默认拒绝排雷
  @Public()
  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(dto);
  }

  // 以下两个路由挂 RolesGuard 但不声明 @Roles：认证-only 模式
  @UseGuards(RolesGuard)
  @Get('me')
  me(@Req() req: { user: CurrentUser }): Promise<UserResponseDto> {
    return this.userService.findById(req.user.id);
  }

  @UseGuards(RolesGuard)
  @Post('me')
  @HttpCode(200)
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
  list(@Query() query: UserQueryDto) {
    return this.userService.list(query);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('detail')
  detail(@Query('id') id: string): Promise<UserResponseDto> {
    return this.userService.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('admin')
  @HttpCode(200)
  setAdmin(@Body() dto: SetAdminDto): Promise<UserResponseDto> {
    return this.userService.setAdmin(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('delete')
  @HttpCode(200)
  remove(@Body() dto: DeleteUserDto): Promise<{ id: string }> {
    return this.userService.softDelete(dto);
  }
}
