# Logging — 日志规范

本文档说明本服务的日志规范、字段定义、采集方式、保留策略与敏感信息处理要求。

## 1. 日志原则

- 结构化：统一 JSON 格式，便于检索与分析。
- 可追溯：关键操作必须包含 `traceId` 与 `requestId`。
- 分级清晰：不同级别用于不同场景，避免滥用。
- 不泄密：禁止记录敏感信息。
- 可观测：日志与指标、追踪联动。

## 2. 日志级别

| 级别    | 使用场景                           |
| ------- | ---------------------------------- |
| `error` | 系统错误、异常、需要立即关注的问题 |
| `warn`  | 潜在问题、可恢复异常、降级触发     |
| `info`  | 关键业务操作、请求入口与出口       |
| `debug` | 调试信息，仅开发与排查时开启       |

生产环境默认 `info`，排查时可临时调整为 `debug`。

## 3. 日志字段

| 字段        | 类型   | 说明             | 必填 |
| ----------- | ------ | ---------------- | ---- |
| `timestamp` | string | ISO 8601 时间戳  | 是   |
| `level`     | string | 日志级别         | 是   |
| `service`   | string | 服务名           | 是   |
| `env`       | string | 环境标识         | 是   |
| `traceId`   | string | 链路追踪 ID      | 是   |
| `requestId` | string | 请求 ID          | 是   |
| `userId`    | string | 用户标识（脱敏） | 否   |
| `method`    | string | HTTP 方法        | 否   |
| `path`      | string | 请求路径         | 否   |
| `status`    | number | 响应状态码       | 否   |
| `duration`  | number | 处理耗时（ms）   | 否   |
| `message`   | string | 日志内容         | 是   |
| `error`     | object | 错误信息与堆栈   | 否   |
| `context`   | object | 附加上下文       | 否   |

## 4. 日志示例

请求日志：

```json
{
  "timestamp": "2026-10-02T10:00:00.000Z",
  "level": "info",
  "service": "nestjs-app",
  "env": "production",
  "traceId": "a1b2c3d4",
  "requestId": "req-123456",
  "method": "GET",
  "path": "/api/v1/users/123",
  "status": 200,
  "duration": 45,
  "message": "request completed"
}
```

错误日志：

```json
{
  "timestamp": "2026-10-02T10:00:01.000Z",
  "level": "error",
  "service": "nestjs-app",
  "env": "production",
  "traceId": "a1b2c3d4",
  "requestId": "req-123456",
  "message": "failed to query user",
  "error": {
    "name": "MongoError",
    "message": "connection timeout",
    "stack": "..."
  }
}
```

## 5. 日志采集

| 项目     | 说明                                 |
| -------- | ------------------------------------ |
| 输出位置 | stdout / stderr                      |
| 采集方式 | 容器日志驱动 / Filebeat / Fluent Bit |
| 传输     | 加密传输至日志平台                   |
| 存储     | Elasticsearch / Loki                 |
| 查询入口 | Kibana / Grafana                     |

## 6. 日志保留

| 类型     | 保留周期 | 说明       |
| -------- | -------- | ---------- |
| 热数据   | 7 天     | 可快速查询 |
| 冷数据   | 30 天    | 归档存储   |
| 审计日志 | ≥ 180 天 | 按合规要求 |
| 错误日志 | ≥ 90 天  | 便于复盘   |

## 7. 敏感信息处理

- 禁止记录：密码、Token、密钥、身份证、银行卡、手机号。
- 必要字段需脱敏：如手机号 `138****1234`。
- 日志访问需权限控制，审计访问记录。
- 日志导出需审批。

## 8. 日志规范约束

- 关键链路必须记录入口与出口日志。
- 异常必须记录完整堆栈。
- 禁止使用 `console.log`，统一使用日志库。
- 禁止在循环中打印大量日志。
- 日志内容必须可读，避免无意义输出。

## 9. 相关文档

- 上级文档：[运维手册](./README.md)
- 架构概览：[架构总览](../architecture/overview.md)
- 故障处理手册：[runbook.md](./runbook.md)
- 可观测性：[observability.md](./observability.md)

## 📅 更新记录

> 只记重要变更，最新在上。完整历史见 Git。
