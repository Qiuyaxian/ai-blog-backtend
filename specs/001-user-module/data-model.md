# 数据模型：用户模块

> Phase 1 产物。实现细节以[用户模块设计文档](../../docs/architecture/design/user-module-design.md) §3 为准，本文件是 spec→tasks 之间的字段与状态契约。

## 实体：User（集合 `users`）

| 字段            | 类型         | 必填 | 默认    | 约束 / 索引                                  | 出参        |
| --------------- | ------------ | ---- | ------- | -------------------------------------------- | ----------- |
| `_id`           | ObjectId     | 是   | 自动    | 主键                                         | 映射为 `id` |
| `username`      | string       | 是   | —       | trim，长度 2–32，保留原大小写                | 是          |
| `usernameLower` | string       | 是   | —       | trim+lowercase；**唯一索引**；`select:false` | 否          |
| `email`         | string       | 是   | —       | trim+lowercase，≤254，邮箱正则；**唯一索引** | 是          |
| `password`      | string       | 是   | —       | 仅存 bcrypt 哈希（cost≥10）；`select:false`  | 否          |
| `isAdmin`       | boolean      | 否   | `false` | 仅管理员可写                                 | 是          |
| `createdAt`     | Date         | 是   | 自动    | `timestamps`                                 | 是          |
| `updatedAt`     | Date         | 是   | 自动    | `timestamps`                                 | 是          |
| `deletedAt`     | Date \| null | 否   | `null`  | `select:false`；非空即已软删                 | 否          |

### 索引

```text
users.usernameLower_1   unique
users.email_1           unique
```

- 唯一性最终由数据库索引裁决；Service 捕获 `E11000`，按 `keyPattern` 转 409（`USERNAME_EXISTS` / `EMAIL_EXISTS`）。
- 软删不释放唯一值：索引保持不含 `deletedAt` 条件的普通唯一索引，软删用户名/邮箱不能重新注册（FR-017）。

## 校验规则（来源 FR-002/003 与澄清）

- `username`：字符串，trim 后 2–32 字符；唯一性按 `usernameLower` 不区分大小写。
- `email`：合法邮箱形状，≤254，落库小写。
- `password`（仅入参明文）：长度 8–64，须同时匹配 `/[a-zA-Z]/` 与 `/\d/`；存库为 bcrypt 哈希。
- `isAdmin`：注册 DTO 不声明（白名单丢弃）；仅 `SetAdminDto` 接受，管理员专用。

## 状态与转换

```text
注册 ──▶ 活跃 (deletedAt=null, isAdmin=false)
                    │
        管理员 setAdmin(true/false)
                    │
        管理员 delete ──▶ 已软删 (deletedAt=时间)
                              - 不可登录
                              - 不进列表 / 详情 404
                              - 记录与唯一值保留
```

- 活跃 ↔ 管理员：仅管理员，受"至少一名未删除管理员"约束（降权唯一管理员 → 409）。
- 活跃 → 软删：仅管理员；删除唯一管理员 → 409；不可物理删除（FR-014）。
- 本期无"恢复软删"与自助注销。

## 常规查询过滤

所有面向业务的读取/查重/登录默认带 `deletedAt: null`：

- 注册查重、登录凭据校验、`findById`、`list`、管理员计数。
- `list`：`{ deletedAt:null }` 按 `_id` 游标倒序，`limit` 服务端封顶 50。

## 出参脱敏（UserResponseDto）

固定字段：`id, username, email, isAdmin, createdAt, updatedAt`。
任何路径禁止返回 `password, usernameLower, deletedAt, __v`，由纯函数 `toUserResponse(doc)` 集中转换。
