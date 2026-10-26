import { OpenAPIObject } from '@nestjs/swagger';
import { ResponseObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { wrapSuccessEnvelope } from './wrap-envelope';

/** 构造最小 OpenAPI 文档片段 */
function docWith(
  paths: OpenAPIObject['paths'],
  schemas: Record<string, unknown> = {},
): OpenAPIObject {
  return {
    openapi: '3.0.0',
    info: { title: 't', version: '1' },
    paths,
    components: { schemas: schemas as OpenAPIObject['components']['schemas'] },
  } as OpenAPIObject;
}

const jsonResponse = (schema: unknown, status = 200) => ({
  [`${status}`]: {
    description: '',
    content: { 'application/json': { schema } },
  },
});

type WrappedSchema = { allOf?: unknown[] } & Record<string, unknown>;

/** 取某操作某状态码的 JSON schema（测试断言辅助，缺字段即抛错） */
function schemaAt(
  doc: OpenAPIObject,
  path: string,
  method: 'get' | 'post',
  status: number,
): WrappedSchema {
  const operation = (doc.paths[path] as Record<string, unknown>)[method] as {
    responses: Record<string, ResponseObject>;
  };
  const media = operation.responses[status].content;
  if (!media) {
    throw new Error(`${path} ${method} ${status} 无 application/json 内容`);
  }
  return media['application/json'].schema as WrappedSchema;
}

describe('wrapSuccessEnvelope', () => {
  it('2xx JSON schema 被包进统一成功外壳（success/code/message + data）', () => {
    const doc = docWith({
      '/users': {
        get: {
          responses: jsonResponse({
            $ref: '#/components/schemas/UserResponseDto',
          }),
        },
      },
    });

    const out = wrapSuccessEnvelope(doc);
    const schema = schemaAt(out, '/users', 'get', 200);

    expect(schema.allOf).toBeDefined();
    expect(schema.allOf?.[0]).toEqual({
      $ref: '#/components/schemas/SuccessEnvelope',
    });
    expect(schema.allOf?.[1]).toEqual({
      type: 'object',
      properties: {
        data: { $ref: '#/components/schemas/UserResponseDto' },
      },
    });
  });

  it('SuccessEnvelope 基础模型注册 success(boolean)/code(number=200)/message(string)', () => {
    const out = wrapSuccessEnvelope(
      docWith({
        '/x': { get: { responses: jsonResponse({ type: 'object' }) } },
      }),
    );
    const base = out.components?.schemas?.SuccessEnvelope as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(base.properties.success).toMatchObject({ type: 'boolean' });
    expect(base.properties.code).toMatchObject({
      type: 'number',
      example: 200,
    });
    expect(base.properties.message).toMatchObject({
      type: 'string',
      example: 'ok',
    });
  });

  it('成功响应统一为 200 并包裹；4xx/5xx 原样不动（错误外壳 ErrorEnvelope 不经此函数）', () => {
    const errorSchema = { $ref: '#/components/schemas/ErrorEnvelope' };
    const doc = docWith({
      '/users': {
        post: {
          responses: {
            ...jsonResponse(
              { $ref: '#/components/schemas/UserResponseDto' },
              201,
            ),
            '409': {
              description: '',
              content: { 'application/json': { schema: errorSchema } },
            },
          },
        },
      },
    });

    const out = wrapSuccessEnvelope(doc);
    expect(schemaAt(out, '/users', 'post', 200).allOf).toBeDefined();
    expect(out.paths['/users'].post.responses['201']).toBeUndefined();
    expect(schemaAt(out, '/users', 'post', 409)).toEqual(errorSchema);
  });

  it('豁免路径（/、/health/*）不包裹，保留 Terminus 原生 schema', () => {
    const terminusSchema = {
      type: 'object',
      properties: { status: { type: 'object' } },
    };
    const doc = docWith({
      '/': { get: { responses: jsonResponse({ type: 'string' }) } },
      '/health/ready': {
        get: { responses: jsonResponse(terminusSchema) },
      },
      '/users': { get: { responses: jsonResponse({ type: 'object' }) } },
    });

    const out = wrapSuccessEnvelope(doc);
    expect(schemaAt(out, '/', 'get', 200)).toEqual({ type: 'string' });
    expect(schemaAt(out, '/health/ready', 'get', 200)).toEqual(terminusSchema);
    expect(schemaAt(out, '/users', 'get', 200).allOf).toBeDefined();
  });

  it('内联对象 schema 与数组 schema 同样可包裹（data 可以是 {} 或 []）', () => {
    const doc = docWith({
      '/a': {
        get: {
          responses: jsonResponse({
            type: 'object',
            properties: { id: { type: 'string' } },
          }),
        },
      },
      '/b': {
        get: {
          responses: jsonResponse({
            type: 'array',
            items: { type: 'string' },
          }),
        },
      },
    });

    const out = wrapSuccessEnvelope(doc);
    const a = schemaAt(out, '/a', 'get', 200);
    const b = schemaAt(out, '/b', 'get', 200);
    expect(
      (a.allOf?.[1] as { properties: { data: unknown } }).properties.data,
    ).toMatchObject({
      type: 'object',
      properties: { id: { type: 'string' } },
    });
    expect(
      (b.allOf?.[1] as { properties: { data: unknown } }).properties.data,
    ).toMatchObject({
      type: 'array',
      items: { type: 'string' },
    });
  });

  it('幂等：重复调用不产生双层包裹', () => {
    const doc = docWith({
      '/x': {
        get: {
          responses: jsonResponse({ $ref: '#/components/schemas/Foo' }),
        },
      },
    });

    const twice = wrapSuccessEnvelope(wrapSuccessEnvelope(doc));
    expect(schemaAt(twice, '/x', 'get', 200).allOf).toHaveLength(2);
  });

  it('无 application/json 内容（如空响应描述）时跳过，不抛错', () => {
    const doc = docWith({
      '/x': { get: { responses: { '200': { description: '' } } } },
    });
    expect(() => wrapSuccessEnvelope(doc)).not.toThrow();
  });

  describe('data 可为 null 的成功响应（T031：删除返 null、只读单查空结果返 null）', () => {
    it('空 content 的 200（controller 返回 Promise<null>，插件不产 schema）合成 data:null 外壳', () => {
      const doc = docWith({
        '/users/delete': {
          post: { responses: { '200': { description: '' } } },
        },
      });
      const out = wrapSuccessEnvelope(doc);
      const schema = schemaAt(out, '/users/delete', 'post', 200);
      expect(schema.allOf?.[0]).toEqual({
        $ref: '#/components/schemas/SuccessEnvelope',
      });
      expect(
        (schema.allOf?.[1] as { properties: { data: unknown } }).properties
          .data,
      ).toEqual({ type: 'object', nullable: true, example: null });
    });

    it('/auth/logout 同样合成 null 外壳（既有 Promise<null> 操作一并修正）', () => {
      const doc = docWith({
        '/auth/logout': { post: { responses: { '200': { description: '' } } } },
      });
      const out = wrapSuccessEnvelope(doc);
      expect(schemaAt(out, '/auth/logout', 'post', 200).allOf).toBeDefined();
    });

    it('单查接口的 $ref data 增加 nullable（返回 UserResponseDto | null，插件丢弃 null 成员）', () => {
      const doc = docWith({
        '/users/detail': {
          get: {
            responses: jsonResponse({
              $ref: '#/components/schemas/UserResponseDto',
            }),
          },
        },
      });
      const out = wrapSuccessEnvelope(doc);
      const data = (
        schemaAt(out, '/users/detail', 'get', 200).allOf?.[1] as {
          properties: { data: unknown };
        }
      ).properties.data as Record<string, unknown>;
      expect(data).toMatchObject({
        $ref: '#/components/schemas/UserResponseDto',
        nullable: true,
      });
    });

    it('非 null 单查/对象接口的 data 不加 nullable', () => {
      const doc = docWith({
        '/users/me': {
          get: {
            responses: jsonResponse({
              $ref: '#/components/schemas/UserResponseDto',
            }),
          },
        },
      });
      const out = wrapSuccessEnvelope(doc);
      const data = (
        schemaAt(out, '/users/me', 'get', 200).allOf?.[1] as {
          properties: { data: unknown };
        }
      ).properties.data as Record<string, unknown>;
      expect(data).not.toHaveProperty('nullable');
    });
  });

  describe('全局错误响应注入（删除逐接口 @ApiErrorResponses）', () => {
    it('每个非豁免操作补齐全套 400/401/403/404/409，错误体均 $ref ErrorEnvelope', () => {
      const doc = docWith({
        '/users/detail': {
          get: {
            responses: jsonResponse({
              $ref: '#/components/schemas/UserResponseDto',
            }),
          },
        },
      });

      const out = wrapSuccessEnvelope(doc);
      const responses = out.paths['/users/detail'].get.responses as Record<
        string,
        ResponseObject
      >;
      expect(Object.keys(responses).map(Number).sort()).toEqual(
        [200, 400, 401, 403, 404, 409].sort(),
      );
      for (const status of [400, 401, 403, 404, 409]) {
        const media = responses[status].content?.['application/json'];
        expect(media?.schema).toEqual({
          $ref: '#/components/schemas/ErrorEnvelope',
        });
        // 示例体的 code 必须等于该响应的 HTTP 状态码（不能共用模型写死的 409）
        expect(media?.example).toMatchObject({
          success: false,
          code: status,
          data: null,
        });
      }
    });

    it('ErrorEnvelope 外壳模型随注入注册进 components.schemas', () => {
      const out = wrapSuccessEnvelope(
        docWith({
          '/x': { get: { responses: jsonResponse({ type: 'object' }) } },
        }),
      );
      const props = (
        out.components?.schemas?.ErrorEnvelope as {
          properties: Record<string, unknown>;
        }
      ).properties;
      expect(Object.keys(props).sort()).toEqual(
        ['code', 'data', 'message', 'success'].sort(),
      );
      expect(props.code).toMatchObject({ type: 'number' });
      // 共享模型不写死具体错误码示例（各状态码由响应级 example 覆盖，避免 UI 全显 409）
      expect(props.code).not.toHaveProperty('example');
    });

    it('已存在的错误状态码不重复注入、不覆盖（幂等）', () => {
      const doc = docWith({
        '/x': {
          get: {
            responses: {
              ...jsonResponse({ type: 'object' }),
              '404': {
                description: '保留的自定义 404',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                  },
                },
              },
            },
          },
        },
      });

      const out = wrapSuccessEnvelope(doc);
      const responses = out.paths['/x'].get.responses as Record<
        string,
        ResponseObject
      >;
      expect(responses['404'].description).toBe('保留的自定义 404');
    });

    it('豁免路径（/、/health/*）不注入错误响应', () => {
      const doc = docWith({
        '/': { get: { responses: jsonResponse({ type: 'string' }) } },
        '/health/live': {
          get: { responses: jsonResponse({ type: 'object' }) },
        },
      });

      const out = wrapSuccessEnvelope(doc);
      expect(Object.keys(out.paths['/'].get.responses)).toEqual(['200']);
      expect(Object.keys(out.paths['/health/live'].get.responses)).toEqual([
        '200',
      ]);
    });
  });

  describe('成功状态码统一归一为 200（删除逐接口 @HttpCode 后文档与运行时一致）', () => {
    it.each(['/users', '/users/'])(
      'POST 资源根 %s 的成功响应键归一为 200',
      (path) => {
        const doc = docWith({
          [path]: {
            post: { responses: jsonResponse({ type: 'object' }, 201) },
          },
        });
        const out = wrapSuccessEnvelope(doc);
        expect(out.paths[path].post.responses['200']).toBeTruthy();
        expect(out.paths[path].post.responses['201']).toBeUndefined();
      },
    );

    it('POST 子路径动作的成功响应键保持 200', () => {
      const doc = docWith({
        '/auth/login': {
          post: { responses: jsonResponse({ type: 'object' }, 201) },
        },
      });
      const out = wrapSuccessEnvelope(doc);
      expect(out.paths['/auth/login'].post.responses['200']).toBeTruthy();
      expect(out.paths['/auth/login'].post.responses['201']).toBeUndefined();
    });
  });
});
