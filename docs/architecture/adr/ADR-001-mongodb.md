# ADR-001：采用 MongoDB 作为核心数据存储

## 状态

已确认（Confirmed）

> 状态枚举遵循 `AGENTS.md` §8：草稿 Draft → 待确认 Pending → 已确认 Confirmed。ADR 通用术语中的 Accepted 在本仓库对应 Confirmed（评审通过、作为当前基线）。

## 日期

2026-10-12（初稿 2026-10-11，2026-10-12 评审确认）

## 背景与约束

- 业务为博客类内容系统，核心对象（文章正文、标签、嵌套评论）天然呈文档/树形结构，字段随迭代频繁增减。
- 团队既有经验集中在 Node.js/TypeScript 与 Mongoose，暂无专职 DBA；初期数据量与 QPS 预期为单副本集可承载（< 1TB），不预设分片。
- 优先目标是快速迭代与对象级读写性能；跨集合的强一致多表事务不是主导需求（计数、列表等可接受最终一致）。

## 决策

系统整体背景与约束见《架构总览》。本决策针对核心数据存储选型：采用 **MongoDB 7.0+** 作为核心数据存储，通过以下方式集成：

1. NestJS 侧使用 @nestjs/mongoose 9.x + Mongoose 6.x 作为 ODM。主版本与仓库现有 NestJS 9 基线对齐（@nestjs/mongoose 主版本随 NestJS 主版本走）；在框架整体升级到 NestJS 10/11 之前，不引入 Mongoose 7/8。
2. 生产部署采用三节点副本集，写关注 majority。
3. 连接管理通过 MongooseModule.forRootAsync + @nestjs/config。
4. Schema 注册使用 forFeature，Service 通过 @InjectModel 注入。
5. 索引遵循 ESR 准则，集中声明。

## 考虑的替代方案

- **PostgreSQL**：关系模型本身性能并不弱（合理索引下 JOIN 很快），不以此作为否决理由。真正不选的原因是：文章/评论等文档与嵌套结构需额外做对象-关系映射、频繁增减字段需要迁移流程，与"快速迭代 schema"的目标不合，且团队当前缺少关系库调优与运维经验。若未来跨实体强一致事务成为主导需求，应重新评估此选项（见《重新评估条件》）。
- **DynamoDB**：供应商锁定风险；本地开发体验较差；复杂聚合查询能力有限，需要依赖额外计算层；与 NestJS 生态集成度不如 Mongoose。
- **Cassandra**：写入性能优秀，但查询模式受限（需预定义分区键），不适合当前多变的查询需求；NestJS 生态支持较弱。

## 重新评估条件

出现以下任一情况，应重新评估本选型，而非默认继续：

- 跨集合/跨实体的强一致多文档事务成为主要写路径，事务开销与复杂度超过嵌入/补偿方案收益。
- 数据模型演变为大量多对多关系与即席聚合（ad-hoc analytics），文档模型与 `$lookup` 频繁成为瓶颈。
- 数据量或写入量进入分片区间，且团队仍无 MongoDB 分片运维能力。
- 团队引入专职 DBA 或关系型栈成为组织标准。

## 后果

### 正面

- **Schema 灵活性**：新增字段无需停机迁移，支持快速迭代。
- **读写性能**：文档模型将关联数据内嵌，减少 JOIN 操作，单次读取即可获取完整业务对象；配合 Redis 缓存热点内容可进一步降低延迟。
- **水平扩展**：当数据量增长到单节点瓶颈时，可通过分片集群无缝扩展。
- **开发效率**：`@nestjs/mongoose` 提供装饰器风格的 Schema 定义与依赖注入，减少样板代码，类型安全。

### 负面

- **无原生 JOIN**：跨集合查询需依赖 `$lookup` 或应用层聚合，复杂关联场景性能不如关系型数据库。
- **事务限制**：多文档事务仅在副本集/分片集群中可用，且相比关系型数据库的事务有更高开销。
- **数据一致性需应用层保障**：在默认写关注级别下，应用需要显式处理最终一致性场景。

### 中性

- 团队需要学习 MongoDB 特有的查询语法、索引策略（ESR 准则）和聚合管道。
- 需要建立数据建模规范，明确嵌入与引用的选择边界。
- 需要统一 Schema 声明、索引声明与 Service 注入的写法约定（见《MongoDB + NestJS 集成设计文档》）。

## 相关文档

- [MongoDB + NestJS 集成设计文档](../design/mongodb-integration-design.md)
- [架构概览](../overview.md)
- [安全与合规](../../operations/security.md)
- [可观测性](../../operations/observability.md)

## 参考

- [NestJS MongoDB 官方文档（中文）](https://docs.nestjs.cn/techniques/mongo/)
- [NestJS MongoDB 官方文档（英文）](https://docs.nestjs.com/techniques/mongodb)
- [Mongoose 官方文档](https://mongoosejs.com/docs/)
- [MongoDB 数据建模最佳实践](https://www.mongodb.com/zh-cn/docs/v8.0/data-modeling/best-practices/)
- [MongoDB 副本集高可用设计](https://www.mongodb.com/docs/manual/replication/)
- [索引策略与 ESR 准则](https://www.mongodb.com/docs/manual/applications/indexes/)

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-12 @架构组：P2 修订——状态对齐 AGENTS §8 枚举（Accepted → Confirmed）并注明初稿/确认日期；相关文档链接由绝对路径改为相对路径。
- 2026-10-12 @架构组：P1 修订——新增"背景与约束""重新评估条件"；纠正否决 PostgreSQL 的论据（不以 JOIN 性能为由，改为 schema 演进与团队匹配度）。
- 2026-10-12 @架构组：ODM 版本对齐仓库基线，明确 @nestjs/mongoose 9.x + Mongoose 6.x（NestJS 9），框架升级前不引入 Mongoose 7/8。
- 2026-10-11 @架构组：初始版本（NestJS + Mongoose）
