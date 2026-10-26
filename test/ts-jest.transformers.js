/**
 * ts-jest AST transformer：E2E 经 ts-jest 编译，挂载 @nestjs/swagger CLI 插件，
 * 使文档源与 `nest build`/`nest start` 一致——controller 返回类型自动生成成功响应
 * 模型（生产装配靠 nest-cli.json 的 plugins，此处只对齐测试编译链路）。
 *
 * ts-jest 约定：模块导出 name/version/factory(compiler, options)。
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires -- ts-jest transformer 是 CommonJS 配置文件，须用 require
const swaggerPlugin = require('@nestjs/swagger/plugin');

module.exports = {
  name: 'swagger-plugin-for-jest',
  version: 1,
  factory: (compiler) => swaggerPlugin.before({}, compiler.program),
};
