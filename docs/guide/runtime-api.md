# 运行时 API

Breeze 插件运行在 QuickJS-NG 引擎中，不是 Node.js 也不是浏览器环境。
下面列出标准 ECMAScript 之外，运行时额外提供的全局 API。

## 全局对象

插件启动后可直接使用的全局对象：

- `fetch` / `Request` / `Response` / `Headers`
- `AbortController` / `AbortSignal`
- `URL` / `URLSearchParams`
- `Blob` / `File` / `FormData`
- `structuredClone`
- `console`
- `crypto`
- `TextEncoder` / `TextDecoder`
- `Buffer`
- `path`
- `native`
- `bridge`
- `uuidv4`
- `Temporal`
- `Intl`（时间向子集，见 [Intl](#intl)）
- `BreezeHtml`
- `bytesToBase64` / `bytesFromBase64`
- `hostCrypto`
- `__web`

> ⚠️ **注意：`fs` 不在可用列表中。** `breeze-plugin-kit` 里保留了 `fs` 的类型声明，用于在纯 Node.js 测试环境中运行插件代码，但 Breeze **不会向正式运行时的插件注入 `fs` API**。这是出于安全考虑：允许插件直接访问宿主文件系统风险过高。插件应通过 `fetch` 等网络请求与外部交互，请不要在插件中使用 `fs`。

## fetch

标准 `fetch` 实现。

```js
const res = await fetch("https://api.example.com/data");
const data = await res.json(); // JSON
const text = await res.text(); // 文本
const blob = await res.blob(); // Blob
const buf = await res.arrayBuffer(); // ArrayBuffer
```

配套对象 `Request`、`Response`、`Headers`、`AbortController`、`AbortSignal`、`FormData`、`Blob`、`File` 均可用。

```js
// 超时控制
const ac = new AbortController();
setTimeout(() => ac.abort(), 10000);
const res = await fetch(url, { signal: ac.signal });

// 或
const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
```

### 二进制响应优化

对于返回二进制的接口（例如图片下载），强烈建议在请求头中加入：

```
x-rquickjs-host-offload-binary-v1: 1
```

作用：显式声明“本次响应需要以原始二进制形式返回”，强制宿主直接把字节流透传给插件。如果不加这个头，宿主可能会把二进制响应当作普通数据做预处理（例如字符串化、编码转换或格式包装），导致拿到的数据失真、长度不对或图片解码失败。

```js
const res = await fetch(url, {
  headers: { "x-rquickjs-host-offload-binary-v1": "1" },
});
const buf = await res.arrayBuffer();
```

> 建议：在 `fetchImageBytes` 中**始终携带该请求头**，这是图片能正常显示的最常见原因之一。

## bridge

插件与 Rust 宿主通信的唯一桥梁。

### 方法

- `bridge.call(name, ...args)` — 异步调用宿主路由
- `bridge.callSync(name, ...args)` — 同步调用（会阻塞，谨慎使用）
- `bridge.gzipCompress(input)` — gzip 压缩
- `bridge.gzipDecompress(input)` — gzip 解压

### 内建路由

以下路由开箱即用，无需注册：

**压缩**

- `compression.gzip_compress`
- `compression.gzip_decompress`

**原生**

- `native.put`
- `native.take`
- `native.exec`

**数学**

- `math.add`

> 加密相关路由（`crypto.*`）见下文 [crypto](#crypto) 章节，不在此处重复列出。

## native

字节缓冲池，用于管理二进制数据。大部分场景用 `fetch` 和 `bridge` 即可，不推荐直接操作。

主要方法：

- `native.put(input)` — 将数据放入缓冲池，返回 id
- `native.take(id)` — 从缓冲池取出数据
- `native.free(id)` — 释放缓冲

## console

```js
console.log("...");
console.info("...");
console.warn("...");
console.error("...");
console.debug("...");
```

输出会转到宿主日志。其他 console 方法会 fallback 到 `console.log` 同级逻辑。

## crypto

> ⚠️ **重要：Breeze 的 `crypto` 不是 Web Crypto API，也不是 Node.js 的 `crypto` 模块。** 虽然运行时把 `crypto` 挂到了 `globalThis` 上，但它的 API 形态与两者都不兼容。请不要直接写 `crypto.xxx()` 然后依赖 tsserver 的类型推导，否则会拿到错误的类型提示。
>
> 正确做法是从 `breeze-plugin-kit` 显式导入获取：
>
> ```ts
> import { requireCryptoLike } from "breeze-plugin-kit";
> const crypto = requireCryptoLike();
> ```
>
> 详见 [breeze-plugin-kit 工具包](/guide/plugin-kit#crypto-加密解密)。

Breeze 注入的 `crypto` 是 Node.js 兼容的加密 API **子集**，非完整实现。

### 支持的方法

```js
// 哈希（返回 hex 字符串）
crypto.md5(input)
crypto.sha1(input)
crypto.sha256(input)
crypto.sha512(input)

// HMAC（返回 hex 字符串）
crypto.hmacSha1(key, input)
crypto.hmacSha256(key, input)
crypto.hmacSha512(key, input)

// 流式哈希
crypto.createHash("sha256" | "sha-256")
crypto.createHash("sha1"   | "sha-1")
crypto.createHash("sha512" | "sha-512")

// 流式 HMAC
crypto.createHmac("sha256" | "sha-256", key)
crypto.createHmac("sha1"   | "sha-1", key)
crypto.createHmac("sha512" | "sha-512", key)

// AES（输入可以是 string / Uint8Array / ArrayBuffer / ArrayBufferView / number[]，输出 Uint8Array）
crypto.aesEcbPkcs7Encrypt(input, keyRaw)
crypto.aesEcbPkcs7Decrypt(input, keyRaw)
crypto.aesCbcPkcs7Encrypt(input, keyRaw, ivRaw)
crypto.aesCbcPkcs7Decrypt(input, keyRaw, ivRaw)
crypto.aesGcmEncrypt(input, keyRaw, nonceRaw, aad?)
crypto.aesGcmDecrypt(input, keyRaw, nonceRaw, aad?)

// 旧版 base64 包装（已废弃，仍兼容）
crypto.aesCbcPkcs7EncryptB64(payloadB64, keyRaw, ivRaw)
crypto.aesCbcPkcs7DecryptB64(payloadB64, keyRaw, ivRaw)
crypto.aesGcmEncryptB64(payloadB64, keyRaw, nonceRaw, aadB64?)
crypto.aesGcmDecryptB64(payloadB64, keyRaw, nonceRaw, aadB64?)

// 工具
crypto.randomBytes(size)
crypto.randomUUID()
crypto.timingSafeEqual(a, b)

// PBKDF2
crypto.pbkdf2Sync(password, salt, iterations, keyLen, digest?)
crypto.pbkdf2(password, salt, iterations, keyLen, digest?, callback)
```

### 支持的编码

`utf8` / `utf-8` / `hex` / `base64` / `latin1` / `binary` / `buffer`

### 说明

- `pbkdf2` / `pbkdf2Sync` 目前固定走 sha256
- ECB、CBC、GCM 均提供加密和解密
- **推荐通过 `const crypto = requireCryptoLike()` 调用 `crypto.aes*`**，不建议直接使用 `bridge.call("crypto.*")` 路由
- 旧版 `_hex` / `_b64` API 行为较为模糊，已废弃，不再建议使用

```ts
import {
  requireCryptoLike,
  bytesToBase64,
  bytesFromBase64,
} from "breeze-plugin-kit";

const crypto = requireCryptoLike();

// 摘要
const md5 = await crypto.md5("text");

// 流式哈希
const hash = crypto.createHash("sha256").update("text").digest("hex");

// AES-CBC
const encrypted = await crypto.aesCbcPkcs7Encrypt("text", key, iv);
const decrypted = await crypto.aesCbcPkcs7Decrypt(encrypted, key, iv);

// Base64 互转
const b64 = bytesToBase64(encrypted);
const bytes = bytesFromBase64(b64);

// 旧式 bridge 路由（不推荐，建议用上面的 crypto.aesCbcPkcs7Decrypt）
const decryptedB64 = await bridge.call(
  "crypto.aes_cbc_pkcs7_decrypt_b64",
  payloadB64,
  key,
  iv,
);
```

## uuidv4

```js
const id = uuidv4();
```

## Buffer

> 如果需要使用 `Buffer` 类型，建议从 `breeze-plugin-kit` 显式引入类型声明，避免 tsserver 按其他环境（如 Node.js DOM）推断出错误的类型：
>
> ```ts
> import type { Buffer } from "breeze-plugin-kit";
> ```

Breeze 注入的 `Buffer` 是 **Node.js 兼容的 Buffer 子集**，并非常见的浏览器 `ArrayBuffer` 包装。

```js
Buffer.from(data, encoding?)
Buffer.alloc(size)
Buffer.isBuffer(obj)
Buffer.byteLength(string, encoding?)
```

## path

路径工具，与 Node.js `path` 子集兼容。

```js
path.join("/a", "b", "../c"); // "/a/c"
path.resolve("a", "b"); // 绝对路径
path.dirname("/a/b/c.txt"); // "/a/b"
path.basename("/a/b/c.txt"); // "c.txt"
path.extname("/a/b/c.txt"); // ".txt"
```

## TextEncoder / TextDecoder

UTF-8 编解码。

```js
const bytes = new TextEncoder().encode("hello");
const text = new TextDecoder().decode(bytes);
```

## structuredClone

```js
const copy = structuredClone({ a: 1, b: [2, 3] });
```

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

## 类型定义

类型定义由 `breeze-plugin-kit` 包统一提供：

```bash
pnpm add breeze-plugin-kit
```

```ts
import type {
  SearchResultContract,
  ComicDetailContract,
} from "breeze-plugin-kit";
```

主要模块：

- 插件所有 `fnPath` 的请求/响应结构
- 运行时全局对象（`bridge`、`crypto`、`native`、`Temporal`、`Intl`、`fs` 等）的类型声明
- `hostRuntime`、`getApi`、`requireApi` 等便捷封装

详见 [breeze-plugin-kit 工具包](/guide/plugin-kit)。

## 便捷封装

`breeze-plugin-kit` 提供了常用功能的便捷封装：

- `cache.*` — 进程内缓存（生命周期跟随宿主进程）
- `pluginConfig.*` — 持久化配置
- `opencc.*` — 简繁转换
- `flutterTools.*` — Flutter 宿主交互（Toast、获取版本等）
- `runtime.*` — 运行时工具（GC、任务取消检查等）

详细用法见 [breeze-plugin-kit 工具包](/guide/plugin-kit)。

## 常见用法

```ts
import { requireCryptoLike } from "breeze-plugin-kit";

const crypto = requireCryptoLike();
const encoder = new TextEncoder();

// 1. fetch 拉数据
const res = await fetch("https://api.example.com/list");
const data = await res.json();

// 2. crypto 计算摘要
const md5 = await crypto.md5(encoder.encode("data"));
const sha256 = crypto
  .createHash("sha256")
  .update(encoder.encode("data"))
  .digest("hex");

// 3. console 打日志
console.log("result:", data);
```

## BreezeHtml

`BreezeHtml` 是 Breeze 运行时注入的 **Rust 原生 HTML 解析与操作 API**，实现了 cheerio 的一个常用子集。对于需要解析 HTML 页面的插件（例如从网页抓取漫画列表、详情、章节），推荐优先使用它，而不是额外打包 cheerio 等解析库，可以显著减小 bundle 体积并提升解析性能。

### 基本用法

```ts
const $ = BreezeHtml.load(html);

// 选择元素
const title = $("title").text();
const links = $("a")
  .map((_, el) => $(el).attr("href"))
  .get()
  .filter(Boolean);
```

### 支持的 API

| 方法                                                                                                       | 说明                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `BreezeHtml.load(html)`                                                                                    | 加载 HTML 字符串，返回 `$` 选择器函数  |
| `$(selector)`                                                                                              | 按 CSS 选择器查找元素                  |
| `.find(selector)`                                                                                          | 在当前选择范围内继续查找               |
| `.first()` / `.last()` / `.eq(i)`                                                                          | 取第几个匹配元素                       |
| `.closest(selector)` / `.parent()` / `.children(sel?)` / `.siblings(sel?)` / `.next(sel?)` / `.prev(sel?)` | 遍历 DOM                               |
| `.is(selector)`                                                                                            | 判断是否匹配选择器                     |
| `.filter(selector \| fn)` / `.has(selector)` / `.slice(start, end?)` / `.index()`                          | 过滤与索引                             |
| `.attr(name)`                                                                                              | 读取属性值                             |
| `.text()`                                                                                                  | 读取纯文本内容                         |
| `.html()`                                                                                                  | 读取 HTML 字符串                       |
| `.val()`                                                                                                   | 读取表单值                             |
| `.toArray()`                                                                                               | 返回选择器数组                         |
| `.each(fn)`                                                                                                | 遍历每个匹配元素                       |
| `.map(fn)`                                                                                                 | 映射每个匹配元素，`get()` 拿到结果数组 |

### 完整示例：解析搜索列表

```ts
import type { CheerioAPI, ComicListItem } from "breeze-plugin-kit";

function parseSearchHtml(html: string): ComicListItem[] {
  const $ = BreezeHtml.load(html);

  return $(".comic-item")
    .map((_, element) => {
      const $el = $(element);
      const id = $el.attr("data-id") ?? "";
      const title = $el.find(".title").text().trim();
      const cover = $el.find("img").attr("src") ?? "";

      return {
        source: PLUGIN_ID,
        id,
        title,
        subtitle: "",
        finished: false,
        likesCount: 0,
        viewsCount: 0,
        updatedAt: "",
        cover: {
          id,
          url: cover || "https://example.com/placeholder.jpg",
          name: "cover",
          path: cover || "https://example.com/placeholder.jpg",
          extern: {},
        },
        metadata: [],
        raw: {},
        extern: {},
      };
    })
    .get()
    .filter((item) => item.id && item.title);
}
```

### 与 cheerio 的关系

- `BreezeHtml` 不是完整 cheerio，只覆盖了插件开发中最常用的选择器与遍历操作。
- 如果你需要 cheerio 的高级功能（例如复杂的 DOM 修改、序列化控制），仍然可以自行安装 cheerio 并打包进 bundle。
- `breeze-plugin-kit` 提供了兼容别名：`CheerioAPI` 对应 `BreezeApi`，`Cheerio` 对应 `BreezeSelection`，方便从 cheerio 迁移。

### TypeScript 类型

`breeze-plugin-kit` 会自动注入 `BreezeHtml` 的全局类型，无需额外声明：

```ts
import type { CheerioAPI, Cheerio } from "breeze-plugin-kit";
```

## Base64

运行时提供两个全局便捷函数用于 Base64 编解码：

```ts
const bytes = bytesFromBase64("aGVsbG8="); // Uint8Array
const text = bytesToBase64(new TextEncoder().encode("hello")); // "aGVsbG8="
```

`breeze-plugin-kit` 也导出了同名函数与类型，推荐从包中导入：

```ts
import { bytesToBase64, bytesFromBase64 } from "breeze-plugin-kit";
```

通常与 `crypto` 配合使用：先解密得到 `Uint8Array`，再用 `bytesToBase64` 转成字符串。

## hostCrypto 与 \_\_web

除了把 `crypto` 挂载到 `globalThis.crypto`，运行时还会暴露：

- `hostCrypto` — 与 `crypto` 指向同一对象，可作为兜底读取方式。
- `__web` — 运行时内部总线，包含全部注入能力（`fs`、`path`、`native`、`bridge`、`base64`、`crypto`、`uuidv4` 等）。

一般不推荐直接使用 `__web`，因为它暴露的 `fs` 在真实 Breeze 宿主中并不存在。建议通过 `breeze-plugin-kit` 的封装或全局具名对象（`bridge`、`native`、`BreezeHtml` 等）访问具体能力。

## 完整开发范式

一个典型的插件接口实现会组合使用以下运行时 API：

```ts
import {
  requireCryptoLike,
  bytesToBase64,
  bytesFromBase64,
} from "breeze-plugin-kit";
import type {
  SearchComicPayload,
  SearchResultContract,
} from "breeze-plugin-kit";

const crypto = requireCryptoLike();

async function searchComic(
  payload: SearchComicPayload,
): Promise<SearchResultContract> {
  // 1. 构造请求
  const url = `https://api.example.com/search?q=${encodeURIComponent(payload.keyword ?? "")}&page=${payload.page ?? 1}`;

  // 2. 请求 HTML
  const res = await fetch(url);
  const html = await res.text();

  // 3. 用 BreezeHtml 解析
  const $ = BreezeHtml.load(html);
  const items = $(".item")
    .map((_, el) => {
      const $el = $(el);
      return {
        id: $el.attr("data-id") ?? "",
        title: $el.find(".title").text().trim(),
        coverUrl: $el.find("img").attr("src") ?? "",
      };
    })
    .get();

  // 4. 必要时做摘要/加密
  const sign = await crypto.md5(url);

  // ... 组装 SearchResultContract
}
```
