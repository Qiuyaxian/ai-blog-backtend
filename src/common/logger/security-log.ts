import { Logger } from '@nestjs/common';

/** 安全审计日志统一上下文，便于按 context 检索安全事件 */
const SECURITY_LOG_CONTEXT = 'security';

const securityLogger = new Logger(SECURITY_LOG_CONTEXT);

/**
 * 登录锁定命中安全日志：真实原因码只入服务端日志（可按 requestId 关联），
 * 对外仍回统一 401（防账号枚举/主动锁死他人）。不记录密码/令牌。
 * 全局可复用：任何模块命中账号锁定均调用本函数，避免各服务各写一份。
 */
export function logLoginLockHit(userId: string): void {
  securityLogger.warn(
    `login rejected: account locked, code=ACCOUNT_LOCKED, userId=${userId}`,
  );
}
