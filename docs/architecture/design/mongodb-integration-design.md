# MongoDB + NestJS 集成设计文档

> 状态：已确认（Confirmed）
> 日期：2026-10-13（初稿 2026-10-12）
>
> 状态枚举遵循 `AGENTS.md` §8：草稿 Draft → 待确认 Pending → 已确认 Confirmed。本文档是 [ADR-001](../adr/ADR-001-mongodb.md)（已确认）的实现展开，连接配置、健康检查与模块集成已落地。

## 1. 概述

**文档目的**：定义 MongoDB 在 NestJS 应用中的集成方案，包括数据建模、连接配置、模块集成、安全与运维，为开发团队提供实现依据。

**适用范围**：本文档聚焦 MongoDB 与 NestJS 的集成细节。系统整体架构、模块边界与质量属性见[《架构总览》](../overview.md)。

**技术栈**：

| 组件             | 版本 | 用途                        |
| ---------------- | ---- | --------------------------- |
| NestJS           | 9.x  | 应用框架（仓库当前基线）    |
| @nestjs/mongoose | 9.x  | NestJS 官方 Mongoose 集成包 |
| Mongoose         | 6.x  | MongoDB ODM                 |
| MongoDB          | 7.0+ | 核心文档数据库              |
| @nestjs/config   | 2.x  | 配置管理（仓库当前版本）    |

> 版本对齐约束：`@nestjs/mongoose` 主版本随 NestJS 主版本走（9 ↔ NestJS 9 + Mongoose 6）。本表与 `package.json` 当前基线一致；在框架整体升级到 NestJS 10/11 之前，不引入 Mongoose 7/8，否则会触发 peer 依赖冲突。

NestJS 支持两种方式集成 MongoDB：使用内置的 TypeORM 模块（含 MongoDB 连接器），或使用最流行的 MongoDB 对象建模工具 Mongoose。本文档采用 **Mongoose + @nestjs/mongoose 官方包** 的方案。

数据流：客户端请求经 Controller 进入 Service，Service 通过 `@InjectModel` 注入的 Model 访问 MongoDB 副本集。**写操作走 Primary；读操作默认也走 Primary（`primary`/`primaryPreferred`），仅对明确可容忍复制延迟的场景逐查询设置从库读偏好**（读偏好策略见 §3.7）。

## 2. Schema 写法约定

### 2.1 建模原则

| 场景                     | 推荐方式 | 理由                             |
| ------------------------ | -------- | -------------------------------- |
| 实体间为 “has-a” 关系    | 嵌入     | 减少查询次数，单文档读取完整对象 |
| 子方数量少且访问频繁     | 嵌入     | 避免 `$lookup` 的性能开销        |
| 子方数量大或独立存在     | 引用     | 避免文档无限增长，支持独立操作   |
| 跨集合事务需求           | 引用     | 减少事务范围，降低锁竞争         |
| 数据写入频繁且不同时更新 | 引用     | 避免文档级锁竞争                 |

**嵌入前必须先问两个硬边界**：

1. **单文档 16MB 上限**：BSON 单文档最大 16MB。子文档会随业务无限增长的（评论、操作日志、文章修订历史），**禁止嵌入**，必须引用或分桶（bucketing）。
2. **嵌入数组的无界增长**：即使暂时没到 16MB，无上限的数组会让父文档持续变大、重写成本上升。数量可预估且有上限的（如一篇文章的少量标签、固定枚举配置）才嵌入。

博客场景拍板：

| 关系            | 决策                                   | 理由                               |
| --------------- | -------------------------------------- | ---------------------------------- |
| 文章 → 标签     | 嵌入标签快照（id+名）                  | 数量少、随文章一起读、避免改名牵连 |
| 文章 → 作者     | 引用作者 id，必要时冗余作者名/头像快照 | 作者独立存在、独立更新             |
| 文章 → 评论     | **引用**（独立 comments 集合）         | 评论无界增长，嵌入会撑爆 16MB      |
| 评论 → 子评论   | 引用或按楼层/分页查询                  | 嵌套评论无界，不整树嵌入           |
| 用户 → 资料字段 | 嵌入                                   | has-a、一对一、同时读写            |

