import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentToken } from './current-token.decorator';

describe('CurrentToken param decorator', () => {
  it('registers exactly one route param decorator with an extractor factory', () => {
    class Demo {
      run(@CurrentToken() token: string): void {
        void token;
      }
    }
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      Demo,
      'run',
    ) as Record<string, { factory: (_d: unknown, ctx: unknown) => unknown }>;
    const entries = Object.values(metadata);
    expect(entries).toHaveLength(1);
    expect(typeof entries[0].factory).toBe('function');
  });

  it('factory extracts the raw token from a Bearer authorization header', () => {
    class Demo {
      run(@CurrentToken() token: string): void {
        void token;
      }
    }
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      Demo,
      'run',
    ) as Record<string, { factory: (_d: unknown, ctx: unknown) => unknown }>;
    const entry = Object.values(metadata)[0];
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer raw-token' } }),
      }),
    };
    expect(entry.factory(undefined, ctx)).toBe('raw-token');
  });

  it('factory returns undefined without an authorization header', () => {
    class Demo {
      run(@CurrentToken() token: string): void {
        void token;
      }
    }
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      Demo,
      'run',
    ) as Record<string, { factory: (_d: unknown, ctx: unknown) => unknown }>;
    const entry = Object.values(metadata)[0];
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    };
    expect(entry.factory(undefined, ctx)).toBeUndefined();
  });
});
