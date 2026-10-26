import { HttpStatus } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import {
  isEnvelopeExcludedPath,
  SUCCESS_CODE,
  SUCCESS_MESSAGE,
  SWAGGER_ERROR_STATUSES,
  swaggerErrorDescription,
} from '../response/response.constants';

/** Swagger 组件中统一成功外壳模型名 */
export const SUCCESS_ENVELOPE_NAME = 'SuccessEnvelope';
/** Swagger 组件中统一错误外壳模型名（与运行时 HttpExceptionFilter 输出对齐） */
export const ERROR_ENVELOPE_NAME = 'ErrorEnvelope';

/**
 * 全局注入到每个业务操作的错误状态码集合（005 / ADR-006 决策 13）。
 *
 * 删除逐接口 @ApiErrorResponses 后，错误在运行时抛出、静态签名不可见，
 * 故所有业务接口文档统一展示全套 4xx。状态集合与描述均由 response.constants
 * 的单一错误配置 ERROR_CATALOG 派生，不在这里另存文案。
 */
const GLOBAL_ERROR_STATUSES = SWAGGER_ERROR_STATUSES;

const JSON_CONTENT = 'application/json';

/** data 恒为 null 的成功操作（controller 返回 Promise<null>，插件不产 content，T031） */
const NULL_DATA_OPERATIONS = new Set<string>([
  'POST /auth/logout',
  'POST /users/delete',
]);

/** 成功 data 为「对象 | null」的只读单查操作（联合返回类型，插件只保留对象 $ref，T031） */
const NULLABLE_DATA_OPERATIONS = new Set<string>(['GET /users/detail']);

function operationKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/** data:null 的内联 schema（OpenAPI 3.0 用 nullable 表达） */
const NULL_DATA_SCHEMA = {
  type: 'object' as const,
  nullable: true,
  example: null,
};

const errorRef = () => ({
  $ref: `#/components/schemas/${ERROR_ENVELOPE_NAME}`,
});

/**
 * 统一成功外壳的基础模型：success/code/message 三字段。
 * 逐接口的 data 类型以 allOf 第二层内联 properties.data 表达，
 * 全文档共享这一个组件，不按 data 类型造子类。
 */
const SUCCESS_ENVELOPE_SCHEMA = {
  type: 'object' as const,
  required: ['success', 'code', 'message', 'data'],
  properties: {
    success: {
      type: 'boolean' as const,
      description: '业务是否成功；HTTP 2xx 恒为 true',
      example: true,
    },
    code: {
      type: 'number' as const,
      description: '业务码；恒等于 HTTP 状态码，成功固定 200',
      example: SUCCESS_CODE,
    },
    message: {
      type: 'string' as const,
      description: '提示信息；成功固定 ok',
      example: SUCCESS_MESSAGE,
    },
  },
};

/**
 * 统一错误外壳模型：success(false)/code/message/data(null)。
 * 与成功外壳对称，文档生成时注入，控制器无需 @ApiResponse。
 */
const ERROR_ENVELOPE_SCHEMA = {
  type: 'object' as const,
  required: ['success', 'code', 'message', 'data'],
  properties: {
    success: {
      type: 'boolean' as const,
      description: '业务是否成功；错误恒为 false',
      example: false,
    },
    code: {
      type: 'number' as const,
      description:
        '业务码；恒等于本次响应的 HTTP 状态码（400/401/403/404/409/500）',
    },
    message: {
      type: 'string' as const,
      description: '错误提示；参数校验失败时为字段错误数组',
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
      example: '用户名已存在',
    },
    data: { type: 'object' as const, nullable: true, example: null },
  },
};

type JsonSchema = Record<string, unknown>;
interface ResponseLike {
  description?: string;
  content?: Record<string, { schema?: JsonSchema; example?: unknown }>;
}

/** 判断 schema 是否已是本函数包裹产物，保证幂等 */
function isWrapped(schema: JsonSchema | undefined): boolean {
  return (
    !!schema &&
    Array.isArray(schema.allOf) &&
    (schema.allOf as JsonSchema[]).some(
      (part) => part.$ref === `#/components/schemas/${SUCCESS_ENVELOPE_NAME}`,
    )
  );
}