### 2.2 Schema 声明写法

NestJS 中使用 `@nestjs/mongoose` 装饰器声明 Schema，核心 API 为 `@Schema()`、`@Prop()` 和 `SchemaFactory.createForClass()`。

**基本结构**

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type XxxDocument = HydratedDocument<Xxx>;

@Schema({ timestamps: true, collection: 'xxx' })
export class Xxx {
  @Prop({ required: true })
  field: string;
}

export const XxxSchema = SchemaFactory.createForClass(Xxx);
```

**约定**：

- 每个集合一个 `*.schema.ts` 文件，放在对应业务模块的 `schemas/` 目录下。
- 类名使用单数大驼峰（如 `User`），`collection` 显式指定为复数小写（如 `users`），避免依赖默认推断。
- 统一导出 `XxxDocument` 类型别名，供 Service 层使用。
- 通过 `SchemaFactory.createForClass()` 生成 Schema 实例，不要手动 `new mongoose.Schema()`。
- 嵌入子文档使用独立的 `@Schema({ _id: false })` 类，通过 `@Prop({ type: [SubSchema] })` 引用。

### 2.3 `@Prop()` 常用选项

| 选项          | 用途                         | 示例                                    |
| ------------- | ---------------------------- | --------------------------------------- |
| `required`    | 必填校验，支持自定义错误消息 | `required: [true, 'Email is required']` |
| `default`     | 默认值                       | `default: 'zh-CN'`                      |
| `unique`      | 创建唯一索引（非校验器）     | `unique: true`                          |
| `index`       | 单字段索引                   | `index: true`                           |
| `enum`        | 枚举校验                     | `enum: ['user', 'admin']`               |
| `lowercase`   | 自动转小写                   | `lowercase: true`                       |
| `trim`        | 去首尾空格                   | `trim: true`                            |
| `maxlength`   | 最大长度                     | `maxlength: 50`                         |
| `min` / `max` | 数值范围                     | `min: 0`                                |
| `match`       | 正则校验                     | `match: [/\S+@\S+/, 'Invalid email']`   |
| `immutable`   | 创建后不可修改               | `immutable: true`                       |
| `ref`         | 引用其他集合（存 ObjectId）  | `{ type: Types.ObjectId, ref: 'User' }` |

### 2.4 索引声明

索引统一在 Schema 定义之后通过 `XxxSchema.index()` 声明，保持集中可查：

```typescript
XxxSchema.index({ email: 1 }, { unique: true });
XxxSchema.index({ roles: 1, createdAt: -1 });
```

**ESR 准则**：复合索引字段按 **Equality → Sort → Range** 顺序排列。低基数字段（如布尔值）不应单独建索引。

**设计要点**：

- 每个集合的索引数量控制在 5–7 个以内，避免写入性能下降。
- 使用 `explain('executionStats')` 验证查询是否命中索引。
- 定期通过 `$indexStats` 识别未使用的索引。
- 避免在 `@Prop()` 中同时使用 `unique: true` 与 `XxxSchema.index()` 声明同一字段，二者选其一。

**唯一索引与上线注意**：

- `unique: true` 只是在模型初始化时触发创建唯一索引，**不是 Mongoose 校验器**：运行期写入重复值不会走 `ValidationError`，而是由 MongoDB 驱动抛出 `E11000` 重复键错误，Service 层须显式捕获并转为业务错误（如 409）。
- 集合中若已存在重复数据，创建唯一索引会直接失败。上线前需先用迁移脚本查重、清洗，再建索引。
- **自动建索引按环境区分**：Mongoose 默认 `autoIndex: true`，会在启动时尝试 `createIndex`。开发环境可保留；**生产必须 `autoIndex: false`**（见 §3.3），避免应用启动期建大索引带来的锁与性能冲击，索引改由迁移脚本 / `mongosh` 在低峰显式创建。

> 各业务集合的具体字段、索引清单见对应业务模块设计文档，本文档不重复。

## 3. 集成方案

### 3.1 依赖安装

```bash
pnpm add @nestjs/mongoose@^9 mongoose@^6
```

> `@nestjs/config` 仓库已安装（2.x），无需重复添加。统一使用 **pnpm**，不要使用 npm/yarn。
>
> 按 `AGENTS.md` §7 约束，AI 代理不得自行安装、升级、删除 `package.json` 依赖。上述命令仅说明所需依赖及版本，实际变更需人工评审后执行，本文档不直接触发安装。

### 3.2 环境配置

仓库按 `NODE_ENV` 自动加载 `.env.local` / `.env.uat` / `.env.production`（默认 `local`），无 `development` 环境。MongoDB 相关变量写入对应环境文件，本地开发写入 `.env.local`：

```bash
# .env.local
MONGODB_URI=mongodb://user:pass@host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0&authSource=admin
MONGODB_MAX_POOL_SIZE=50
MONGODB_MIN_POOL_SIZE=5
```

### 3.3 根模块配置

`src/app.module.ts` 已全局注册 `ConfigModule`（`isGlobal: true`，`envFilePath` 默认为 `.env.local`）。集成时只需在 `imports` 中追加 `MongooseModule.forRootAsync`，不要重复声明 `ConfigModule`：

```typescript
// app.module.ts（仅展示 MongoDB 增量部分）
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

