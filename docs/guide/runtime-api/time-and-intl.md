---
sidebar_label: Temporal 与 Intl
---

# Temporal 与 Intl

## Temporal

标准 [Temporal](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Temporal) 日期时间 API。用于替代易错的 `Date`，支持日历日期、墙钟时间、精确时间点与时区。

### 可用类型

| 类型 | 说明 |
|------|------|
| `Temporal.Now` | 读取当前时刻 / 当前时区 |
| `Temporal.Instant` | 精确时间点（UTC 纪元纳秒） |
| `Temporal.ZonedDateTime` | 带时区的日期时间 |
| `Temporal.PlainDate` | 日历日期（无时间、无时区） |
| `Temporal.PlainTime` | 墙钟时间 |
| `Temporal.PlainDateTime` | 日期 + 时间（无时区） |
| `Temporal.PlainYearMonth` | 年月 |
| `Temporal.PlainMonthDay` | 月日 |
| `Temporal.Duration` | 时长 |

同时可用：

- `Date.prototype.toTemporalInstant()` — 将遗留 `Date` 转为 `Temporal.Instant`

### 示例

```ts
// 解析日历日期
const d = Temporal.PlainDate.from("2024-03-15");
const nextWeek = d.add({ days: 7 }); // 2024-03-22

// 当前时区下的此刻
const zdt = Temporal.Now.zonedDateTimeISO("Asia/Shanghai");
console.log(zdt.toString());
// 例如：2026-07-15T20:30:00+08:00[Asia/Shanghai]

// 精确时间点运算
const instant = Temporal.Instant.from("2024-03-15T12:00:00Z");
const later = instant.add({ hours: 2 });

// 时长
const span = Temporal.Duration.from({ days: 2, hours: 3 });
console.log(span.toString()); // "P2DT3H"

// 与 Date 互转
const fromDate = new Date("2024-03-15T00:00:00Z").toTemporalInstant();
```

### 类型支持

安装 `breeze-plugin-kit` 后，全局 `Temporal` 与 `Date.prototype.toTemporalInstant` 的类型会自动注入，无需额外 `import`：

```ts
// 直接使用全局 Temporal，tsserver / IDE 有完整补全
const date: Temporal.PlainDate = Temporal.PlainDate.from("2024-01-01");
const now: Temporal.ZonedDateTime = Temporal.Now.zonedDateTimeISO();
```

类型声明来源：`breeze-plugin-kit` 的 `src/types/temporal.d.ts`（基于 temporal-spec）。

### 备注

- 基于 [temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill) 注入，行为对齐 ECMAScript Temporal 规范
- 命名时区（如 `America/New_York`、`Asia/Shanghai`）可用；偏移时区（如 `+08:00`）也可用
- 依赖宿主时间向 [Intl](#intl)（`DateTimeFormat`）；非公历日历**不保证**正确，日常请用 `iso8601` / `gregory`
- 不要依赖 `Date` 做跨时区加减；需要日历语义时优先用 `PlainDate` / `ZonedDateTime`

## Intl

QuickJS 无内建 ECMA-402。Breeze 提供**时间向** Intl 子集，用于按地区习惯格式化日期时间，并支撑 Temporal 的时区路径。

### 已实现

| API | 说明 |
|-----|------|
| `Intl.DateTimeFormat` | locale 日期时间格式化（`format` / `formatToParts` / `resolvedOptions`） |
| `Intl.DateTimeFormat.supportedLocalesOf` | 最小实现 |
| `Intl.supportedValuesOf("timeZone")` | IANA 时区列表（link 会 canonicalize 到 primary） |
| `Intl.supportedValuesOf("calendar")` | 日历 id 列表 |
| `Intl.getCanonicalLocales` | 最小实现 |
| `Date.prototype.toLocaleString` | 接到 `Intl.DateTimeFormat` |
| `Date.prototype.toLocaleDateString` | 同上（默认日期字段） |
| `Date.prototype.toLocaleTimeString` | 同上（默认时间字段） |

### 示例

```ts
const epoch = Date.UTC(2024, 8, 10, 15, 37, 20);

// 按地区习惯显示
new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "long",
  timeZone: "Asia/Shanghai",
}).format(epoch);

new Intl.DateTimeFormat("en-GB", {
  dateStyle: "short",
  timeZone: "UTC",
}).format(epoch);

// 仅年份（lone option）
new Intl.DateTimeFormat("en", {
  year: "numeric",
  timeZone: "UTC",
}).format(epoch); // "2024"

// 固定 offset 时区
new Intl.DateTimeFormat("en", {
  timeZone: "+00:00",
  year: "numeric",
}).resolvedOptions().timeZone; // "UTC"

// 常见时区别名会 canonicalize
new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Calcutta",
}).resolvedOptions().timeZone; // "Asia/Kolkata"
```

### 类型支持

安装 `breeze-plugin-kit` 后，时间向 Intl 与 Temporal 的类型会自动注入：

```ts
const fmt = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "long",
  timeZone: "Asia/Shanghai",
});
const text: string = fmt.format(Date.now());

// 仅 timeZone / calendar 有运行时保证
const zones: string[] = Intl.supportedValuesOf("timeZone");
```

类型来源：

- `breeze-plugin-kit` `src/types/intl.d.ts`（Breeze 时间向约束与说明）
- `src/types/temporal.d.ts`（Temporal + `DateTimeFormat` 对 Temporal 对象的 format 扩展）

### 备注

- **时区**：`jiff` 做 IANA / offset 换算；常见 link（如 `Etc/GMT` → `UTC`）会 canonicalize
- **locale 格式**：ICU4X（`en-US` / `zh-CN` / `ja-JP` 等习惯不同）
- **选项冲突**：`dateStyle` / `timeStyle` 与字段或 `timeZoneName` 同时出现时抛 `TypeError`
- **`hourCycle: "h24"`**：午夜小时显示为 `24`
- **明确不支持**：`Collator`（排序）、`NumberFormat` / 货币、以及其它非时间 Intl
- 插件只需「按地区显示时间 / 时区换算」时用本子集即可；不要依赖排序或货币格式化
