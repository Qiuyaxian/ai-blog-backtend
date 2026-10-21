---
evolution_id: EVO-{{YYYYMMDDNNN}}
date: { { YYYY-MM-DD HH:mm+08:00 } }
task_id: { { feature-or-issue-id } }
task_name: { { 任务名称 } }
agent: { { arch-agent|dev-agent|test-agent|devops-agent } }
priority: P0|P1|P2|P3
status: pending_apply
---

# 进化记录 - {{YYYY-MM-DD HH:mm}}

## 1. 任务/问题场景

> 任务背景；遇到的具体问题、踩坑、低效环节。

{{scene}}

## 2. 根因分析

> 为什么发生：规范缺失？流程漏洞？角色职责不清？工具/环境事实未记录？

{{root_cause}}

## 3. 最终解决方案

> 怎么解决的，为什么有效。

{{solution}}

## 4. 沉淀的可执行规则

> 必须写成 AI 可直接执行的「必须 / 禁止」规则，不写空话；注明归属文件。

- [ ] {{rule}}

## 5. 需要更新的文件清单

| 文件路径 | 更新内容   |
| -------- | ---------- |
| {{path}} | {{change}} |

## 6. 防重复验证规则

> 一个可自动/例行检查的验证项，保证同样错误不再发生（命令、检查点或评审清单条目）。

{{validation_check}}