/** 2xx 成功响应的 schema 包进成功外壳；null-data 操作合成/标记 nullable（T031） */
function wrapResponse(response: ResponseLike, operation: string): ResponseLike {
  // 删除/登出：插件对 Promise<null> 不产 content，合成 data:null 外壳（幂等）
  if (NULL_DATA_OPERATIONS.has(operation)) {
    const existing = response.content?.[JSON_CONTENT]?.schema;
    if (existing && isWrapped(existing)) {
      return response;
    }
    return {
      ...response,
      content: {
        ...response.content,
        [JSON_CONTENT]: {
          schema: envelopeWith(NULL_DATA_SCHEMA),
        },
      },
    };
  }

  const media = response.content?.[JSON_CONTENT];
  if (!media?.schema || isWrapped(media.schema)) {
    return response;
  }
  const dataSchema = NULLABLE_DATA_OPERATIONS.has(operation)
    ? { ...(media.schema as JsonSchema), nullable: true }
    : media.schema;
  return {
    ...response,
    content: {
      ...response.content,
      [JSON_CONTENT]: {
        ...media,
        schema: envelopeWith(dataSchema),
      },
    },
  };
}

/** 成功外壳 allOf 结构 */
function envelopeWith(dataSchema: JsonSchema): JsonSchema {
  return {
    allOf: [
      { $ref: `#/components/schemas/${SUCCESS_ENVELOPE_NAME}` },
      { type: 'object', properties: { data: dataSchema } },
    ],
  };
}

/**
 * 把 2xx 响应键统一归一为运行时真实成功状态码 200，
 * 消除「删 @HttpCode 后 Swagger 插件对 POST 默认 201」与运行时的漂移。
 * 仅当存在唯一一个 2xx 键且不是 200 时迁移；其余情况原样返回。
 */
function normalizeSuccessKey(
  responses: Record<string, ResponseLike>,
): Record<string, ResponseLike> {
  const expected = HttpStatus.OK;
  const successKeys = Object.keys(responses).filter((key) => {
    const n = Number(key);
    return n >= 200 && n < 300;
  });
  if (successKeys.length !== 1 || Number(successKeys[0]) === expected) {
    return responses;
  }
  const [only] = successKeys;
  const next: Record<string, ResponseLike> = {};
  for (const [key, value] of Object.entries(responses)) {
    if (key === only) {
      next[String(expected)] = value;
    } else {
      next[key] = value;
    }
  }
  return next;
}

/** 某错误状态码的响应级示例体：code 必须与该状态码一致（覆盖共享模型，避免 UI 全显同一码） */
function errorExample(status: number): Record<string, unknown> {
  return {
    success: false,
    code: status,
    message: swaggerErrorDescription(status),
    data: null,
  };
}

/** 注入缺失的全局错误状态码；已存在的（含自定义描述）不覆盖 */
function injectErrors(
  responses: Record<string, ResponseLike>,
): Record<string, ResponseLike> {
  const next = { ...responses };
  for (const status of GLOBAL_ERROR_STATUSES) {
    if (next[status]) {
      continue;
    }
    next[status] = {
      description: swaggerErrorDescription(status),
      content: {
        [JSON_CONTENT]: {
          schema: errorRef(),
          example: errorExample(status),
        },
      },
    };
  }
  return next;
}

/**
 * 在 Swagger 文档生成后统一规整响应，免除控制器上的 @HttpCode、@ApiResponse：
 *
 * - 成功：2xx 键统一归一为 200，application/json
 *   schema 改写为 `{ allOf: [SuccessEnvelope, { data }] }`；
 * - 失败：每个非豁免操作补齐全套 400/401/403/404/409，错误体 $ref ErrorEnvelope；
 * - 豁免路径（`/`、`/health/*`）原样保留，不包裹、不注入、不归一；
 * - 幂等：已是包裹产物的 schema 不重复包裹，已有错误码不覆盖。
 *
 * 纯函数：不修改入参以外的全局状态（被改写节点浅拷贝），便于单测。
 */
export function wrapSuccessEnvelope(document: OpenAPIObject): OpenAPIObject {
  const paths: OpenAPIObject['paths'] = {};

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    if (!pathItem || isEnvelopeExcludedPath(path)) {
      paths[path] = pathItem;
      continue;
    }

    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
    const nextItem: Record<string, unknown> = { ...pathItem };
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation?.responses) {
        continue;
      }
      let responses = operation.responses as Record<string, ResponseLike>;
      responses = normalizeSuccessKey(responses);
      responses = injectErrors(responses);
      const finalResponses: Record<string, ResponseLike> = {};
      for (const [status, response] of Object.entries(responses)) {
        finalResponses[status] =
          Number(status) >= 200 && Number(status) < 300
            ? wrapResponse(response, operationKey(method, path))
            : response;
      }
      nextItem[method] = { ...operation, responses: finalResponses };
    }
    paths[path] = nextItem as OpenAPIObject['paths'][string];
  }

  return {
    ...document,
    paths,
    components: {
      ...document.components,
      schemas: {
        ...(document.components?.schemas ?? {}),
        [SUCCESS_ENVELOPE_NAME]: SUCCESS_ENVELOPE_SCHEMA,
        [ERROR_ENVELOPE_NAME]: ERROR_ENVELOPE_SCHEMA,
      },
    },
  };
}
