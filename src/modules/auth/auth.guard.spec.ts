import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';

function mockContext(
  headers: Record<string, string>,
  handler: () => void = () => undefined,
): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = { headers, user: undefined };
  const context = {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function setup(overrides: {
  session?: { sub: string } | null;
  sessionThrow?: Error;
  principal?: { id: string; isAdmin: boolean } | null;
  principalThrow?: Error;
  publicRoute?: boolean;
}) {
  const resolveSession = overrides.sessionThrow
    ? jest.fn().mockRejectedValue(overrides.sessionThrow)
    : jest.fn().mockResolvedValue(overrides.session ?? null);
  const getAuthPrincipal = overrides.principalThrow
    ? jest.fn().mockRejectedValue(overrides.principalThrow)
    : jest
        .fn()
        .mockResolvedValue(
          overrides.principal === undefined
            ? { id: 'u1', isAdmin: false }
            : overrides.principal,
        );
  // @ts-expect-error 注入最小 AuthService/UserService 桩
  const authService: AuthService = { resolveSession };
  // @ts-expect-error 注入最小桩
  const userService: UserService = { getAuthPrincipal };
  const reflector = new Reflector();
  const guard = new AuthGuard(reflector, authService, userService);

  const handler = (): void => undefined;
  if (overrides.publicRoute) {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  }
  return { guard, resolveSession, getAuthPrincipal, handler };
}

describe('AuthGuard', () => {
  it('passes a @Public() route without touching session/principal lookup', async () => {
    const { guard, resolveSession, getAuthPrincipal, handler } = setup({
      publicRoute: true,
    });
    const { context } = mockContext({}, handler);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolveSession).not.toHaveBeenCalled();
    expect(getAuthPrincipal).not.toHaveBeenCalled();
  });

  it.each([
    ['missing header', {}],
    ['wrong scheme', { authorization: 'Basic abc' }],
    ['empty token segment', { authorization: 'Bearer ' }],
    ['scheme only', { authorization: 'Bearer' }],
  ])('throws 401 UNAUTHENTICATED for %s', (_label, headers) => {
    const { guard } = setup({});
    const { context } = mockContext(headers);
    expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      message: 'UNAUTHENTICATED',
    });
  });

  it('accepts bearer scheme case-insensitively', async () => {
    const { guard } = setup({
      session: { sub: 'u1' },
      principal: { id: 'u1', isAdmin: true },
    });
    const { context, request } = mockContext({
      authorization: 'bEaReR token123',
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', isAdmin: true });
  });

  it('throws 401 when session is missing (expired/forged/revoked)', () => {
    const { guard } = setup({ session: null });
    const { context } = mockContext({ authorization: 'Bearer tok' });
    expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('fails closed with 401 when Redis/session lookup throws', () => {
    const { guard } = setup({ sessionThrow: new Error('redis down') });
    const { context } = mockContext({ authorization: 'Bearer tok' });
    expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      message: 'UNAUTHENTICATED',
    });
  });

  it('throws 401 when account is soft-deleted or missing (principal null)', () => {
    const { guard } = setup({
      session: { sub: 'u-gone' },
      principal: null,
    });
    const { context } = mockContext({ authorization: 'Bearer tok' });
    expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      message: 'UNAUTHENTICATED',
    });
  });

  it('fails closed with 401 when Mongo principal lookup throws', () => {
    const { guard } = setup({
      session: { sub: 'u1' },
      principalThrow: new Error('mongo down'),
    });
    const { context } = mockContext({ authorization: 'Bearer tok' });
    expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      message: 'UNAUTHENTICATED',
    });
  });

  it('injects request.user with current isAdmin from the database, not the session', async () => {
    const { guard, getAuthPrincipal } = setup({
      session: { sub: 'u1' },
      principal: { id: 'u1', isAdmin: false },
    });
    const { context, request } = mockContext({
      authorization: 'Bearer tok',
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(getAuthPrincipal).toHaveBeenCalledWith('u1');
    expect(request.user).toEqual({ id: 'u1', isAdmin: false });
  });
});
