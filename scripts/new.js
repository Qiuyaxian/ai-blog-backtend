#!/usr/bin/env node
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prompts = require('prompts');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require('child_process');

(async () => {
  const { generator } = await prompts({
    type: 'select',
    name: 'generator',
    message: '请选择要生成的类型:',
    choices: [{ title: '文档 (docs)', value: 'docs' }],
  });

  if (!generator) return;

  // 透传剩余参数给 hygen
  const extraArgs = process.argv.slice(2).join(' ');
  try {
    execSync(`hygen ${generator} new ${extraArgs}`, { stdio: 'inherit' });
  } catch (e) {
    process.exit(1);
  }
})();
