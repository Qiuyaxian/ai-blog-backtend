import { HttpStatus } from '@nestjs/common';

/** 成功响应统一业务码：数字，恒等于 HTTP 成功状态 200 */
export const SUCCESS_CODE: number = HttpStatus.OK;

/** 成功响应统一消息 */
export const SUCCESS_MESSAGE = 'ok';

/** 统一响应外壳：code 为数字且恒等于 HTTP 状态码；成功 data 为业务返回值（可为 null/[]/{}/原始值），失败 data 恒为 null */
export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string | string[];
  data: T | null;
}

/**
 * 错误配置的唯一权威来源（运行时文案与 Swagger 文档同源派生）。
 *
 * 每个业务码一条：
 * - `status`：该码对应的 HTTP 状态（异常类型与此一致）；
 * - `message`：面向客户端的中文文案（过滤器据此出 message）；
 * - `docLabel?`：该 HTTP 状态在 Swagger 文档里的分类标签，**每个状态恰好挂在
 *   一个代表码上**；挂了 docLabel 的状态才进入文档全局注入集合，故 500 不挂。
 *
 * Service/Guard 仍只抛稳定字符串键，HTTP 状态由异常类型决定；过滤器据键查到
 * status 后，外壳 `code` 直接输出该数字状态码（成功 200、失败 4xx/5xx），
 * 字符串键不进入响应体。
 */
const ERROR_CATALOG_RAW = {
  VALIDATION_ERROR: {
    status: 400,
    message: '参数校验失败',
    docLabel: '参数校验失败',
  },
  INVALID_ID: { status: 400, message: '无效的资源 ID' },
  UNAUTHENTICATED: {
    status: 401,
    message: '未登录或令牌无效',
    docLabel: '未登录或令牌无效',
  },
  INVALID_CREDENTIALS: { status: 401, message: '用户名或密码错误' },
  FORBIDDEN: {
    status: 403,
    message: '无访问权限',
    docLabel: '已登录但权限不足',
  },
  USER_NOT_FOUND: {
    status: 404,
    message: '用户不存在',
    docLabel: '资源不存在',
  },
  USERNAME_EXISTS: {
    status: 409,
    message: '用户名已存在',
    docLabel: '业务冲突',
  },
  EMAIL_EXISTS: { status: 409, message: '邮箱已存在' },
  LAST_ADMIN_PROTECTED: { status: 409, message: '最后一个管理员不可删除' },
  // 500 仅服务端兜底：不挂 docLabel，故不进入 Swagger 错误集合
  INTERNAL_ERROR: { status: 500, message: '服务器内部错误' },
} as const;

/** 错误目录单条结构：HTTP 状态 + 客户端文案 + 可选文档分类标签 */
export interface ErrorCatalogEntry {
  status: number;
  message: string;
  docLabel?: string;
}

/** 权威错误目录：键为字面量错误码，值统一带可选 docLabel */
export const ERROR_CATALOG: {
  [K in keyof typeof ERROR_CATALOG_RAW]: (typeof ERROR_CATALOG_RAW)[K] &
    ErrorCatalogEntry;
} = ERROR_CATALOG_RAW;

/** 业务错误码联合类型 */
export type ErrorCode = keyof typeof ERROR_CATALOG;

/**
 * 运行时文案表：code → message，由 {@link ERROR_CATALOG} 派生（禁止另存一份）。
 * 过滤器对字符串 code 的业务异常统一查此表，未登记码回退异常原始 message。
 */
export const ERROR_CODES: Record<ErrorCode, string> = Object.fromEntries(
  Object.entries(ERROR_CATALOG).map(([code, entry]) => [code, entry.message]),
) as Record<ErrorCode, string>;

/** 进入 Swagger 全局错误注入的 HTTP 状态集合（带 docLabel 的状态，按码声明顺序去重） */
export const SWAGGER_ERROR_STATUSES: number[] = [
  ...new Set(
    Object.values(ERROR_CATALOG)
      .filter((entry) => typeof entry.docLabel === 'string')
      .map((entry) => entry.status),
  ),
];

/**
 * 某 HTTP 状态的 Swagger 文档描述：`标签（CODE1 / CODE2）`，全部由 catalog 派生。
 * 未配置 docLabel 的状态（如 500 或未登记码）fail-fast，避免产出空描述错误契约。
 */
export function swaggerErrorDescription(status: number): string {
  const entries = Object.entries(ERROR_CATALOG).filter(
    ([, entry]) => entry.status === status,
  );
  const label = entries.find(
    ([, entry]) => typeof entry.docLabel === 'string',
  )?.[1].docLabel;
  if (!label) {
    throw new Error(
      `swaggerErrorDescription: 未登记文档标签的错误状态码 ${status}`,
    );
  }
  return `${label}（${entries.map(([code]) => code).join(' / ')}）`;
}

/**
 * 判断请求路径是否豁免统一外壳。
 *
 * 豁免：根探活 `GET /`（纯文本）与健康探针 `/health`、`/health/*`
 * （Terminus 原生 JSON，含 ready 失败 503，监控/探针不感知外壳）。
 */
export function isEnvelopeExcludedPath(path: string): boolean {
  return path === '/' || path === '/health' || path.startsWith('/health/');
}
