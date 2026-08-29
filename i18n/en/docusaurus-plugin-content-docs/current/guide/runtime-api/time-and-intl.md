---
sidebar_label: Temporal & Intl
---

# Temporal & Intl

## Temporal

Standard [Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) date/time API. Prefer it over error-prone `Date` for calendar dates, wall-clock time, precise instants, and time zones.

### Available Types

| Type | Description |
|------|-------------|
| `Temporal.Now` | Current instant / current time zone |
| `Temporal.Instant` | Precise instant (UTC epoch nanoseconds) |
| `Temporal.ZonedDateTime` | Date-time with time zone |
| `Temporal.PlainDate` | Calendar date (no time, no zone) |
| `Temporal.PlainTime` | Wall-clock time |
| `Temporal.PlainDateTime` | Date + time (no zone) |
| `Temporal.PlainYearMonth` | Year-month |
| `Temporal.PlainMonthDay` | Month-day |
| `Temporal.Duration` | Duration |

Also available:

- `Date.prototype.toTemporalInstant()` — convert legacy `Date` to `Temporal.Instant`

### Examples

```ts
// Parse calendar date
const d = Temporal.PlainDate.from("2024-03-15");
const nextWeek = d.add({ days: 7 }); // 2024-03-22

// Now in a time zone
const zdt = Temporal.Now.zonedDateTimeISO("Asia/Shanghai");
console.log(zdt.toString());
// e.g. 2026-07-15T20:30:00+08:00[Asia/Shanghai]

// Instant arithmetic
const instant = Temporal.Instant.from("2024-03-15T12:00:00Z");
const later = instant.add({ hours: 2 });

// Duration
const span = Temporal.Duration.from({ days: 2, hours: 3 });
console.log(span.toString()); // "P2DT3H"

// Convert from Date
const fromDate = new Date("2024-03-15T00:00:00Z").toTemporalInstant();
```

### Type Support

After installing `breeze-plugin-kit`, global `Temporal` and `Date.prototype.toTemporalInstant` types are injected automatically — no extra `import`:

```ts
// Use global Temporal with full IDE completion
const date: Temporal.PlainDate = Temporal.PlainDate.from("2024-01-01");
const now: Temporal.ZonedDateTime = Temporal.Now.zonedDateTimeISO();
```

Type source: `breeze-plugin-kit` `src/types/temporal.d.ts` (based on temporal-spec).

### Notes

- Injected via [temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill), aligned with the ECMAScript Temporal spec
- Named zones (e.g. `America/New_York`, `Asia/Shanghai`) and offset zones (e.g. `+08:00`) work
- Depends on the host time-focused [Intl](#intl) (`DateTimeFormat`); non-Gregorian calendars are **not** guaranteed — prefer `iso8601` / `gregory`
- Do not use `Date` for cross-zone add/subtract; prefer `PlainDate` / `ZonedDateTime` for calendar semantics

## Intl

QuickJS has no built-in ECMA-402. Breeze ships a **time-focused** Intl subset for locale-aware date/time formatting and Temporal time-zone support.

### Implemented

| API | Notes |
|-----|--------|
| `Intl.DateTimeFormat` | Locale date/time formatting (`format` / `formatToParts` / `resolvedOptions`) |
| `Intl.DateTimeFormat.supportedLocalesOf` | Minimal implementation |
| `Intl.supportedValuesOf("timeZone")` | IANA zones (links canonicalize to primary) |
| `Intl.supportedValuesOf("calendar")` | Calendar id list |
| `Intl.getCanonicalLocales` | Minimal implementation |
| `Date.prototype.toLocaleString` | Wired to `Intl.DateTimeFormat` |
| `Date.prototype.toLocaleDateString` | Same (default date fields) |
| `Date.prototype.toLocaleTimeString` | Same (default time fields) |

### Examples

```ts
const epoch = Date.UTC(2024, 8, 10, 15, 37, 20);

// Locale conventions
new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "long",
  timeZone: "Asia/Shanghai",
}).format(epoch);

new Intl.DateTimeFormat("en-GB", {
  dateStyle: "short",
  timeZone: "UTC",
}).format(epoch);

// Lone option
new Intl.DateTimeFormat("en", {
  year: "numeric",
  timeZone: "UTC",
}).format(epoch); // "2024"

// Fixed offset zones
new Intl.DateTimeFormat("en", {
  timeZone: "+00:00",
  year: "numeric",
}).resolvedOptions().timeZone; // "UTC"

// Common aliases are canonicalized
new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Calcutta",
}).resolvedOptions().timeZone; // "Asia/Kolkata"
```

### Type Support

After installing `breeze-plugin-kit`, time-focused Intl and Temporal types are injected automatically:

```ts
const fmt = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "long",
  timeZone: "Asia/Shanghai",
});
const text: string = fmt.format(Date.now());

// Only timeZone / calendar are guaranteed at runtime
const zones: string[] = Intl.supportedValuesOf("timeZone");
```

Type sources:

- `breeze-plugin-kit` `src/types/intl.d.ts` (Breeze time-focused constraints)
- `src/types/temporal.d.ts` (Temporal + `DateTimeFormat` overloads for Temporal objects)

### Notes

- **Time zones**: `jiff` for IANA / offset math; common links (e.g. `Etc/GMT` → `UTC`) are canonicalized
- **Locale formatting**: ICU4X (`en-US` / `zh-CN` / `ja-JP` conventions differ)
- **Option conflicts**: `dateStyle` / `timeStyle` together with field options or `timeZoneName` throw `TypeError`
- **`hourCycle: "h24"`**: midnight hour displays as `24`
- **Not supported**: `Collator` (sorting), `NumberFormat` / currency, and other non-time Intl
- Enough for “show times in local conventions / convert zones”; do not rely on collation or currency formatting
