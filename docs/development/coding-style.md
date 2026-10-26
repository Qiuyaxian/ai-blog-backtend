# 开发规范

> AI 阅读说明：
>
> - 默认必读：第 0 节、第 1 节。
> - 按任务读取：第 2 节对应小节。
> - 第 3 节仅供人类参考，AI 默认不读。
> - 团队代码规范以 [../architecture/engineering/code-style.md](../architecture/engineering/code-style.md) 为准
> - 横切规范（缓存、可观测性、安全、ADR）以 [../architecture/development-standards.md](../architecture/development-standards.md) 为准，本文件只讲编码层约定。

## 0. 全局硬约束（默认必读）

- Controller 不写业务逻辑，只做参数接收、调用 Service、返回响应。
- Service 不依赖 HTTP 对象（`@Req`/`@Res`），保持可复用、可测试。
- 禁止直接操作其他模块的 Schema；跨模块只调用对方 export 的 Service。
- 禁止循环依赖，无法避免时用 `forwardRef` 并标注原因，优先重构解耦。
- 所有外部输入必须经 DTO + `ValidationPipe` 校验，信任边界不接受未校验数据。
- 密码用 bcrypt 哈希（cost >= 10），禁止明文存储或日志输出密码、令牌、密钥。
- 禁止绕过 Guard / Pipe / Interceptor，禁止用 `// @ts-ignore`、`any` 掩盖真实类型问题。
- 禁止提交密钥；缓存统一封装，禁止 Controller 直接操作 Redis。
- API 版本化，响应新增字段必须可选；数据库迁移不直接删旧字段。
- HTTP 方法只允许 GET 与 POST：查询用 GET，所有写操作（创建/更新/删除/动作）一律 POST，禁止使用 PUT / PATCH / DELETE；POST 参数放 body，不用 `:id` 路径参数。

## 1. 编码风格（默认必读）

### 1.1 命名

| 元素                                         | 规则                          | 示例                                           |
| -------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| 类 / Controller / Service / Module / Gateway | PascalCase + 后缀             | `UserController`、`AuthService`、`OrderModule` |
| DTO / Interface / Enum                       | PascalCase；DTO 以 `Dto` 结尾 | `CreateUserDto`、`UserStatus`                  |
| 方法 / 变量                                  | camelCase，动词开头           | `findById()`、`isActive`                       |
| 布尔值                                       | `is/has/can/should` 前缀      | `isPublic`、`hasPermission`                    |
| 常量                                         | UPPER_SNAKE_CASE              | `MAX_RETRY_COUNT`                              |
| 文件                                         | kebab-case，一个文件一个主类  | `user-profile.service.ts`                      |
| 测试文件                                     | 与被测同名加 `.spec`          | `user.service.spec.ts`                         |

### 1.2 格式

- 格式统一交给 Prettier（配置见 `.prettierrc`），提交前由 lint-staged 自动处理，不手工对齐。
- 缩进 2 空格，单引号，语句末尾分号以 Prettier 输出为准；行宽建议 100。
- ESLint + Prettier 的安装与配置说明见 [../architecture/engineering/code-style.md](../architecture/engineering/code-style.md)。

### 1.3 注释

- 注释解释“为什么”，不复述“做什么”；代码能自表达时不写注释。
- 公开 API、复杂算法、临时妥协必须注释；妥协用 `ponytail:` 标注上限与升级路径。
- 使用 JSDoc 标注公共 Service 方法的参数与返回含义，不标注显而易见的代码。
- 保留 `TODO(负责人):` 格式，禁止遗留无主 TODO。

### 1.4 错误处理

