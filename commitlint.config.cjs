// commitlint.config.cjs
const promptTypes = [
  { value: 'init', name: 'init 🎉: 初始化', emoji: '🎉' },
  { value: 'feat', name: 'feat 🍄: 新增新的特性', emoji: '🍄' },
  { value: 'fix', name: 'fix 🐛: 修复 BUG', emoji: '🐛' },
  { value: 'docs', name: 'docs 📄: 修改文档、注释', emoji: '📄' },
  { value: 'refactor', name: 'refactor 🎸: 代码重构', emoji: '🎸' },
  { value: 'perf', name: 'perf ⚡: 提升性能', emoji: '⚡' },
  { value: 'test', name: 'test 👀: 添加一个测试', emoji: '👀' },
  { value: 'tool', name: 'tool 🚗: 开发工具变动', emoji: '🚗' },
  { value: 'style', name: 'style ✂: 代码格式修改', emoji: '✂' },
  { value: 'revert', name: 'revert 🌝: 版本回滚', emoji: '🌝' },
  { value: 'update', name: 'update 🚀: 第三方库升级', emoji: '🚀' },
  { value: 'build', name: 'build 📦: 打包构建', emoji: '📦' },
  { value: 'ci', name: 'ci 👷: 打包流程配置', emoji: '👷' },
  { value: 'chore', name: 'chore: 其他类型', emoji: '' },
];

const promptTypeEnums = [];
promptTypes.forEach((item) => {
  if (item.value) {
    promptTypeEnums.push(item.value);
  }
});

module.exports = {                          // ← 只改这里
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', promptTypeEnums],
  },
  prompt: {
    types: promptTypes,
  },
};