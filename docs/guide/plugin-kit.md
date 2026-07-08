# breeze-plugin-kit 工具包

`breeze-plugin-kit` 是 Breeze 官方维护的插件开发工具包，包含两类内容：

1. **TypeScript 类型声明**：所有 `fnPath` 的契约类型、运行时全局 API 的类型定义。
2. **常用工具函数**：对 `bridge` 路由的便捷封装，例如 `cache`、`pluginConfig`、`opencc`、`flutterTools`、`runtime`。

示例仓库已经把它拆成独立的 npm 包，新插件可以直接安装使用。

## 安装

```bash
pnpm add breeze-plugin-kit
```

然后在 `tsconfig.json` 里确保模块解析能处理 ESM：

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

## 使用类型

所有插件契约类型都从包入口统一导出：

```ts
import type {
  InfoContract,
  SearchComicPayload,
  SearchResultContract,
  ComicDetailContract,
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

运行时全局对象的类型也会自动注入，例如 `bridge`、`crypto`、`native`、`fs` 等，无需额外声明。

## 工具函数

### `cache` — 进程内缓存

缓存的生命周期跟随**宿主应用进程**，而不是单个 QuickJS 实例。即使 QuickJS 实例被销毁或插件热更新重建，缓存数据仍然保留，直到宿主应用（Breeze App）本身重启才会清空。适合缓存跨页面/跨调用的短期计算结果或请求结果。

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

方法列表：

| 方法 | 说明 |
| --- | --- |
| `cache.get<T>(key, fallback)` | 异步读取 |
| `cache.getSync(key, fallback)` | 同步读取 |
| `cache.set(key, value)` | 异步写入 |
| `cache.setSync(key, value)` | 同步写入 |
| `cache.setIfAbsent(key, value)` | 仅当不存在时写入 |
| `cache.compareAndSet(key, expected, next)` | CAS 更新 |
| `cache.delete(key)` | 删除 |

### `pluginConfig` — 持久化配置

配置会持久化到宿主数据库，跨重启保留。适合保存用户账号、主题、画质等设置。

```ts
import { pluginConfig } from "breeze-plugin-kit";

// 保存
await pluginConfig.save("auth.account", JSON.stringify({ value: "user" }));

// 读取：返回 '{"ok":true,"value":...}' 格式字符串，需要 JSON.parse
const raw = await pluginConfig.load("auth.account", "");
const { value } = JSON.parse(raw);
```

> 注意：`save` 的 `value` 是字符串。Dart 端会尝试 `jsonDecode`：成功则存解码后的值，失败则存原字符串。

### `runtime` — 运行时工具

```ts
import { runtime } from "breeze-plugin-kit";

// 触发宿主 GC
await runtime.gc();

// 检查下载任务组是否被取消
const cancelled = await runtime.isTaskGroupCancelled(taskGroupKey);
if (cancelled) return new Uint8Array(0);
```

### `opencc` — 简繁转换

```ts
import { opencc } from "breeze-plugin-kit";

const simplified = await opencc.convert("繁體字", "t2s.json");
// 返回 "繁体字"
```

支持的配置文件：

- `s2t.json`：简体 → 繁体
- `t2s.json`：繁体 → 简体
- `s2tw.json`：简体 → 台湾繁体
- `tw2s.json`：台湾繁体 → 简体
- `s2hk.json`：简体 → 香港繁体
- `hk2s.json`：香港繁体 → 简体

### `flutterTools` — Flutter 宿主交互

```ts
import { flutterTools } from "breeze-plugin-kit";

// 获取 App 版本号
const version = await flutterTools.getAppVersion();

// 显示 Toast
await flutterTools.showToast({
  message: "保存成功",
  title: "提示",
  seconds: 2,
  level: "success", // "info" | "success" | "warning" | "error"
});
```

### `crypto` — 加密解密

> ⚠️ **重要：Breeze 的 `crypto` 既不是 Web Crypto API，也不是 Node.js 的 `crypto` 模块。** 它是 Breeze 运行时注入的自定义加密对象，API 形态与两者都不兼容。因此**不要直接使用全局 `crypto`**，否则 TypeScript / tsserver 会按 Web/Node 的类型推导，导致类型错误和运行时行为不符。
>
> 请始终通过 `breeze-plugin-kit` 显式获取：

```ts
import { requireCryptoLike, hostRuntime } from "breeze-plugin-kit";

// 推荐：获取 Breeze 运行时注入的 crypto 对象
const crypto = requireCryptoLike();

// 或者通过 hostRuntime 获取
const crypto = hostRuntime.crypto;
```

常用方法：

```ts
// 摘要
const md5 = await crypto.md5("hello");
const sha256 = await crypto.sha256("hello");
const hmac = await crypto.hmacSha256("key", "hello");

