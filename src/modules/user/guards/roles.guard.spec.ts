import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Roles, RolesGuard } from './roles.guard';
import { CurrentUser } from './current-user.interface';

function mockContext(
  user: CurrentUser | undefined,
  handler: () => void = () => undefined,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('throws 401 when no authenticated user on an admin route', () => {
    const handler = (): void => undefined;
    Reflect.defineMetadata(ROLES_KEY, ['admin'], handler);
    expect(() => guard.canActivate(mockContext(undefined, handler))).toThrow(
      UnauthorizedException,
    );
  });

  it('throws 403 when a non-admin hits an admin route', () => {
    const handler = (): void => undefined;
    Reflect.defineMetadata(ROLES_KEY, ['admin'], handler);
    const user: CurrentUser = { id: 'u1', isAdmin: false };
    expect(() => guard.canActivate(mockContext(user, handler))).toThrow(
      ForbiddenException,
    );
  });

  it('allows an admin on an admin route', () => {
    const handler = (): void => undefined;
    Reflect.defineMetadata(ROLES_KEY, ['admin'], handler);
    const user: CurrentUser = { id: 'u1', isAdmin: true };
    expect(guard.canActivate(mockContext(user, handler))).toBe(true);
  });

  it('auth-only mode (no @Roles): rejects anonymous with 401', () => {
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('auth-only mode (no @Roles): allows any logged-in user', () => {
    const normal: CurrentUser = { id: 'u2', isAdmin: false };
    const admin: CurrentUser = { id: 'u3', isAdmin: true };
    expect(guard.canActivate(mockContext(normal))).toBe(true);
    expect(guard.canActivate(mockContext(admin))).toBe(true);
  });

  it('exposes a Roles decorator that sets role metadata', () => {
    class Demo {
      @Roles('admin')
      run(): void {
        return undefined;
      }
    }
    const demo = new Demo();
    expect(Reflect.getMetadata(ROLES_KEY, demo.run)).toEqual(['admin']);
  });
});
