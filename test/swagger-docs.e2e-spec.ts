import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as request from 'supertest';
import { authHeader, createTestApp, loginHelper } from './helpers/e2e-app';

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

  it('登录 200 成功模型由插件推断并被统一成功外壳包裹（allOf：SuccessEnvelope + data）', () => {
    const login200 =
      doc.paths['/auth/login'].post.responses['200'].content['application/json']
        .schema;
    expect(login200.allOf[0]).toEqual({
      $ref: '#/components/schemas/SuccessEnvelope',
    });
    expect(login200.allOf[1].properties.data.$ref).toBe(
      '#/components/schemas/LoginResultResponse',
    );

    // SuccessEnvelope 基础模型：success/code/message 三字段，无 path/time
    const baseProps = doc.components.schemas.SuccessEnvelope.properties;
    expect(Object.keys(baseProps).sort()).toEqual(
      ['code', 'message', 'success'].sort(),
    );
    expect(baseProps.success.type).toBe('boolean');
    expect(baseProps.code.type).toBe('number');
    expect(baseProps.code.example).toBe(200);
  });

  it('ErrorEnvelope 含 success:false/数字 code/message/data(nullable)，无 statusCode/path/time', () => {
    const props = doc.components.schemas.ErrorEnvelope.properties;
    expect(Object.keys(props).sort()).toEqual(
      ['code', 'data', 'message', 'success'].sort(),
    );
    expect(props.success.example).toBe(false);
    expect(props.code.type).toBe('number');
    // 共享模型不写死具体错误码（各状态码示例由响应级 example 给出，避免 UI 全显 409）
    expect(props.code).not.toHaveProperty('example');
    expect(props.data.nullable).toBe(true);
    expect(props).not.toHaveProperty('statusCode');
    expect(props).not.toHaveProperty('path');
    expect(props).not.toHaveProperty('time');
    // 旧 5 个逐接口 Envelope 子类已删除（免逐接口注解）
    for (const legacy of [
      'LoginEnvelope',
      'UserEnvelope',
      'UserListPageEnvelope',
      'LogoutEnvelope',
      'DeleteEnvelope',
      'ErrorResponse',
    ]) {
      expect(doc.components.schemas).not.toHaveProperty(legacy);
    }
  });

  it('9 个业务操作的成功码统一为 200，且所有 4xx 统一全套并 $ref ErrorEnvelope（全局注入哨兵）', () => {
    const errorRef = '#/components/schemas/ErrorEnvelope';
    const errors = [400, 401, 403, 404, 409];
    // 成功码：所有业务操作统一 200
    const expectedSuccess: Record<string, Record<string, number>> = {
      '/auth/login': { post: 200 },
      '/auth/logout': { post: 200 },
      '/users': { post: 200, get: 200 },
      '/users/me': { get: 200, post: 200 },
      '/users/detail': { get: 200 },
      '/users/admin': { post: 200 },
      '/users/delete': { post: 200 },
    };
    for (const [path, methods] of Object.entries(expectedSuccess)) {
      for (const [method, success] of Object.entries(methods)) {
        const responses = doc.paths[path][method].responses;
        expect(Object.keys(responses).map(Number).sort()).toEqual(
          [success, ...errors].sort(),
        );
        for (const status of errors) {
          const media = responses[status].content['application/json'];
          expect(media.schema.$ref).toBe(errorRef);
          // 每个错误状态码的示例体 code 必须等于自身状态码（不共用写死的 409）
          expect(media.example).toMatchObject({
            success: false,
            code: status,
            data: null,
          });
        }
      }
    }
  });

  it('T031：列表 data 为五字段页码分页、删除 data 为 null、单查 data nullable，旧模型零引用', () => {
    // 分页 DTO：total/list/page/pageTotal/index，无 items/nextCursor
    const pageProps = doc.components.schemas.UserListPageResponse.properties;
    expect(Object.keys(pageProps).sort()).toEqual(
      ['index', 'list', 'page', 'pageTotal', 'total'].sort(),
    );

    // GET /users 成功 data 指向分页 DTO
    const listData =
      doc.paths['/users'].get.responses['200'].content['application/json']
        .schema.allOf[1].properties.data;
    expect(listData.$ref).toBe('#/components/schemas/UserListPageResponse');

    // POST /users/delete 与 POST /auth/logout：Promise<null> 由 wrap 合成 data:null
    for (const [path, method] of [
      ['/users/delete', 'post'],
      ['/auth/logout', 'post'],
    ] as const) {
      const data =
        doc.paths[path][method].responses['200'].content['application/json']
          .schema.allOf[1].properties.data;
      expect(data).toMatchObject({ nullable: true, example: null });
    }

    // GET /users/detail：UserResponseDto | null，$ref 同级带 nullable
    const detailData =
      doc.paths['/users/detail'].get.responses['200'].content[
        'application/json'
      ].schema.allOf[1].properties.data;
    expect(detailData).toMatchObject({
      $ref: '#/components/schemas/UserResponseDto',
      nullable: true,
    });

    // 旧删除结果模型已删除
    expect(doc.components.schemas).not.toHaveProperty('DeleteResultResponse');
  });
});

