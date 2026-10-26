import {
  ERROR_CATALOG,
  ERROR_CODES,
  SWAGGER_ERROR_STATUSES,
  isEnvelopeExcludedPath,
  swaggerErrorDescription,
  SUCCESS_CODE,
  SUCCESS_MESSAGE,
} from './response.constants';

describe('isEnvelopeExcludedPath', () => {
  it('豁免根路径', () => {
    expect(isEnvelopeExcludedPath('/')).toBe(true);
  });

  it('豁免 /health 前缀及其子路径', () => {
    expect(isEnvelopeExcludedPath('/health')).toBe(true);
    expect(isEnvelopeExcludedPath('/health/live')).toBe(true);
    expect(isEnvelopeExcludedPath('/health/ready')).toBe(true);
  });

  it('业务路径不豁免', () => {
    expect(isEnvelopeExcludedPath('/users')).toBe(false);
    expect(isEnvelopeExcludedPath('/auth/login')).toBe(false);
    expect(isEnvelopeExcludedPath('/users/me')).toBe(false);
  });

  it('形似但非 /health 前缀的路径不豁免（边界防误判）', () => {
    expect(isEnvelopeExcludedPath('/healthx')).toBe(false);
    expect(isEnvelopeExcludedPath('/health-2')).toBe(false);
    expect(isEnvelopeExcludedPath('')).toBe(false);
  });

  it('导出统一成功码与成功消息常量', () => {
    expect(SUCCESS_CODE).toBe(200);
    expect(typeof SUCCESS_CODE).toBe('number');
    expect(SUCCESS_MESSAGE).toBe('ok');
  });
});

describe('ERROR_CODES 错误码统一配置', () => {
  it('覆盖过滤器实际映射与所有 Service/Guard 抛出的业务码', () => {
    expect(Object.keys(ERROR_CODES).sort()).toEqual(
      [
        'EMAIL_EXISTS',
        'FORBIDDEN',
        'INTERNAL_ERROR',
        'INVALID_CREDENTIALS',
        'INVALID_ID',
        'LAST_ADMIN_PROTECTED',
        'UNAUTHENTICATED',
        'USER_NOT_FOUND',
        'USERNAME_EXISTS',
        'VALIDATION_ERROR',
      ].sort(),
    );
  });

  it('每个码的文案都是非空字符串', () => {
    for (const [code, text] of Object.entries(ERROR_CODES)) {
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
      expect(code).toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('ERROR_CATALOG 单一错误配置（运行时文案 + Swagger 文档同源派生）', () => {
  it('ERROR_CODES 与 catalog 的 message 完全一致（无第二份文案）', () => {
    for (const code of Object.keys(ERROR_CATALOG)) {
      expect(ERROR_CODES[code as keyof typeof ERROR_CODES]).toBe(
        ERROR_CATALOG[code as keyof typeof ERROR_CATALOG].message,
      );
    }
  });

  it('每个码带合法 HTTP status（4xx/5xx）与非空文案', () => {
    for (const entry of Object.values(ERROR_CATALOG)) {
      expect(entry.status).toBeGreaterThanOrEqual(400);
      expect(entry.message.length).toBeGreaterThan(0);
    }
  });

  it('每个 Swagger 状态恰好有一个带 docLabel 的代表码', () => {
    for (const status of SWAGGER_ERROR_STATUSES) {
      const reps = Object.values(ERROR_CATALOG).filter(
        (e) => e.status === status && typeof e.docLabel === 'string',
      );
      expect(reps).toHaveLength(1);
      expect(reps[0].docLabel?.length).toBeGreaterThan(0);
    }
  });

  it('swaggerErrorDescription 从 catalog 派生「标签（CODE1 / CODE2）」，与 wrap 注入同源', () => {
    expect(swaggerErrorDescription(401)).toBe(
      '未登录或令牌无效（UNAUTHENTICATED / INVALID_CREDENTIALS）',
    );
    expect(swaggerErrorDescription(409)).toContain('业务冲突');
    expect(swaggerErrorDescription(409)).toContain('USERNAME_EXISTS');
  });

  it('500 不进 Swagger 文档集合；未配置 status 的描述查询 fail-fast', () => {
    expect(SWAGGER_ERROR_STATUSES).not.toContain(500);
    expect(SWAGGER_ERROR_STATUSES).toEqual([400, 401, 403, 404, 409]);
    expect(() => swaggerErrorDescription(418)).toThrow(/418/);
  });
});
