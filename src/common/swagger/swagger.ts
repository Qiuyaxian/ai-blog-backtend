import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { wrapSuccessEnvelope } from './wrap-envelope';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../../package.json') as { version: string };

/** Swagger 开关配置键（env）。 */
export const SWAGGER_ENABLED_KEY = 'SWAGGER_ENABLED';

const TRUE = 'true';
const FALSE = 'false';

/**
 * 判定是否开启 Swagger 文档。
 *
 * 默认规则：NODE_ENV 非 production 即开放（undefined 视为非生产）。
 * 覆盖规则：SWAGGER_ENABLED 仅接受大小写不敏感的 'true'/'false'，其他值 fail-fast。
 * 纯函数：不读 process.env、不依赖容器，便于单测。
 */
export function isSwaggerEnabled(
  nodeEnv: string | undefined,
  override?: string,
): boolean {
  const enabledByDefault = nodeEnv !== 'production';
  if (override === undefined || override.trim() === '') {
    return enabledByDefault;
  }
  const normalized = override.trim().toLowerCase();
  if (normalized === TRUE) {
    return true;
  }
  if (normalized === FALSE) {
    return false;
  }
  throw new Error(
    `${SWAGGER_ENABLED_KEY} must be 'true' or 'false' (case-insensitive), got: ${override}`,
  );
}

/**
 * 在应用上装配 Swagger UI（/api-docs）与文档源（/api-docs-json）。
 *
 * 关闭时直接 return：不 createDocument、不 setup，UI/文档源/静态资源全部不注册，
 * 未注册路径天然落入未知路由 → 404（research R2）。
 *
 * ponytail: 仅有的两个装配点是 src/main.ts 与 test/helpers/e2e-app.ts，
 * 改动本函数装配行为时两处都在复用同一函数，无需同步其他位置。
 */
export function setupSwagger(
  app: INestApplication,
  config: ConfigService,
): void {
  const nodeEnv = config.get<string>('NODE_ENV');
  const override = config.get<string>(SWAGGER_ENABLED_KEY);
  if (!isSwaggerEnabled(nodeEnv, override)) {
    return;
  }

  const configBuilder = new DocumentBuilder()
    .setTitle('AI Blog Backend API')
    .setDescription('AI 博客后端接口文档（登录鉴权 + 用户管理 + 基础设施）')
    .setVersion(pkg.version)
    .addTag('auth', '登录鉴权')
    .addTag('users', '用户管理')
    .addTag('infra', '基础设施（根路径/健康检查）')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Opaque',
        in: 'header',
        name: 'Authorization',
      },
      'Bearer',
    )
    .build();

  const rawDocument = SwaggerModule.createDocument(app, configBuilder);
  // 成功响应统一包 {success,code,message,data}：data 类型由 swagger CLI 插件从
  // controller 返回类型推断，文档生成后在此一处包裹，控制器无需逐个 @ApiResponse
  const document = wrapSuccessEnvelope(rawDocument);
  SwaggerModule.setup('api-docs', app, document);
}
