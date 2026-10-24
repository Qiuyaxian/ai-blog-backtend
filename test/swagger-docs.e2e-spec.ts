import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './helpers/e2e-app';

/**
 * 004-swagger-docs：文档暴露与文档源内容契约。
 * local 配置（createTestApp 默认 NODE_ENV=local，SWAGGER_ENABLED 缺省开放）。
 */
describe('Swagger 文档（local）', () => {
  let app: INestApplication;
  let doc: any;

  beforeAll(async () => {
    app = await createTestApp();

    const ui = await request(app.getHttpServer()).get('/api-docs').expect(200);
    // A1：UI 页面为 HTML 且含 swagger-ui 标记
    expect(ui.headers['content-type']).toContain('text/html');
    expect(ui.text).toContain('swagger-ui');

    const json = await request(app.getHttpServer())
      .get('/api-docs-json')
      .expect(200);
    doc = json.body;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('文档源为 OpenAPI 3 且 info 非空', () => {
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toBeTruthy();
    expect(doc.info.version).toBeTruthy();
  });

  it('paths 含 9 个业务操作与 3 个 infra 路径', () => {
    expect(doc.paths['/auth/login'].post).toBeTruthy();
    expect(doc.paths['/auth/logout'].post).toBeTruthy();
    expect(doc.paths['/users'].post).toBeTruthy();
    expect(doc.paths['/users'].get).toBeTruthy();
    expect(doc.paths['/users/me'].get).toBeTruthy();
    expect(doc.paths['/users/me'].post).toBeTruthy();
    expect(doc.paths['/users/detail'].get).toBeTruthy();
    expect(doc.paths['/users/admin'].post).toBeTruthy();
    expect(doc.paths['/users/delete'].post).toBeTruthy();

    expect(doc.paths['/'].get).toBeTruthy();
    expect(doc.paths['/health/live'].get).toBeTruthy();
    expect(doc.paths['/health/ready'].get).toBeTruthy();
  });

  it('安全方案 Bearer scheme=bearer，受保护操作挂 security，公开操作不挂', () => {
    expect(doc.components.securitySchemes.Bearer.scheme).toBe('bearer');

    const protectedOps = [
      ['/auth/logout', 'post'],
      ['/users/me', 'get'],
      ['/users/me', 'post'],
      ['/users', 'get'],
      ['/users/detail', 'get'],
      ['/users/admin', 'post'],
      ['/users/delete', 'post'],
    ] as const;
    for (const [p, m] of protectedOps) {
      expect(doc.paths[p][m].security).toEqual(
        expect.arrayContaining([{ Bearer: [] }]),
      );
    }

    expect(doc.paths['/auth/login'].post.security).toBeUndefined();
    expect(doc.paths['/users'].post.security).toBeUndefined();
  });

  it('DTO 约束哨兵：LoginDto.password 8–64、CreateUserDto.password 有字母+数字 pattern', () => {
    const loginPassword = doc.components.schemas.LoginDto.properties.password;
    expect(loginPassword.minLength).toBe(8);
    expect(loginPassword.maxLength).toBe(64);

    const createPassword =
      doc.components.schemas.CreateUserDto.properties.password;
    expect(typeof createPassword.pattern).toBe('string');
    expect(createPassword.pattern.length).toBeGreaterThan(0);
    // 与 DTO 正则同义：必须同时含字母与数字
    const re = new RegExp(createPassword.pattern);
    expect(re.test('abc12345')).toBe(true);
    expect(re.test('12345678')).toBe(false);
    expect(re.test('abcdefgh')).toBe(false);
  });

  it('UserResponseDto 恰为 6 个公开字段，不泄露 password/usernameLower/deletedAt', () => {
    const props = doc.components.schemas.UserResponseDto.properties;
    expect(Object.keys(props).sort()).toEqual(
      ['createdAt', 'email', 'id', 'isAdmin', 'updatedAt', 'username'].sort(),
    );
  });

  it('ErrorResponse 含 code/message/statusCode', () => {
    const props = doc.components.schemas.ErrorResponse.properties;
    expect(props.code).toBeTruthy();
    expect(props.message).toBeTruthy();
    expect(props.statusCode).toBeTruthy();
  });
});