- 业务错误抛 Nest 内置异常（`NotFoundException`、`BadRequestException`、`ForbiddenException` 等），由全局过滤器统一转响应，不在 Controller 手写 try/catch 拼错误体。
- 捕获异常时必须处理或重新抛出，禁止空 `catch` 吞错。
- 外部调用（DB / HTTP / 队列）失败要可降级或明确上抛，禁止返回不确定状态。
- 错误响应不暴露堆栈、SQL、内部路径；错误信息面向调用方，堆栈仅进日志。
- **响应统一外壳**（005-unified-response / ADR-006）：所有业务接口成功体由全局 `TransformResponseInterceptor` 包成 `{success:true,code:200,message:'ok',data}`，错误体由 `HttpExceptionFilter` 产出 `{success:false,code,message,data:null}`（成功统一 HTTP 200；错误保持 400/401/403/404/409，未知服务器异常 500；body 无 `statusCode`/`path`/`time`）。**外壳 `code` 为数字且恒等于本次响应 HTTP 状态码**（ADR-006 决策 15，成功 200、失败 4xx/5xx）。`data` 原样支持 `null`/`[]`/`{}`/业务对象。Controller/Service **禁止手工构造外壳**，直接 return/throw 即可，新接口自动获得外壳；业务错误仍只抛**内部异常键**字符串（如 `throw new ConflictException('EMAIL_EXISTS')`，Nest 内置/自定义 HttpException），该字符串是 Service/Guard 与错误目录的稳定标识、**不直接出现在响应体**——过滤器据键查 status 后把数字写进外壳 `code`、查 message 出文案，同状态细分原因（如 409 三种冲突、400 校验/非法 ID）只靠 message 区分。面向客户端的文案与 Swagger 错误描述都从 `src/common/response/response.constants.ts` 的单一 `ERROR_CATALOG`（内部键 →status/message/docLabel）派生：运行时用 `ERROR_CODES`、文档用 `SWAGGER_ERROR_STATUSES`/`swaggerErrorDescription`，新增错误只改 catalog 一处。例外仅 `GET /` 与 `/health/*` 探活（豁免，逐字节透传）；新增探活路径须同时改 `isEnvelopeExcludedPath`。**Swagger 响应零方法注解**：成功/错误响应、状态码全部全局处理，控制器禁止写 `@ApiResponse`/`@ApiErrorResponses`/`@HttpCode`——data 模型由 `@nestjs/swagger` CLI 插件按 controller 返回类型自动推断（返回类型必须是 class/内联对象/数组，不能是 interface/any），`wrapSuccessEnvelope` 在文档生成后统一包成功外壳、补齐全套错误响应（400/401/403/404/409，错误体 $ref ErrorEnvelope，通用文案；真实返回哪些码以 E2E 为准，文档枚举不逐接口收窄）；新增成功 data 类型在所属域建 dto class（如 `auth/dto/login-result.dto.ts`），不建 Envelope 子类。**成功状态码统一 200**（Nest `HttpStatus.OK`，ADR-006 决策 14）：所有业务接口成功均为 200，包括创建资源；500 只用于未知服务器异常。**鉴权样板用组合装饰器一行声明**（ADR-006 决策 9，`src/modules/user/guards/auth.decorators.ts`）：登录接口打 `@Public()`；已登录接口打 `@AuthOnly()`（自带 `RolesGuard` 认证-only、Bearer、401 文档）；管理员接口打 `@AdminOnly()`（另含 `@Roles('admin')` 与 403 文档）。守卫会抛的 401/403 不得再在接口 `@ApiErrorResponses` 中重复写，只写接口自身的 400/404/409；公开接口的 401 若语义不同（如 login 凭据错误）仍单独声明。Swagger 无法从守卫运行时抛错自动派生文档，新增守卫错误码须在组合装饰器内一并补文档。
- **CRUD 响应 `data` 五形态**（005-unified-response T031 / ADR-006 决策 16）：统一外壳只定顶层，业务载荷 `data` 按操作类型固定为五种，新接口必须遵守：
  1. **分页列表**：`data = { total:number, list:T[], page:number, pageTotal:number, index:number }`；入参 `page`（缺省 1）+ `pageSize`（缺省 20、封顶 50）。`total` 总条数（软删只计 `deletedAt:null`）；`pageTotal = Math.ceil(total/pageSize)`，`total===0` 时为 `0`；`index=(page-1)*pageSize+1` 为本页首条全局序号（**从 1 起**，首页 1、第 2 页=pageSize+1）；越界页返回 200 + 空 `list`。Mongo 取数用 `countDocuments` + `skip((page-1)*pageSize).limit(pageSize)`，禁止游标 `{items,nextCursor}` 与 `cursor/limit` 入参。
  2. **单个查询（只读）**：`data =` 单条对象；资源不存在（含已软删）返回 **HTTP 200 + `data:null`**，不抛 404；非法 ID 仍 400。
  3. **创建**：`data =` 新建对象（脱敏视图）。
  4. **更新**：`data =` 更新后的完整对象（脱敏视图）。
  5. **删除**：`data = null`（不回传 id/布尔/受影响行数）。
  - 只读单查的 null 化**不延伸到写操作**：更新/删除/动作目标不存在仍抛 404。分页结果类用 class（Swagger CLI 插件要求，如 `UserListPageResponse` 字段替换为五字段），不用 interface/any。

## 2. 工程规范（按需读取）

### 2.1 模块与分层