/**
 * 004 US2：文档页 Bearer Authorize 调试链路无旁路。
 * 形态模拟 Swagger UI 实际发出的请求（contracts §4 四态）。
 *
 * 顺序证据（tasks T019）：运行时鉴权由 003 保证，本组在 US1 注解/装配落地后
 * 直接绿；真正的 RED 点是 US1 的文档源 security 断言（上方 T010）——
 * 若 @ApiBearerAuth/装配未生效，该断言先失败。
 */
describe('Swagger UI Authorize 调试链路（四态）', () => {
  let app: INestApplication;
  let conn: Connection;
  const credentials = { identifier: 'swagger_alice', password: 'abc12345' };

  beforeAll(async () => {
    app = await createTestApp();
    conn = app.get<Connection>(getConnectionToken());
    await conn.collection('users').deleteMany({});
    await request(app.getHttpServer())
      .post('/users')
      .send({
        username: 'swagger_alice',
        email: 'swagger_alice@example.com',
        password: 'abc12345',
      })
      .expect(200);
  }, 30000);

  afterAll(async () => {
    await conn.collection('users').deleteMany({});
    await app.close();
  });

  it('无 Authorization 调 GET /users/me 返回 401', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('Bearer 令牌 200、普通用户访问管理员列表 403、登出后原令牌 401', async () => {
    const token = await loginHelper(app, credentials);
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set(authHeader(token))
      .expect(200);
    expect(res.body.data.username).toBe('swagger_alice');

    await request(app.getHttpServer())
      .get('/users')
      .set(authHeader(token))
      .expect(403);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set(authHeader(token))
      .expect(200);
    await request(app.getHttpServer())
      .get('/users/me')
      .set(authHeader(token))
      .expect(401);
  });
});

/**
 * 004 US3：production 下文档全 404（独立 bootstrap，不污染默认 local e2e-app）。
 * setupSwagger 关闭时不 createDocument/不 setup，路由未注册 → 未知路由 404。
 */
describe('Swagger 文档（production 关闭）', () => {
  let app: INestApplication;
  const previousEnv: Record<string, string | undefined> = {};
  const overriddenKeys = [
    'NODE_ENV',
    'MONGODB_URI',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
    'REDIS_DB',
    'REDIS_KEY_PREFIX',
    'SWAGGER_ENABLED',
  ];

  beforeEach(async () => {
    // 必须在 NestFactory.create 之前覆盖：ConfigModule 启动时读 process.env
    for (const key of overriddenKeys) {
      previousEnv[key] = process.env[key];
    }
    process.env.NODE_ENV = 'production';
    // .env.production 指向 localhost/ai_blog（非测试库且有 IPv6 风险），显式覆盖
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/ai_blog_test';
    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = '';
    process.env.REDIS_DB = '0';
    process.env.REDIS_KEY_PREFIX = 'test:prod:';
    // @nestjs/config 不覆盖 process.env 已有键：setup-env 加载 .env.local 时
    // SWAGGER_ENABLED=true 已进 process.env，故 production 块必须显式覆盖为 false
    process.env.SWAGGER_ENABLED = 'false';

    // setup-env.ts 已在进程级把 NODE_ENV 置为 local，AppModule 顶层闭包的 envFilePath
    // 随之锁定 .env.local；用独立模块注册表重载，确保 production 块真正加载 .env.production
    await new Promise<void>((resolve, reject) => {
      jest.isolateModules(async () => {
        try {
          /* eslint-disable @typescript-eslint/no-var-requires -- isolateModules 必须用 require 以获得独立模块注册表 */
          const { ValidationPipe } = require('@nestjs/common');
          const { NestFactory } = require('@nestjs/core');
          const { ConfigService } = require('@nestjs/config');
          const { AppModule: ProdAppModule } = require('../src/app.module');
          const {
            HttpExceptionFilter: ProdFilter,
          } = require('../src/common/filters/http-exception.filter');
          const {
            AccessLogInterceptor: ProdInterceptor,
          } = require('../src/common/interceptors/access-log.interceptor');
          const {
            setupSwagger: prodSetupSwagger,
          } = require('../src/common/swagger/swagger');
          /* eslint-enable @typescript-eslint/no-var-requires */

          const prodApp = await NestFactory.create(ProdAppModule, {
            logger: false,
          });
          prodApp.useGlobalPipes(
            new ValidationPipe({
              whitelist: true,
              forbidNonWhitelisted: true,
              transform: true,
            }),
          );
          prodApp.useGlobalFilters(new ProdFilter());
          prodApp.useGlobalInterceptors(new ProdInterceptor());
          prodSetupSwagger(prodApp, prodApp.get(ConfigService));
          await prodApp.init();
          app = prodApp as INestApplication;
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }, 30000);

  afterEach(async () => {
    await app.close();
    for (const key of overriddenKeys) {
      if (previousEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousEnv[key];
      }
    }
  });

  it('UI、文档源与 swagger-ui 静态资源全部 404', async () => {
    await request(app.getHttpServer()).get('/api-docs').expect(404);
    await request(app.getHttpServer()).get('/api-docs-json').expect(404);
    // 资产前缀以 @nestjs/swagger express loader 实际挂载为准
    await request(app.getHttpServer())
      .get('/api-docs/swagger-ui-bundle.js')
      .expect(404);
  });

  it('业务管线不受影响：登录端点仍工作（不存在凭据 → 401，而非 404）', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'nobody_prod', password: 'wrongpass123' })
      .expect(401);
    expect(res.body.code).toBe(401);
  });
});
