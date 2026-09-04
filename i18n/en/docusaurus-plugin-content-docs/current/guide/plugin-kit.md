# breeze-plugin-kit Toolkit

`breeze-plugin-kit` is the official Breeze plugin toolkit. It includes:

1. **TypeScript type declarations**: contract types for every `fnPath` and runtime global API types.
2. **Common helpers**: wrappers over `bridge` routes such as `cache`, `pluginConfig`, `opencc`, `flutterTools`, `runtime`, and `pictureTools`.

The example repository ships it as a standalone npm package that new plugins can install directly.

## Install

```bash
pnpm add breeze-plugin-kit
```

Ensure `tsconfig.json` can resolve ESM:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

## Using Types

All plugin contract types are exported from the package entry:

```ts
import type {
  InfoContract,
  SearchComicPayload,
  SearchResultContract,
  ComicDetailContract,
  PreviewPayload,
  PreviewContentContract,
  ChapterContentContract,
  ReadSnapshotContract,
  FetchImageBytesPayload,
  ToggleLikePayload,
  ToggleFavoritePayload,
  CommentFeedContract,
  CommentPostPayload,
  AdvancedSearchContract,
  ComicListSceneBundleContract,
  FilterBundleContract,
  SettingsBundleContract,
  CapabilitiesBundleContract,
  UserInfoBundleContract,
  FunctionPageContract,
} from "breeze-plugin-kit";
```

Runtime global types are also injected automatically — e.g. `bridge`, `crypto`, `native`, `Temporal`, `Intl`, `BreezeHtml`, `bytesToBase64`, `bytesFromBase64` — no extra declarations needed.

### Temporal Types

After installing `breeze-plugin-kit`, use global `Temporal` with IDE completion and type checks:

```ts
const d: Temporal.PlainDate = Temporal.PlainDate.from("2024-03-15");
const zdt: Temporal.ZonedDateTime =
  Temporal.Now.zonedDateTimeISO("Asia/Shanghai");
const instant: Temporal.Instant = new Date().toTemporalInstant();
```

