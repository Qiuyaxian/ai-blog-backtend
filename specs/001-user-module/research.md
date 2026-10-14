# Phase 0 研究记录：用户模块

> 技术取舍在 [ADR-002](../../docs/architecture/adr/ADR-002-user-module.md) 与[用户模块设计文档](../../docs/architecture/design/user-module-design.md)已定稿并经澄清。本文件只汇总决策、理由与替代方案，供 plan/tasks 引用；无未决澄清项。

## R1：角色用布尔 `isAdmin`，不建角色集合

- **决策**：单 `users` 集合 + 非必填布尔 `isAdmin`（缺省 false）。
- **理由**：系统仅"普通用户/管理员"两角色；角色集合与字符串数组属过度设计（YAGNI）。
- **替代**：独立 roles 集合多对多（扩展性强但当前无需求）；字符串 `role` 枚举（可作未来演进）。演进路径见 ADR-002 D1。

## R2：用户名大小写不敏感唯一 —— 冗余字段 `usernameLower`

- **决策**：`username` 保留原大小写；新增 `usernameLower`（trim+lowercase）建唯一索引；`email` 直接 `lowercase:true` 落库小写并唯一索引。
- **理由**：唯一索引默认大小写敏感，不归一会允许 `Name`/`name` 重复；直接小写化 username 会丢失展示形态。冗余字段比 MongoDB collation 索引更显式可控（collation 会隐式影响该集合所有比较）。
- **替代**：case-insensitive collation 索引（strength:2），因隐式影响面被否。
- **约束**：注册（及未来改名）写路径必须维护 `usernameLower`。

## R3：密码 bcrypt，强度在 DTO 校验

- **决策**：bcrypt cost ≥ 10；明文规则长度 8–64、须同时含字母与数字（澄清结论）；`password` 字段 `select:false`。
- **理由**：宪法 IV 硬性指定 bcrypt；信任边界统一在 DTO + 全局 ValidationPipe。
- **替代**：argon2（更强，但需先修宪，本期不做）。
- **已知上限**：bcrypt 72 字节输入上限，64 字符多字节极端输入由 bcrypt 报错转 400（设计文档 §5 `ponytail:`）。

## R4：权限走 Guard，注册不接受 `isAdmin`

- **决策**：注册 DTO 仅 username/email/password；`isAdmin` 只能经管理员接口 `POST /users/admin` 写入；RolesGuard + `@Roles('admin')`。
- **理由**：防权重赋值提权；满足 FR-005/FR-007。
- **依赖**：`request.user` 由后续登录模块注入；本模块定义读取约定与未认证 401，不实现令牌解析。

## R5：软删除 `deletedAt`，仅管理员，记录与唯一值保留

- **决策**：新增可选 `deletedAt`（`select:false`）；仅管理员 `POST /users/delete`；所有常规查询带 `deletedAt:null`；软删后不可登录、不进列表/详情；用户名/邮箱不释放（唯一索引不变）。
- **理由**：文章/评论未来引用用户，硬删除导致引用悬空；保留唯一值防冒充与历史归属混淆（澄清结论，FR-013/016/017）。
- **替代**：硬删除（引用悬空，被否）；用户自助注销（本期不做）。

## R6：最后管理员保护

- **决策**：降权或删除目标为管理员时，先统计 `{isAdmin:true, deletedAt:null}` 数量，≤1 则 409 `LAST_ADMIN_PROTECTED`。
- **已知上限**："统计+拒绝"在两管理员并发降权时有理论竞态；管理员为后台低频人工操作，概率可忽略（设计文档 §6 `ponytail:`），升级路径为名额文档/分布式锁。

## R7：HTTP 仅 GET/POST，POST 参数走 body

- **决策**：查询 GET；创建/更新/动作/删除一律 POST；不用 PUT/PATCH/DELETE；写操作标识（如目标 `id`）放 body，不用路径参数。
- **理由**：已写入 `docs/development/coding-style.md` §0/§2.4 团队硬约束。
- **接口**：见 `contracts/user-api.md`。

## R8：依赖与环境

- 需新增 `bcrypt`、`class-validator`、`class-transformer`（仓库当前均未安装），按 AGENTS.md §8 须人工评审后 `pnpm add`，不由 AI 直接安装。
- MongoDB 连接、`autoIndex` 环境策略、E11000 处理遵循 ADR-001 与集成设计文档。
