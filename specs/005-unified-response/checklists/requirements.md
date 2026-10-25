# Specification Quality Checklist: 全局统一响应外壳（005-unified-response）

**Purpose**: 规划闸门前置质量核对（spec / plan / tasks 一致性）
**Created**: 2026-10-26
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] ✅ No implementation details（spec 只回答 WHAT/WHY：外壳字段、豁免、错误码不变；拦截器/class 清单/文件路径仅出现在 plan/tasks）
- [x] ✅ Focused on user value（调用方一套解析逻辑、成败同形、探针不回归、文档一致）
- [x] ✅ Written for non-technical stakeholders（US 以调用方/运维视角描述，不要求 Nest 知识）
- [x] ✅ All mandatory sections completed（澄清记录 / 用户场景与测试 / 需求 / 关键实体 / 成功标准 / 假设 / 关联文档）

## Requirement Completeness

- [x] ✅ No [NEEDS CLARIFICATION] markers remain（5 个契约问题已在澄清记录全部回答：字段集、错误扁平化、health 排除、HTTP 状态保留、一次性切换）
- [x] ✅ Requirements are testable and unambiguous（FR-001–FR-015 均可经单测/E2E/文档源断言验证；字段、取值、路径明确）
- [x] ✅ Success criteria are measurable（9 接口 100%、10 错误码、0 个 statusCode 残留、门禁退出码 0、依赖新增 0、grep 证据）
- [x] ✅ Success criteria are technology-agnostic（SC 描述行为；Nest 拦截器/class 仅在 plan 作为实现手段）
- [x] ✅ All acceptance scenarios are defined（US1 6 条、US2 7 条、US3 5 条，含边界）
- [x] ✅ Edge cases are identified（豁免判定边界、path 不含 query、守卫/管道/服务多抛出点同形、非 JSON 响应不提前抽象、日志不泄密、E2E time 不可全等）
- [x] ✅ Scope is clearly bounded（做：成功拦截器 + 错误体扁平化 + Swagger 模型 + E2E 迁移；不做：错误码常量化、API 版本双写、DI 注册改造、toUserResponse 泛化、流/下载封装）
- [x] ✅ Dependencies and assumptions identified（无新依赖、无 DB/缓存变更；依赖既有 filter/双装配点/004 Swagger；无外部消费方假设经人工确认）

## Feature Readiness

- [x] ✅ FR 与任务可双向追溯（FR→tasks 覆盖见 analyze 报告覆盖表；SC→ 任务/quickstart 可验）
- [x] ✅ User scenarios cover primary flows（成功统一 → 错误同形 → 探针与文档保障）
- [x] ✅ 破坏性影响已显式登记（移除顶层 statusCode、成功字段下沉 data），非目标与回滚明确
- [x] ✅ **宪法一致性**：原则 I/V 的破坏性 API 限制经人工选择走宪法修订：1.1.0→1.2.0 新增「模板期一次性切换例外」（无外部消费方 + 人工确认 + ADR-006 + 测试文档同 PR），随 005 首个 PR 人工评审生效

## Notes

- FR-006 明确错误码值不变（10 个），`UnauthorizedException` 的三个抛出位置 code 语义不动，只统一外壳——与用户原始诉求「统一 UnauthorizedException」对齐于形状层而非错误码层。
- Terminus ready 503 经源码核实会穿过全局过滤器（research R4），豁免透传是硬需求，已落 T004/T005 单测。
- 根路径 `/` 的 Content-Type 以 Express 实测默认 `text/html; charset=utf-8` 为准（spec/contracts/data-model 已统一，不锁 text/plain）。
- 错误码常量化（防漂移）经 research R8 决定不做，避免与外壳变更混 diff；如需应另立 feature。
