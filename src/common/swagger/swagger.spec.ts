import { isSwaggerEnabled } from './swagger';

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