- 每个业务域一个目录，目录内固定文件：`xxx.module.ts` / `xxx.controller.ts` / `xxx.service.ts` / `dto/` / `schemas/`。
- 分层职责、跨模块协作、循环依赖处理以 [架构编码规范 §1 模块与分层规范](../architecture/development-standards.md#1-模块与分层规范) 为唯一权威，本文件不重复。

```ts
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
}
```

### 2.2 依赖注入与配置

- 可注入依赖统一走 Nest IoC 容器，禁止在业务代码中直接 `new` 第三方客户端，改为在 Module 的 provider 中创建并注入。
- 配置通过 `ConfigService` 读取（`@nestjs/config`），禁止在代码里硬编码端口、连接串、密钥。
- env 按 `NODE_ENV` 自动加载 `.env.local/uat/production`，见 `src/app.module.ts`。

### 2.3 输入校验（DTO）

- 每个接口入参定义 DTO，用 `class-validator` 装饰器声明规则，配合全局 `ValidationPipe`：

```ts
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // 剥离未声明属性
    forbidNonWhitelisted: true, // 出现未声明属性直接报错
    transform: true, // payload 自动转 DTO 类型
  }),
);
```

```ts
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  nickname?: string;
}
```

- 查询参数用单独的 Query DTO；GET 路径参数用 `@IsMongoId()` / `ParseIntPipe` 等内建管道校验（POST 写操作不用路径参数，标识放 body）。
- 禁止用 `any` 或裸对象接收请求体。

### 2.4 Controller 与路由

- Controller 只做：接收参数（DTO）→ 调 Service → 返回结果；不写条件分支业务逻辑、不直接访问 DB。
- **HTTP 方法只允许 GET 与 POST**：查询用 GET，所有写操作（创建/更新/删除/动作）一律 POST，禁止使用 PUT / PATCH / DELETE。
- **POST 写操作参数优先放 body**：资源标识与动作参数作为 body 字段传递（如 `{ id, isAdmin }`），不使用 `@Param()` 路径参数；仅 GET 允许使用路径/查询参数。
- 路由用复数资源名（`/users`、`/users/posts`）；非 CRUD 动作用路径子资源表达（如 `POST /users/admin`、`POST /users/delete`），不依赖 HTTP 动词语义。
- 成功状态码不写 `@HttpCode`，由全局拦截器统一设置为 200（ADR-006 决策 14）：包括创建、查询、更新、删除和动作接口；错误仍按异常类型返回 400/401/403/404/409，未知服务器异常为 500。
- 统一通过 `setGlobalPrefix` 和版本前缀管理 API 路径；响应结构、分页格式由全局 Interceptor 统一。

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findById(id);
  }

  // POST 成功统一 200，无需 @HttpCode
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  // POST 子路径动作：全局推断 200；更新/动作都用 POST，参数走 body，不用路径参数
  @Post('admin')
  setAdmin(@Body() dto: SetAdminDto) {
    return this.userService.setAdmin(dto);
  }
}
```

### 2.5 异步与类型

- 优先 `async/await`，禁止混用裸 Promise 链与回调；可观察流用 RxJS 操作符处理。
- 函数标注返回类型（公共方法必须），避免隐式 `any`；`Promise<T>` 标明兑现类型。
- 不使用 `// @ts-ignore`，改用类型收窄或正确声明；确需绕过用 `@ts-expect-error` 并注明原因。

### 2.6 数据访问

- 数据库访问收敛在 Repository / Schema 层，Service 不拼接底层查询细节给 Controller。
- 查询条件、索引在 Schema 定义；禁止全表扫描式取数后在内存过滤。
- 写库成功后再删缓存；缓存、可观测性、安全、迁移等横切约定以 [architecture/development-standards.md](../architecture/development-standards.md) 各专章为准。

### 2.7 测试

- 非平凡逻辑必须留下可运行测试：Service 单测为主，Mock 掉外部依赖；Controller 用 `Test.createTestingModule` 验证路由与校验。
- 测试命名表达行为（`should ... when ...`），一个测试只断言一个行为。
- E2E 覆盖关键链路，测试内自举应用，不依赖外部已启动服务。
- 测试规范详见 [./testing.md](./testing.md)（待完善）。

## 3. 运维与合规附录（AI 默认不读）

- SLO / P99 目标、告警规则 / Runbook、审计保留周期、技术债看板、拆分信号：
  见 [../operations/](../operations/README.md) 与 [development-standards.md 第 4、7 节](../architecture/development-standards.md)。

## 更新记录

> 只记重要变更，最新在上。完整历史见 Git。

- 2026-10-26：§1.4 新增「CRUD 响应 `data` 五形态」硬约束（005 T031 / ADR-006 决策 16）：列表页码分页 `{total,list,page,pageTotal,index}`（index 从 1 起，入参 page/pageSize 废 cursor/limit）、只读单查不存在 200+null（写操作仍 404）、创建/更新返回完整对象、删除返回 null。
- 2026-10-26：§1.4 追加守卫组合装饰器硬约束（ADR-006 决策 9）：`@Public`/`@AuthOnly`/`@AdminOnly` 一行带守卫+Bearer+401/403 文档，接口只写 400/404/409。
- 2026-10-26：§1.4 新增「响应统一外壳」硬约束（005-unified-response / ADR-006）：成功/错误四字段外壳、业务代码禁手工构造、探活豁免；同日 T027 外壳收敛为 `{success,code,message,data}`（去 path/time）、错误文案集中 ERROR_CODES、Swagger 成功响应免逐接口注解（CLI 插件 + wrapSuccessEnvelope）。
- 2026-10-13：§0 与 §2.4 新增硬约束——HTTP 方法只允许 GET/POST，写操作一律 POST（禁 PUT/PATCH/DELETE），动作由路径语义表达。
- 2026-10-13：§2.3/§2.4 补充——POST 写操作参数优先放 body，不用 `:id` 路径参数，资源标识作为 body 字段；仅 GET 用路径/查询参数。
