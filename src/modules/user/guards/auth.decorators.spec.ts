import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { AdminOnly, AuthOnly } from './auth.decorators';
import { RolesGuard, ROLES_KEY } from './roles.guard';

describe('AuthOnly / AdminOnly 组合装饰器', () => {
  it('AuthOnly：挂 RolesGuard、带 Bearer 安全声明、不绑定角色', () => {
    class Demo {
      @AuthOnly()
      handler(): void {
        return undefined;
      }
    }
    const handler = Demo.prototype.handler;

    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    expect(guards.flat()).toContain(RolesGuard);

    const security = Reflect.getMetadata(
      DECORATORS.API_SECURITY,
      handler,
    ) as Record<string, unknown[]>[];
    expect(security.some((s) => 'Bearer' in s)).toBe(true);

    // 错误响应已改由 wrap-envelope 全局注入，装饰器不再挂方法级 @ApiResponse
    expect(
      Reflect.getMetadata(DECORATORS.API_RESPONSE, handler),
    ).toBeUndefined();

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toBeUndefined();
  });

  it('AdminOnly：在 AuthOnly 之上追加 admin 角色', () => {
    class Demo {
      @AdminOnly()
      handler(): void {
        return undefined;
      }
    }
    const handler = Demo.prototype.handler;

    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    expect(guards.flat()).toContain(RolesGuard);

    const security = Reflect.getMetadata(
      DECORATORS.API_SECURITY,
      handler,
    ) as Record<string, unknown[]>[];
    expect(security.some((s) => 'Bearer' in s)).toBe(true);

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['admin']);
  });
});