Full runtime notes: [Runtime API · Temporal](/guide/runtime-api/time-and-intl#temporal).

### Time-focused Intl Types

The host provides time-focused `Intl.DateTimeFormat` (no Collator / NumberFormat). Types are injected automatically:

```ts
const text = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "long",
  timeZone: "Asia/Shanghai",
}).format(Date.now());

const zones = Intl.supportedValuesOf("timeZone"); // string[]
```

Full notes: [Runtime API · Intl](/guide/runtime-api/time-and-intl#intl).

To type the return value of `BreezeHtml.load()`, import compatibility aliases:

```ts
import type { CheerioAPI, Cheerio } from "breeze-plugin-kit";

function parseSearchPage(html: string): ComicListItem[] {
  const $: CheerioAPI = BreezeHtml.load(html);

  return $(".item")
    .map((_, el) => {
      const $el: Cheerio = $(el);
      // ...
    })
    .get();
}
```

## HTML Parsing

`breeze-plugin-kit` provides full TypeScript support for `BreezeHtml`. `BreezeHtml` is the Rust-native HTML parser injected by the Breeze runtime, with an API compatible with a common cheerio subset.

### Why Prefer BreezeHtml

- **No bundling**: provided by the runtime; no need to ship cheerio in the bundle.
- **Better performance**: Rust-backed parsing is typically faster than pure JS parsers.
- **Type-friendly**: `CheerioAPI` / `Cheerio` compatibility aliases.

### Typical Usage

```ts
import type { CheerioAPI, ComicListItem } from "breeze-plugin-kit";

function parseList(html: string): ComicListItem[] {
  const $: CheerioAPI = BreezeHtml.load(html);

  return $(".comic-list > li")
    .map((_, el) => {
      const $el = $(el);
      return {
        source: PLUGIN_ID,
        id: $el.attr("data-id") ?? "",
        title: $el.find(".title").text().trim(),
        // ... other fields
      };
    })
    .get();
}
```

### Migrating from cheerio

Existing cheerio plugins usually only need to change:

```ts
import * as cheerio from "cheerio";
const $ = cheerio.load(html);
```

to:

```ts
const $ = BreezeHtml.load(html);
```

and import types from `import type { CheerioAPI, Cheerio } from "breeze-plugin-kit"`.

> `BreezeHtml` does not implement every advanced cheerio feature. If you need them, you can still bundle full cheerio.

## Helpers

### `cache` — In-Process Cache

Cache lifetime follows the **host app process**, not a single QuickJS instance. Even if the QJS instance is destroyed or the plugin hot-reloads, cache data remains until the Breeze app itself restarts. Suitable for short-lived results across pages/calls.

```ts
import { cache } from "breeze-plugin-kit";

async function searchComic(payload: SearchComicPayload) {
  const cacheKey = `search:${payload.keyword}:${payload.page}`;

  const cached = await cache.get<SearchResultContract | null>(cacheKey, null);
  if (cached) return cached;

  const result = await fetchSearchResult(payload);
  await cache.set(cacheKey, result);
  return result;
}
```

Methods:

| Method                                     | Description          |
| ------------------------------------------ | -------------------- |
| `cache.get<T>(key, fallback)`              | Async read           |
| `cache.getSync(key, fallback)`             | Sync read            |
| `cache.set(key, value)`                    | Async write          |
| `cache.setSync(key, value)`                | Sync write           |
| `cache.setIfAbsent(key, value)`            | Write only if absent |
| `cache.compareAndSet(key, expected, next)` | CAS update           |
| `cache.delete(key)`                        | Delete               |

### `pluginConfig` — Persistent Config

Config is persisted in the host database across restarts. Use for accounts, theme, quality, etc.

```ts
import { pluginConfig } from "breeze-plugin-kit";

// Save
await pluginConfig.save("auth.account", JSON.stringify({ value: "user" }));

// Load: returns '{"ok":true,"value":...}' string; JSON.parse required
const raw = await pluginConfig.load("auth.account", "");
const { value } = JSON.parse(raw);
```

> Note: `save` `value` is a string. The Dart side tries `jsonDecode`: on success it stores the decoded value; on failure it stores the raw string.

### `runtime` — Runtime Utilities

```ts
import { runtime } from "breeze-plugin-kit";

// Trigger host GC
await runtime.gc();

// Check whether a download task group was cancelled
const cancelled = await runtime.isTaskGroupCancelled(taskGroupKey);
if (cancelled) return new Uint8Array(0);
```

### `opencc` — Simplified/Traditional Conversion

```ts
import { opencc } from "breeze-plugin-kit";

const simplified = await opencc.convert("繁體字", "t2s.json");
// returns "繁体字"
```

Supported config files:

- `s2t.json`: Simplified → Traditional
- `t2s.json`: Traditional → Simplified
- `s2tw.json`: Simplified → Taiwan Traditional
- `tw2s.json`: Taiwan Traditional → Simplified
- `s2hk.json`: Simplified → Hong Kong Traditional
- `hk2s.json`: Hong Kong Traditional → Simplified

### `flutterTools` — Flutter Host Interaction

```ts
import { flutterTools } from "breeze-plugin-kit";

// App version
const version = await flutterTools.getAppVersion();

// Locale and time zone info (JSON string; JSON.parse required)
const raw = await flutterTools.getLocaleInfo();
const info = JSON.parse(raw);
console.log(info.language); // "zh"
console.log(info.locale); // "zh-CN"
console.log(info.systemLocale); // "zh-CN"
console.log(info.timeZone); // "Asia/Shanghai"
console.log(info.timezoneOffset); // "+08:00"
console.log(info.timezoneOffsetMinutes); // 480
console.log(info.timezoneName); // "CST"

// Toast
await flutterTools.showToast({
  message: "Saved",
  title: "Notice",
  seconds: 2,
  level: "success", // "info" | "success" | "warning" | "error"
});
```

`getLocaleInfo` fields:

| Field                   | Type     | Description                                            |
| ----------------------- | -------- | ------------------------------------------------------ |
| `language`              | `string` | App language code, e.g. `zh` / `en`                    |
| `locale`                | `string` | App locale as `languageCode_COUNTRYCODE`, e.g. `zh-CN` |
| `systemLocale`          | `string` | Preferred system locale raw string, e.g. `zh-CN`       |
| `timeZone`              | `string` | IANA time zone, e.g. `Asia/Shanghai`                   |
| `timeZoneIANA`          | `string` | Same as `timeZone`                                     |
| `timezoneOffset`        | `string` | Offset string, e.g. `+08:00` / `-05:00`                |
| `timezoneOffsetMinutes` | `number` | Offset in minutes                                      |
| `timezoneName`          | `string` | System zone abbreviation, e.g. `CST` / `EST`           |

### `pictureTools.cropImageByRegions` — Crop Image Regions

`cropImageByRegions` cuts multiple regions from one image into independent images. The coordinate origin is the top-left corner of the source image. Each returned `imgData` contains WebP bytes.

```ts
import { pictureTools } from "breeze-plugin-kit";
import type { ImageCropRegion } from "breeze-plugin-kit";

async function cropImage(imageData: Uint8Array) {
  const regions: ImageCropRegion[] = [
    { number: 1, x: 0, y: 0, width: 200, height: 300 },
    { number: 2, x: 200, y: 0, width: 200, height: 300 },
  ];

  const images = await pictureTools.cropImageByRegions(imageData, regions);
  for (const image of images) {
    console.log(image.number, image.imgData); // Uint8Array containing WebP bytes
  }
  return images;
}
```

Inputs:

- `imageData`: source image bytes as `Uint8Array`, `ArrayBuffer`, `ArrayBufferView`, or `number[]`.
- `regions`: crop regions; each item contains an identifier `number`, top-left coordinates `x` / `y`, and dimensions `width` / `height`.

The function returns a Promise whose items contain `number` and `imgData: Uint8Array`; each number corresponds to its input region.

### `crypto` — Encryption / Decryption

> ⚠️ **Important: Breeze `crypto` is neither Web Crypto API nor Node.js `crypto`.** It is a custom object injected by the Breeze runtime. **Do not use global `crypto` directly** — TypeScript / tsserver will infer Web/Node types and mismatch runtime behavior.
>
> Always obtain it via `breeze-plugin-kit`:

```ts
import { requireCryptoLike, hostRuntime } from "breeze-plugin-kit";

// Recommended: Breeze runtime crypto
const crypto = requireCryptoLike();

// Or via hostRuntime
const crypto = hostRuntime.crypto;
```

Common methods:

```ts
// Digests
const md5 = await crypto.md5("hello");
const sha256 = await crypto.sha256("hello");
const hmac = await crypto.hmacSha256("key", "hello");

// AES-CBC-PKCS7 (input string / Uint8Array / etc.; output Uint8Array)
const encrypted = await crypto.aesCbcPkcs7Encrypt(plainText, key, iv);
const decrypted = await crypto.aesCbcPkcs7Decrypt(encrypted, key, iv);

// AES-GCM
const encrypted = await crypto.aesGcmEncrypt(plainText, key, nonce, aad);
const decrypted = await crypto.aesGcmDecrypt(encrypted, key, nonce, aad);

// AES-ECB-PKCS7 (encrypt and decrypt; ECB is weak — avoid for new data)
const encrypted = await crypto.aesEcbPkcs7Encrypt(plainText, key);
const decrypted = await crypto.aesEcbPkcs7Decrypt(encrypted, key);

// Streaming hash
const hash = crypto.createHash("sha256").update("hello").digest("hex");

// Random
const buf = crypto.randomBytes(16);
const uuid = crypto.randomUUID();
```

For Base64, pair with `bytesToBase64` / `bytesFromBase64`:

```ts
import {
  requireCryptoLike,
  bytesToBase64,
  bytesFromBase64,
} from "breeze-plugin-kit";

const crypto = requireCryptoLike();

const encrypted = await crypto.aesCbcPkcs7Encrypt("hello", key, iv);
const b64 = bytesToBase64(encrypted);

const decrypted = await crypto.aesCbcPkcs7Decrypt(
  bytesFromBase64(b64),
  key,
  iv,
);
```

If you prefer Base64-input helpers, deprecated wrappers on `hostRuntime` still exist:

```ts
import { hostRuntime } from "breeze-plugin-kit";

const plainB64 = await hostRuntime.aesCbcPkcs7DecryptB64(b64Cipher, key, iv);
```

> New plugins should prefer `crypto.aesCbcPkcs7Encrypt` / `crypto.aesCbcPkcs7Decrypt`.

## Runtime API Wrappers

If you prefer not to touch globals, use `hostRuntime`, `getApi`, `requireApi`, and `requireCryptoLike`:

```ts
import {
  hostRuntime,
  getApi,
  requireApi,
  requireCryptoLike,
} from "breeze-plugin-kit";

// Require an API (throws if missing)
const bridge = requireApi("bridge");

// Get crypto (compatible with globalThis.crypto and runtime injection)
const crypto = requireCryptoLike();

// hostRuntime helpers
const md5 = await hostRuntime.md5Hex("hello");
const compressed = await hostRuntime.gzipCompress(new Uint8Array([1, 2, 3]));
```

> `@deprecated` methods on `hostRuntime` exist for legacy code; new plugins should use `crypto.*` or `bridge.call`.

> ⚠️ **Note: `fs` has type declarations but Breeze does not inject `fs` into plugins.** This is intentional for security. Use `fetch` and other network APIs — do not use `getApi("fs")` or `hostRuntime.fs`.

## Combining in Settings Callbacks

```ts
import { pluginConfig, flutterTools } from "breeze-plugin-kit";

async function onThemeChanged(payload: SettingChangedPayload<string>) {
  await pluginConfig.save(
    payload.key,
    JSON.stringify({ value: payload.value }),
  );

  await flutterTools.showToast({
    message: `Theme switched to ${payload.value}`,
    level: "info",
    seconds: 2,
  });

  return {};
}
```

## Full Example: Download Image

```ts
import { runtime } from "breeze-plugin-kit";

async function fetchImageBytes({
  url,
  timeoutMs = 30000,
  taskGroupKey = "",
}: FetchImageBytesPayload): Promise<Uint8Array> {
  if (taskGroupKey && (await runtime.isTaskGroupCancelled(taskGroupKey))) {
    return new Uint8Array(0);
  }

  const res = await fetch(url, {
    // Required: force host to return raw binary image bytes
    headers: { "x-rquickjs-host-offload-binary-v1": "1" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}
```

> Without `x-rquickjs-host-offload-binary-v1: 1`, the host may stringify or re-encode the response so the `Uint8Array` is not raw image data, causing decode failures, blank images, or wrong dimensions.

## Best Practices

- **`cache` lifetime follows the host process** — good for short-lived data across QJS instances; use `pluginConfig` for data that must survive app restarts.
- **`pluginConfig.save` values are strings** — `JSON.stringify` objects before saving.
- **`pluginConfig.load` results also need `JSON.parse`** to read `value`.
- **`ImageItem.url` must be a valid non-empty string**, even when the plugin handles downloads itself.
- **`fetchImageBytes` must send `x-rquickjs-host-offload-binary-v1: 1`** for raw binary image data.
- **Check `runtime.isTaskGroupCancelled` before download** to stop cancelled task groups.