// imports 数组中，ConfigModule.forRoot({...}) 之后追加：
MongooseModule.forRootAsync({
  inject: [ConfigService], // ConfigModule 已 isGlobal，无需再 imports: [ConfigModule]
  useFactory: (config: ConfigService) => ({
    uri: config.get<string>('MONGODB_URI'),
    maxPoolSize: config.get<number>('MONGODB_MAX_POOL_SIZE', 50),
    minPoolSize: config.get<number>('MONGODB_MIN_POOL_SIZE', 5),
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    retryWrites: true,
    w: 'majority',
    // 生产关闭自动建索引，由迁移/mongosh 统一管理（见 §2.4）
    autoIndex: process.env.NODE_ENV !== 'production',
  }),
}),
```

> 现有 `ConfigModule.forRoot` 的 `envFilePath` 保持 `` `.env.${process.env.NODE_ENV || 'local'}` `` 不变，不要改成 `development`——仓库不存在 `.env.development`。
>
> `forRoot()` 接受与 `mongoose.connect()` 相同的配置对象；`forRootAsync` 结合 `ConfigService` 从环境变量动态加载。

### 3.4 业务模块注册写法

NestJS 中使用 `MongooseModule.forFeature()` 在业务模块中注册 Schema，使其生成的 Model 可被同模块的 Service 注入。

**基本结构**

```typescript
// xxx/xxx.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Xxx, XxxSchema } from './schemas/xxx.schema';
import { XxxService } from './xxx.service';
import { XxxController } from './xxx.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Xxx.name, schema: XxxSchema }])],
  controllers: [XxxController],
  providers: [XxxService],
  exports: [XxxService],
})
export class XxxModule {}
```

**约定**：

- `forFeature()` 的参数为数组，可一次注册多个 Schema：`[{ name: User.name, schema: UserSchema }, { name: Role.name, schema: RoleSchema }]`。
- `name` 统一使用 `Xxx.name`（即类名字符串），与 `@InjectModel(Xxx.name)` 保持一致。
- `schema` 使用 `SchemaFactory.createForClass()` 生成的实例，不要直接传入原始 Schema 定义对象。
- 仅注册当前模块用到的 Schema，避免 `forFeature` 跨模块重复注册；跨模块使用时通过 `exports` 导出 Service，而不是导出 Model。
- 根模块的 `forRoot` 只建立连接，不注册具体 Schema；Schema 一律由业务模块通过 `forFeature` 注册。

> **注意**：`forFeature` 注册的 Model 作用域限于当前模块。若其他模块也需要该 Model，应优先复用已导出的 Service，或在接收方模块中再次 `forFeature` 注册（Mongoose 会自动复用同一连接与 Schema）。

### 3.5 Service 层注入写法

NestJS 中使用 `@InjectModel()` 将 `forFeature` 注册的 Model 注入 Service，核心 API 为 `@InjectModel()` 与 `Model<XxxDocument>`。

**基本结构**

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Xxx, XxxDocument } from './schemas/xxx.schema';

@Injectable()
export class XxxService {
  constructor(
    @InjectModel(Xxx.name)
    private readonly xxxModel: Model<XxxDocument>,
  ) {}

  async findById(id: string): Promise<XxxDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid id'); // 信任边界先拦，避免 CastError
    }
    return this.xxxModel.findById(id).exec();
  }
}
```

