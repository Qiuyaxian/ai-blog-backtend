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
- 用状态码装饰器明确语义：`@Post()` 创建返回 201；无返回的写动作用 `@HttpCode(204)`；有返回的更新/动作返回 200。
- 统一通过 `setGlobalPrefix` 和版本前缀管理 API 路径；响应结构、分页格式由全局 Interceptor 统一。

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findById(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  // 更新/动作也用 POST，参数走 body，不用路径参数
  @Post('admin')
  @HttpCode(200)
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

- 2026-10-13：§0 与 §2.4 新增硬约束——HTTP 方法只允许 GET/POST，写操作一律 POST（禁 PUT/PATCH/DELETE），动作由路径语义表达。
- 2026-10-13：§2.3/§2.4 补充——POST 写操作参数优先放 body，不用 `:id` 路径参数，资源标识作为 body 字段；仅 GET 用路径/查询参数。
