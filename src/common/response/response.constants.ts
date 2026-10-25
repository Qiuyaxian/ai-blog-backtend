/** 成功响应统一业务码 */
export const SUCCESS_CODE = 'SUCCESS';

/** 成功响应统一消息 */
export const SUCCESS_MESSAGE = 'ok';

/** 统一响应外壳：成功 data 为业务返回值，失败 data 恒为 null */
export interface ApiResponse<T> {
  code: string;
  data: T | null;
  message: string | string[];
  path: string;
  time: string;
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