**约定**：

- `@InjectModel(Xxx.name)` 的参数须与 `forFeature` 中注册的 `name` 一致。
- 注入类型统一为 `Model<XxxDocument>`，不直接操作 `Connection` 或 `MongoClient`（事务需要连接时除外，见 §3.8）。
- 所有查询以 `.exec()` 结尾，返回 Promise，便于 `async/await`。
- 查询条件、更新操作使用 Mongoose 的链式 API，不在 Service 中拼接原生查询对象。
- **外部传入的 ObjectId 必须在信任边界校验**：非法 id（非 24 位 hex）直接透传给 `findById` 会抛 `CastError`。用 `Types.ObjectId.isValid()` 提前拦截并返回 400，或用全局异常过滤器把 `CastError` 统一映射为 400，不要让它漏成 500。
- 具体业务的聚合、事务写法见 §3.8；本文档只约定注入方式与通用写法。

**分页约定（列表默认用游标分页）**：

- 列表查询默认使用基于 `_id`（或 `createdAt` + `_id` 复合游标）的**游标分页**，不要用大偏移量的 `skip`：

```typescript
async findPosts(limit: number, cursor?: string) {
  const filter: FilterQuery<PostDocument> = {};
  if (cursor && Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }
  const docs = await this.postModel
    .find(filter)
    .sort({ _id: -1 })
    .limit(Math.min(limit, 50)) // 服务端封顶，防止一次拉取过多
    .exec();
  const nextCursor = docs.length ? docs[docs.length - 1]._id.toString() : null;
  return { docs, nextCursor };
}
```

- `skip` 仅用于小页码的管理后台；深翻页（`skip` 很大）会扫描并丢弃大量文档，性能差，在线接口禁用。
- `limit` 必须在服务端封顶，不接受前端传入的无上限值。

> **注意**：`XxxDocument` 为 `HydratedDocument<Xxx>` 的别名，在 Schema 文件中导出，不要在 Service 中重复定义。

### 3.6 连接池管理

连接池通过 `forRoot` 或 `forRootAsync` 的配置对象传递，NestJS 在应用启动时自动初始化连接，并在关闭时优雅释放。

| 参数                       | 推荐值       | 说明                       |
| -------------------------- | ------------ | -------------------------- |
| `maxPoolSize`              | 50（生产）   | 最大连接数，防止连接耗尽   |
| `minPoolSize`              | 5            | 最小保持连接数             |
| `maxIdleTimeMS`            | 60000        | 空闲连接超时（ms）         |
| `serverSelectionTimeoutMS` | 5000         | 服务器选择超时（ms）       |
| `socketTimeoutMS`          | 30000        | Socket 超时（ms）          |
| `w`                        | `'majority'` | 写关注：多数节点确认后返回 |

> **注意**：生产环境中 `maxPoolSize` 的建议初始值为 CPU 核数 × 2，需根据实际并发量调整。未设置连接池上限是生产环境中连接耗尽的常见原因。

### 3.7 读偏好（Read Preference）

副本集的 Secondary 靠 oplog 异步复制，存在**复制延迟**，读到的可能是旧数据。因此从库读不是默认优化项，必须按场景选择：

| 读偏好               | 用途                     | 适用场景                                          |
| -------------------- | ------------------------ | ------------------------------------------------- |
| `primary`（默认）    | 只读主节点，保证最新数据 | 所有用户交互读写、写后读（发文后刷新等）          |
| `primaryPreferred`   | 优先主，主不可用时读从   | 一般可接受短暂降级的读，仍以最新数据为主          |
| `secondaryPreferred` | 优先从，从不可用时读主   | **仅限**后台报表、统计、feed 流等可容忍延迟的场景 |
| `secondary`          | 只读从                   | 离线分析，不用于在线请求                          |

约定：

- **不要在 `forRoot` 全局把读偏好设成 `secondaryPreferred`**，否则"发文后立刻看不到""自己评论看不到"会成为普遍故障。
- 需要从库读时，在**具体查询**上逐一声明，缩小影响面：