// AES-CBC-PKCS7（输入可以是 string / Uint8Array / 等，输出 Uint8Array）
const encrypted = await crypto.aesCbcPkcs7Encrypt(plainText, key, iv);
const decrypted = await crypto.aesCbcPkcs7Decrypt(encrypted, key, iv);

// AES-GCM
const encrypted = await crypto.aesGcmEncrypt(plainText, key, nonce, aad);
const decrypted = await crypto.aesGcmDecrypt(encrypted, key, nonce, aad);

// AES-ECB-PKCS7（同时提供加密和解密；ECB 模式安全性较弱，一般不推荐用于新数据）
const encrypted = await crypto.aesEcbPkcs7Encrypt(plainText, key);
const decrypted = await crypto.aesEcbPkcs7Decrypt(encrypted, key);

// 流式哈希
const hash = crypto.createHash("sha256").update("hello").digest("hex");

// 随机
const buf = crypto.randomBytes(16);
const uuid = crypto.randomUUID();
```

需要 Base64 编解码时，可以配合 `bytesToBase64` / `bytesFromBase64`：

```ts
import { requireCryptoLike, bytesToBase64, bytesFromBase64 } from "breeze-plugin-kit";

const crypto = requireCryptoLike();

const encrypted = await crypto.aesCbcPkcs7Encrypt("hello", key, iv);
const b64 = bytesToBase64(encrypted);

const decrypted = await crypto.aesCbcPkcs7Decrypt(bytesFromBase64(b64), key, iv);
```

如果习惯了 Base64 入参的便捷方法，也可以用 `hostRuntime` 上已废弃的封装：

```ts
import { hostRuntime } from "breeze-plugin-kit";

const plainB64 = await hostRuntime.aesCbcPkcs7DecryptB64(b64Cipher, key, iv);
```

> 新插件建议优先使用 `crypto.aesCbcPkcs7Encrypt` / `crypto.aesCbcPkcs7Decrypt`，逻辑更清晰。

## 运行时 API 封装

如果你不想直接操作全局变量，可以用 `hostRuntime`、`getApi`、`requireApi`、`requireCryptoLike`：

```ts
import { hostRuntime, getApi, requireApi, requireCryptoLike } from "breeze-plugin-kit";

// 强制获取某个 API（不存在则抛错）
const bridge = requireApi("bridge");

// 获取 crypto（兼容 globalThis.crypto 和运行时注入）
const crypto = requireCryptoLike();

// 使用封装好的 hostRuntime
const md5 = await hostRuntime.md5Hex("hello");
const compressed = await hostRuntime.gzipCompress(new Uint8Array([1, 2, 3]));
```

> `hostRuntime` 上带 `@deprecated` 的方法是为了兼容旧代码，新插件建议直接使用 `crypto.*` 或 `bridge.call`。

> ⚠️ **注意：`fs` API 虽然有类型声明，但 Breeze 不会向插件注入 `fs`。** 这是出于安全考虑：允许插件直接访问宿主文件系统风险过高。插件应通过 `fetch` 等网络请求与外部交互，不要使用 `getApi("fs")` 或 `hostRuntime.fs`。

## 在设置回调里组合使用

设置页字段变更时，如果字段设置了 `persist: true`，宿主会自动把值保存到本地数据库，插件回调是可选的。只有当你需要做额外校验、联动逻辑或给用户反馈时，才需要实现对应的回调：

```ts
import { pluginConfig, flutterTools } from "breeze-plugin-kit";

async function onThemeChanged(payload: SettingChangedPayload<string>) {
  await pluginConfig.save(payload.key, JSON.stringify({ value: payload.value }));

  await flutterTools.showToast({
    message: `主题已切换为 ${payload.value}`,
    level: "info",
    seconds: 2,
  });

  return {};
}
```

## 完整示例：下载图片

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
    // 必须：强制宿主以原始二进制字节流返回图片，避免被预处理导致数据损坏
    headers: { "x-rquickjs-host-offload-binary-v1": "1" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`下载失败: ${res.status}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}
```

> 不带 `x-rquickjs-host-offload-binary-v1: 1` 时，宿主可能对响应做字符串化或编码转换，导致拿到的 `Uint8Array` 不是原始图片数据，从而出现图片无法解码、显示空白或尺寸异常等问题。

## 最佳实践

- **`cache` 生命周期跟随宿主进程**，适合跨 QJS 实例保留的短期数据；需要跨应用重启保留的数据用 `pluginConfig`。
- **`pluginConfig.save` 的值是字符串**，存对象时记得 `JSON.stringify`。
- **`pluginConfig.load` 的返回值也要 `JSON.parse`** 才能拿到 `value`。
- **`ImageItem.url` 必须是有效格式的非空字符串**，即使插件自己处理下载。
- **`fetchImageBytes` 必须带 `x-rquickjs-host-offload-binary-v1: 1`**，确保拿到原始二进制图片数据。
- **下载前检查 `runtime.isTaskGroupCancelled`**，避免取消后仍继续下载。
