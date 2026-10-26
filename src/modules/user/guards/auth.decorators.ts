import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles, RolesGuard } from './roles.guard';

/**
 * 「已登录」接口的一站式声明：挂 RolesGuard（认证-only 模式，不要求角色）、
 * 标记 Bearer 鉴权。
 *
 * 错误响应（401/403 等）与成功外壳、状态码一样由 wrap-envelope 在文档生成后
 * 全局注入，方法上不再逐个声明（见 ADR-006 决策 8 修订）。
 */
export function AuthOnly(): MethodDecorator {
  return applyDecorators(UseGuards(RolesGuard), ApiBearerAuth('Bearer'));
}

/**
 * 「仅管理员」接口：在 {@link AuthOnly} 之上追加 admin 角色要求。
 */
export function AdminOnly(): MethodDecorator {
  return applyDecorators(AuthOnly(), Roles('admin'));
}