```typescript
// 仅该查询走从节点：后台统计等可容忍延迟场景
return this.postModel
  .aggregate([...])
  .read('secondaryPreferred')
  .exec();
```

- 用户写操作之后的读取（如提交评论后重新拉取列表）必须走 Primary。
- `w: 'majority'` 只保证写入被多数节点确认，不改变读一致性；读旧数据的风险仍由读偏好决定。

### 3.8 多文档事务

MongoDB 多文档事务仅在副本集/分片集群可用，且在 `w: majority` 下有明显延迟开销。**默认应通过数据建模避免事务，而不是依赖事务**：

1. 优先用**嵌入 + 单文档原子写**：需要一起变更的字段放进同一文档，单文档更新天然原子。
2. 需要跨文档但可容忍短暂不一致时，用**应用层补偿/对账**（如计数冗余字段异步修正），不走事务。
3. 只有多个集合/文档必须**同时成功或同时回滚**（如转账类强一致场景）才用事务。

确需事务时，通过注入的连接以 `session` 贯穿所有操作：

```typescript
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class XxxService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
  ) {}

  async createWithCounter(dto: CreatePostDto) {
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(async () => {
        const [post] = await this.postModel.create([dto], { session });
        await this.counterModel.updateOne(
          { _id: 'post_count' },
          { $inc: { seq: 1 } },
          { session },
        );
        return post;
      });
    } finally {
      await session.endSession();
    }
  }
}
```

要点：事务内**每一次**读写都必须传同一个 `session`，漏传的操作不在事务内；事务应尽量短，不在事务内做外部调用（HTTP、发消息）；Mongoose 6 的 `create` 传 session 需用数组形式 `create([doc], { session })`。

## 4. 安全设计

### 4.1 认证

- 使用 **SCRAM-SHA-256** 进行 MongoDB 用户认证，创建最小权限的应用专用账户。
- 认证数据库统一指定为 `admin`。
- 连接字符串中的凭据通过环境变量注入，不硬编码在代码中。

### 4.2 传输加密

- 启用 **TLS/SSL** 加密所有客户端与 MongoDB 之间的连接。
- 副本集节点间通信同样启用 TLS。

```yaml
# mongod.conf 关键配置
net:
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/ssl/mongodb/server.pem
    CAFile: /etc/ssl/mongodb/ca.pem
```

服务端启用 `requireTLS` 后，客户端连接串必须显式开启 TLS，否则握手失败。`MONGODB_URI` 使用带 `tls=true` 的副本集串，或托管集群的 `mongodb+srv://`（SRV scheme 默认启用 TLS）：

```bash
# 自建副本集：注意是 mongodb:// + tls=true，不是裸 mongodb://
MONGODB_URI=mongodb://user:pass@host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0&authSource=admin&tls=true
# 托管集群（Atlas 等）：mongodb+srv 默认 tls
MONGODB_URI=mongodb+srv://user:pass@cluster.example.mongodb.net/mydb?retryWrites=true&w=majority
```

> §3.2 的连接串仅为占位示例、未含 `tls=true`；**生产/预发环境的实际 `MONGODB_URI` 必须带 TLS 参数**，本地开发（§5.6 单节点副本集、无鉴权）才使用不带 TLS 的明文串。

### 4.3 授权

| 应用账户    | 角色                                    | 权限范围     |
| ----------- | --------------------------------------- | ------------ |
| `app_rw`    | `readWrite`                             | 仅业务数据库 |
| `app_ro`    | `read`                                  | 报表服务只读 |
| `admin_ops` | `userAdminAnyDatabase` + `clusterAdmin` | 运维管理     |

### 4.4 网络安全

- MongoDB 实例部署在私有子网中，仅允许 NestJS 应用服务器 CIDR 访问 27017 端口。
- 禁用 `0.0.0.0` 绑定，仅监听内网 IP。
- 在 NestJS 中通过 `ConfigModule` 管理连接字符串，确保敏感信息不进入代码仓库。

## 5. 部署与运维

### 5.1 健康检查

