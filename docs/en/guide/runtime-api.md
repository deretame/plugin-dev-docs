# Runtime API

Breeze plugins run in the QuickJS-NG engine — not Node.js and not a browser.
Below are the extra globals provided by the runtime beyond standard ECMAScript.

## Global Objects

Globals available after plugin startup:

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
- `Intl` (time-focused subset; see [Intl](#intl))
- `BreezeHtml`
- `bytesToBase64` / `bytesFromBase64`
- `hostCrypto`
- `__web`

> ⚠️ **Note: `fs` is not available.** `breeze-plugin-kit` keeps `fs` type declarations for running plugin code in pure Node.js test environments, but Breeze **does not inject an `fs` API into the real plugin runtime**. This is intentional for security: direct host filesystem access is too risky. Plugins should talk to the outside world via `fetch` and similar network APIs — do not use `fs` in plugins.

## fetch

Standard `fetch` implementation.

```js
const res = await fetch("https://api.example.com/data");
const data = await res.json(); // JSON
const text = await res.text(); // text
const blob = await res.blob(); // Blob
const buf = await res.arrayBuffer(); // ArrayBuffer
```

Companion objects `Request`, `Response`, `Headers`, `AbortController`, `AbortSignal`, `FormData`, `Blob`, and `File` are all available.

```js
// Timeout control
const ac = new AbortController();
setTimeout(() => ac.abort(), 10000);
const res = await fetch(url, { signal: ac.signal });

// Or
const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
```

### Binary Response Optimization

For binary responses (e.g. image downloads), strongly recommend this request header:

```
x-rquickjs-host-offload-binary-v1: 1
```

Effect: explicitly declare “this response must be returned as raw binary” so the host passes the byte stream through to the plugin. Without this header, the host may preprocess binary responses (stringify, re-encode, or wrap), causing corrupted data, wrong length, or image decode failures.

```js
const res = await fetch(url, {
  headers: { "x-rquickjs-host-offload-binary-v1": "1" },
});
const buf = await res.arrayBuffer();
```

> Recommendation: **always include this header** in `fetchImageBytes`. Missing it is one of the most common reasons images fail to display.

## bridge

The sole bridge between the plugin and the Rust host.

### Methods

- `bridge.call(name, ...args)` — async host route call
- `bridge.callSync(name, ...args)` — sync call (blocks; use carefully)
- `bridge.gzipCompress(input)` — gzip compress
- `bridge.gzipDecompress(input)` — gzip decompress

### Built-in Routes

These routes work out of the box:

**Compression**

- `compression.gzip_compress`
- `compression.gzip_decompress`

**Native**

- `native.put`
- `native.take`
- `native.exec`

**Math**

- `math.add`

> Crypto routes (`crypto.*`) are covered under [crypto](#crypto) below and are not repeated here.

## native

Byte buffer pool for binary data. Most cases only need `fetch` and `bridge`; direct use is not recommended.

Main methods:

- `native.put(input)` — put data into the pool, returns id
- `native.take(id)` — take data from the pool
- `native.free(id)` — free buffer

## console

```js
console.log("...");
console.info("...");
console.warn("...");
console.error("...");
console.debug("...");
```

Output goes to host logs. Other console methods fall back to `console.log`-level behavior.

## crypto

> ⚠️ **Important: Breeze `crypto` is neither the Web Crypto API nor the Node.js `crypto` module.** Although the runtime mounts `crypto` on `globalThis`, its API shape is incompatible with both. Do not call `crypto.xxx()` and rely on tsserver type inference — you will get wrong types.
>
> Correct approach: import explicitly from `breeze-plugin-kit`:
>
> ```ts
> import { requireCryptoLike } from "breeze-plugin-kit";
> const crypto = requireCryptoLike();
> ```
>
> See [breeze-plugin-kit Toolkit](/en/guide/plugin-kit#crypto-encryption--decryption).

Breeze injects a **subset** of a Node.js-compatible crypto API, not a full implementation.

### Supported Methods

```js
// Hash (returns hex string)
crypto.md5(input)
crypto.sha1(input)
crypto.sha256(input)
crypto.sha512(input)

// HMAC (returns hex string)
crypto.hmacSha1(key, input)
crypto.hmacSha256(key, input)
crypto.hmacSha512(key, input)

// Streaming hash
crypto.createHash("sha256" | "sha-256")
crypto.createHash("sha1"   | "sha-1")
crypto.createHash("sha512" | "sha-512")

// Streaming HMAC
crypto.createHmac("sha256" | "sha-256", key)
crypto.createHmac("sha1"   | "sha-1", key)
crypto.createHmac("sha512" | "sha-512", key)

// AES (input may be string / Uint8Array / ArrayBuffer / ArrayBufferView / number[]; output Uint8Array)
crypto.aesEcbPkcs7Encrypt(input, keyRaw)
crypto.aesEcbPkcs7Decrypt(input, keyRaw)
crypto.aesCbcPkcs7Encrypt(input, keyRaw, ivRaw)
crypto.aesCbcPkcs7Decrypt(input, keyRaw, ivRaw)
crypto.aesGcmEncrypt(input, keyRaw, nonceRaw, aad?)
crypto.aesGcmDecrypt(input, keyRaw, nonceRaw, aad?)

// Legacy base64 wrappers (deprecated, still compatible)
crypto.aesCbcPkcs7EncryptB64(payloadB64, keyRaw, ivRaw)
crypto.aesCbcPkcs7DecryptB64(payloadB64, keyRaw, ivRaw)
crypto.aesGcmEncryptB64(payloadB64, keyRaw, nonceRaw, aadB64?)
crypto.aesGcmDecryptB64(payloadB64, keyRaw, nonceRaw, aadB64?)

// Utilities
crypto.randomBytes(size)
crypto.randomUUID()
crypto.timingSafeEqual(a, b)

// PBKDF2
crypto.pbkdf2Sync(password, salt, iterations, keyLen, digest?)
crypto.pbkdf2(password, salt, iterations, keyLen, digest?, callback)
```

### Supported Encodings

`utf8` / `utf-8` / `hex` / `base64` / `latin1` / `binary` / `buffer`

### Notes

- `pbkdf2` / `pbkdf2Sync` currently always use sha256
- ECB, CBC, and GCM all provide encrypt and decrypt
- **Prefer `const crypto = requireCryptoLike()` then `crypto.aes*`**; avoid calling `bridge.call("crypto.*")` routes directly
- Legacy `_hex` / `_b64` APIs are ambiguous and deprecated

```ts
import {
  requireCryptoLike,
  bytesToBase64,
  bytesFromBase64,
} from "breeze-plugin-kit";

const crypto = requireCryptoLike();

// Digest
const md5 = await crypto.md5("text");

// Streaming hash
const hash = crypto.createHash("sha256").update("text").digest("hex");

// AES-CBC
const encrypted = await crypto.aesCbcPkcs7Encrypt("text", key, iv);
const decrypted = await crypto.aesCbcPkcs7Decrypt(encrypted, key, iv);

// Base64 conversion
const b64 = bytesToBase64(encrypted);
const bytes = bytesFromBase64(b64);

// Legacy bridge route (not recommended; use crypto.aesCbcPkcs7Decrypt above)
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

> For `Buffer` types, import type declarations from `breeze-plugin-kit` so tsserver does not infer Node.js / DOM types incorrectly:
>
> ```ts
> import type { Buffer } from "breeze-plugin-kit";
> ```

Breeze injects a **Node.js-compatible Buffer subset**, not a browser `ArrayBuffer` wrapper.

```js
Buffer.from(data, encoding?)
Buffer.alloc(size)
Buffer.isBuffer(obj)
Buffer.byteLength(string, encoding?)
```

## path

Path utilities, compatible with a Node.js `path` subset.

```js
path.join("/a", "b", "../c"); // "/a/c"
path.resolve("a", "b"); // absolute path
path.dirname("/a/b/c.txt"); // "/a/b"
path.basename("/a/b/c.txt"); // "c.txt"
path.extname("/a/b/c.txt"); // ".txt"
```

## TextEncoder / TextDecoder

UTF-8 encode/decode.

```js
const bytes = new TextEncoder().encode("hello");
const text = new TextDecoder().decode(bytes);
```

## structuredClone

```js
const copy = structuredClone({ a: 1, b: [2, 3] });
```

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

## Type Definitions

Types are provided by the `breeze-plugin-kit` package:

```bash
pnpm add breeze-plugin-kit
```

```ts
import type {
  SearchResultContract,
  ComicDetailContract,
} from "breeze-plugin-kit";
```

Main modules:

- Request/response shapes for every plugin `fnPath`
- Runtime global types (`bridge`, `crypto`, `native`, `Temporal`, `Intl`, `fs`, etc.)
- Helpers such as `hostRuntime`, `getApi`, `requireApi`

See [breeze-plugin-kit Toolkit](/en/guide/plugin-kit).

## Convenience Wrappers

`breeze-plugin-kit` provides wrappers for common needs:

- `cache.*` — in-process cache (lifetime follows host process)
- `pluginConfig.*` — persistent config
- `opencc.*` — Simplified/Traditional Chinese conversion
- `flutterTools.*` — Flutter host interaction (Toast, version, etc.)
- `runtime.*` — runtime utilities (GC, task-group cancel checks, etc.)

Details: [breeze-plugin-kit Toolkit](/en/guide/plugin-kit).

## Common Usage

```ts
import { requireCryptoLike } from "breeze-plugin-kit";

const crypto = requireCryptoLike();
const encoder = new TextEncoder();

// 1. fetch data
const res = await fetch("https://api.example.com/list");
const data = await res.json();

// 2. crypto digest
const md5 = await crypto.md5(encoder.encode("data"));
const sha256 = crypto
  .createHash("sha256")
  .update(encoder.encode("data"))
  .digest("hex");

// 3. console logging
console.log("result:", data);
```

## BreezeHtml

`BreezeHtml` is a **Rust-native HTML parse & manipulate API** injected by the Breeze runtime. It implements a common cheerio subset. For plugins that parse HTML pages (lists, details, chapters), prefer it over bundling cheerio-like libraries — smaller bundles and better parse performance.

### Basic Usage

```ts
const $ = BreezeHtml.load(html);

// Select elements
const title = $("title").text();
const links = $("a")
  .map((_, el) => $(el).attr("href"))
  .get()
  .filter(Boolean);
```

### Supported API

| Method | Description |
| ------ | ----------- |
| `BreezeHtml.load(html)` | Load HTML string; returns `$` selector |
| `$(selector)` | Find elements by CSS selector |
| `.find(selector)` | Find within current selection |
| `.first()` / `.last()` / `.eq(i)` | Pick nth match |
| `.closest(selector)` / `.parent()` / `.children(sel?)` / `.siblings(sel?)` / `.next(sel?)` / `.prev(sel?)` | DOM traversal |
| `.is(selector)` | Match test |
| `.filter(selector \| fn)` / `.has(selector)` / `.slice(start, end?)` / `.index()` | Filter & index |
| `.attr(name)` | Read attribute |
| `.text()` | Read plain text |
| `.html()` | Read HTML string |
| `.val()` | Read form value |
| `.toArray()` | Selection as array |
| `.each(fn)` | Iterate matches |
| `.map(fn)` | Map matches; `get()` for result array |

### Full Example: Parse Search List

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

### Relationship to cheerio

- `BreezeHtml` is not full cheerio; it covers selectors and traversal common in plugin work.
- For advanced cheerio features (complex DOM mutation, serialization control), you may still install and bundle cheerio.
- `breeze-plugin-kit` provides aliases: `CheerioAPI` → `BreezeApi`, `Cheerio` → `BreezeSelection`, for easier migration.

### TypeScript Types

`breeze-plugin-kit` injects global `BreezeHtml` types automatically:

```ts
import type { CheerioAPI, Cheerio } from "breeze-plugin-kit";
```

## Base64

Two global helpers for Base64 encode/decode:

```ts
const bytes = bytesFromBase64("aGVsbG8="); // Uint8Array
const text = bytesToBase64(new TextEncoder().encode("hello")); // "aGVsbG8="
```

`breeze-plugin-kit` also exports the same names and types; prefer importing from the package:

```ts
import { bytesToBase64, bytesFromBase64 } from "breeze-plugin-kit";
```

Often used with `crypto`: decrypt to `Uint8Array`, then `bytesToBase64` for a string.

## hostCrypto and \_\_web

Besides mounting `crypto` on `globalThis.crypto`, the runtime also exposes:

- `hostCrypto` — same object as `crypto`, fallback access path
- `__web` — internal runtime bus with all injected capabilities (`fs`, `path`, `native`, `bridge`, `base64`, `crypto`, `uuidv4`, etc.)

Prefer not to use `__web` directly; its `fs` does not exist on real Breeze hosts. Use `breeze-plugin-kit` wrappers or named globals (`bridge`, `native`, `BreezeHtml`, etc.).

## Full Development Pattern

A typical plugin API combines these runtime APIs:

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
  // 1. Build request
  const url = `https://api.example.com/search?q=${encodeURIComponent(payload.keyword ?? "")}&page=${payload.page ?? 1}`;

  // 2. Fetch HTML
  const res = await fetch(url);
  const html = await res.text();

  // 3. Parse with BreezeHtml
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

  // 4. Digest / encrypt if needed
  const sign = await crypto.md5(url);

  // ... assemble SearchResultContract
}
```
