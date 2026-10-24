import { SwaggerModule } from '@nestjs/swagger';
import { isSwaggerEnabled, setupSwagger } from './swagger';

jest.mock('@nestjs/swagger', () => {
  const actual = jest.requireActual('@nestjs/swagger');
  return {
    ...actual,
    SwaggerModule: {
      ...actual.SwaggerModule,
      createDocument: jest.fn(),
      setup: jest.fn(),
    },
  };
});

describe('isSwaggerEnabled', () => {
  it('local 未设覆盖值时默认开放', () => {
    expect(isSwaggerEnabled('local')).toBe(true);
  });

  it('uat 未设覆盖值时默认开放', () => {
    expect(isSwaggerEnabled('uat')).toBe(true);
  });

  it('production 未设覆盖值时默认关闭', () => {
    expect(isSwaggerEnabled('production')).toBe(false);
  });

  it('nodeEnv 为 undefined 时按非生产处理（开放）', () => {
    expect(isSwaggerEnabled(undefined)).toBe(true);
  });

  it('production 显式 true 可覆盖开放', () => {
    expect(isSwaggerEnabled('production', 'true')).toBe(true);
  });

  it('uat 显式 false 可覆盖关闭', () => {
    expect(isSwaggerEnabled('uat', 'false')).toBe(false);
  });

  it('覆盖值大小写不敏感（TRUE 视为 true）', () => {
    expect(isSwaggerEnabled('production', 'TRUE')).toBe(true);
  });

  it('非法覆盖值 fail-fast 抛错（如拼写错误 ture）', () => {
    expect(() => isSwaggerEnabled('local', 'ture')).toThrow(/SWAGGER_ENABLED/);
  });
});

describe('setupSwagger', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function fakeConfig(values: Record<string, unknown>): {
    get: (k: string) => unknown;
  } {
    return { get: (k: string) => values[k] };
  }

  it('production 关闭时不构建文档、不注册路由（零开销 404 路径）', () => {
    const app = {} as never;
    setupSwagger(app, fakeConfig({ NODE_ENV: 'production' }) as never);
    expect(SwaggerModule.createDocument).not.toHaveBeenCalled();
    expect(SwaggerModule.setup).not.toHaveBeenCalled();
  });

  it('SWAGGER_ENABLED=false 显式关闭时同样不装配（即使 NODE_ENV=local）', () => {
    const app = {} as never;
    setupSwagger(
      app,
      fakeConfig({ NODE_ENV: 'local', SWAGGER_ENABLED: 'false' }) as never,
    );
    expect(SwaggerModule.createDocument).not.toHaveBeenCalled();
    expect(SwaggerModule.setup).not.toHaveBeenCalled();
  });
});