NestJS 提供 `MongooseHealthIndicator`，可通过 `@nestjs/terminus` 集成 MongoDB 健康检查。配置后，健康检查端点将返回 MongoDB 运行状态的 HTTP 状态码。

> `@nestjs/terminus` 仓库**尚未安装**，需新增并与框架基线对齐使用 **9.x**（`pnpm add @nestjs/terminus@^9`）。按 `AGENTS.md` §7，依赖变更需人工评审，不由本文档直接执行。

```typescript
// health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.mongoose.pingCheck('mongodb')]);
  }
}
```

探针使用约定：

- **liveness 与 readiness 分开**：liveness 只反映进程是否存活（不打 DB），readiness 才执行上面的 `pingCheck`。否则 MongoDB 短暂抖动时所有 Pod 因 liveness 失败被反复重启，放大故障。
- **DB ping 需节流**：高副本数 + 高频探针会把一次 DB 抖动放大成大量 ping。对 ping 结果做短 TTL 缓存（如 5s 内复用结果），或由 readiness 端点控制探测频率。
- ping 失败的判定与"连续失败 N 次告警"以 [可观测性 · 告警规则](../../operations/observability.md#62-告警规则) 为准。

### 5.2 监控指标

MongoDB 各项告警**阈值、分级、通知渠道统一以运维文档为准，本文不重复定义**：

- 连接数、复制延迟、磁盘、副本集状态阈值：见 [可观测性 · MongoDB 指标](../../operations/observability.md#42-mongodb)。
- 文章详情/列表、登录等接口的 P99 目标：见 [可观测性 · SLO](../../operations/observability.md#7-slo--sli)。

本文只补充运维侧采集时的**指标来源**（这些是 MongoDB 特有取数口径）：

| 指标         | 来源                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| 连接池使用   | 驱动连接池指标 + `db.serverStatus().connections`                                 |
| 复制延迟     | `rs.printSecondaryReplicationInfo()` / `replSetGetStatus`（optime 与主节点差值） |
| 慢查询 / P99 | 慢查询日志（profiler，按慢查询阈值 `slowms` 采样）+ 应用侧 APM                   |
| 磁盘使用     | 节点主机磁盘监控（非 DB 内部指标）                                               |
| 页面错误     | `db.serverStatus().extra_info.page_faults`                                       |

> 复制延迟、磁盘、副本集状态应由 Prometheus 的 MongoDB exporter 从副本集各节点统一抓取；应用侧只暴露自身连接池与请求延迟，避免在每个服务里重复实现 DB 指标采集。

### 5.3 备份策略

备份范围、频率、保留周期、加密、恢复流程、演练频率与 **RTO/RPO 目标统一以运维手册为准**，本文不重复：见 [备份与恢复](../../operations/backup.md)（MongoDB 全量/增量、恢复步骤、RTO ≤ 1h、RPO ≤ 15min）。

仅补充一条 MongoDB PITR 技术口径，供与运维对齐：

- `mongodump` 每日全量 + 重放 oplog 可做近似时间点恢复，但流程脆弱、对 oplog 保留窗口依赖强，适合开发/小库；**生产级 PITR 用文件系统/云盘一致性快照（带 oplog）+ oplog 持续归档，或 MongoDB Ops Manager**，而非仅靠 dump+oplog。
- 具体策略、RTO/RPO 与恢复步骤以运维手册为准：见 [备份与恢复](../../operations/backup.md) §2.1、§4.2。

### 5.4 优雅关闭

NestJS 在应用关闭时会自动释放 Mongoose 连接。确保在 `main.ts` 中启用关闭钩子：

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(); // 启用关闭钩子，确保连接优雅释放
  await app.listen(3000);
}
bootstrap();
```

### 5.5 容量规划

| 数据量      | 推荐部署                              |
| ----------- | ------------------------------------- |
| < 100GB     | 三节点副本集（2 数据节点 + 1 仲裁）   |
| 100GB – 1TB | 三节点副本集（3 数据节点，SSD）       |
| > 1TB       | 分片集群（2+ 分片，每个分片为副本集） |

### 5.6 Docker Compose 本地开发（可选）

> **本节为可选项，仅在使用 Docker Compose 启动本地 MongoDB 时适用。** 若按 `AGENTS.md` §2.3 直接用本机 `mongod --dbpath ... --port=27017` 启动，则无需本节配置；但注意本机单点 `mongod` 不以副本集方式运行，多文档事务、change streams 无法验证，需要时再用下面的 Compose 方案。

仓库当前**尚无** `docker-compose.yml`，**如决定使用 Docker Compose**，以下为待新增内容。

> 关键约束：多文档事务、可变更流（change streams）只在副本集上可用。本地若只 `mongod` 单机启动，事务相关代码无法验证。最小方案是启动**单节点副本集**（一个数据节点也构成合法副本集，事务可用），再用一次性初始化容器执行 `rs.initiate()`；仅声明三个 `mongod --replSet` 而不 `initiate` 不会组成集群。

```yaml
# docker-compose.yml（本地开发，无鉴权，端口 27017）
version: '3.8'
services:
  mongo-rs:
    image: mongo:7.0
    container_name: mongo-rs
    command: mongod --replSet rs0 --bind_ip_all
    ports:
      - '27017:27017'
    volumes:
      - mongo-rs-data:/data/db
    healthcheck:
      test:
        ['CMD', 'mongosh', '--quiet', '--eval', "db.adminCommand('ping').ok"]
      interval: 5s
      timeout: 5s
      retries: 10

  mongo-init:
    image: mongo:7.0
    depends_on:
      mongo-rs:
        condition: service_healthy
    command: >
      mongosh --host mongo-rs:27017 --quiet
      --eval "try { rs.status().ok } catch (e) { rs.initiate({_id:'rs0', members:[{_id:0, host:'mongo-rs:27017'}]}) }"
    restart: 'no'

volumes:
  mongo-rs-data:
```

连接串对应：`MONGODB_URI=mongodb://localhost:27017/mydb?replicaSet=rs0`（本地无鉴权，不带 `authSource`/账号）。

> 若确需多节点：副本集成员间必须配置共享 keyfile（`--keyFile`）并以相同集群账号启动，`rs.initiate` 中列出全部成员 host；不能只在某一个节点上设置 `MONGO_INITDB_ROOT_*`（该变量仅在数据目录首次初始化时生效）。当前本地开发不建议引入这层复杂度。

## 6. 参考文档

- [NestJS MongoDB 官方文档（中文）](https://docs.nestjs.cn/techniques/mongo/)
- [NestJS MongoDB 官方文档（英文）](https://docs.nestjs.com/techniques/mongodb)
- [Mongoose 连接配置指南](https://mongoosejs.com/docs/connections.html)
- [MongoDB 数据建模最佳实践](https://www.mongodb.com/zh-cn/docs/v8.0/data-modeling/best-practices/)
- [MongoDB 副本集高可用设计](https://www.mongodb.com/docs/manual/replication/)
- [索引策略与 ESR 准则](https://www.mongodb.com/docs/manual/applications/indexes/)

## 7. 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-12 @架构组：§5.6 Docker Compose 标注为可选——仅在使用 Docker Compose 时适用，本机直跑 `mongod` 的默认开发方式无需本节。
- 2026-10-12 @架构组：P2 修订——备份/监控阈值去重，改链接运维手册（backup/monitoring/observability），仅保留 MongoDB 取数口径与 PITR 技术提醒；健康探针补 liveness/readiness 分离与 ping 节流。
- 2026-10-12 @架构组：P1 修订——读偏好默认走主、仅可容忍延迟场景逐查询走从（§3.7）；新增多文档事务范式（§3.8）；嵌入补 16MB/无界增长硬边界与博客拍板（§2.1）；补 ObjectId 校验与游标分页约定（§3.5）；补 TLS 连接串（§4.2）。
- 2026-10-12 @架构组：P0 修订——技术栈版本对齐 NestJS 9 基线（@nestjs/mongoose 9 + Mongoose 6 + config 2）；安装改 pnpm 并标注依赖变更需人工审批；env 默认值与文件对齐 `.env.local`；修正 unique 语义、补充 E11000/脏数据/生产 autoIndex 策略；docker-compose 改为可直接初始化的单节点副本集。
- 2026-10-11 @架构组：初始版本（NestJS + Mongoose）
