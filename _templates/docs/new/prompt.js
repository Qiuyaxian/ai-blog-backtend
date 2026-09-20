module.exports = [
  {
    type: 'input',
    name: 'name',
    message: '请输入文档名称 (如 user):',
    validate: (input) => input.length > 0 || '文档名称不能为空',
  },
];
