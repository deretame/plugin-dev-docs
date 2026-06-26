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
- `fs`
- `path`
- `native`
- `bridge`
- `uuidv4`
- `__web`（运行时总线，包含以上全部能力）

## 推荐入口：`hostRuntime`

示例仓库提供了类型化的便捷封装，推荐在 TypeScript 插件中使用：

```ts
import { hostRuntime } from "../types/runtime-api";

const md5 = await hostRuntime.crypto.md5("hello");
const sha = hostRuntime.crypto.createHash("sha256").update("text").digest("hex");
const key = hostRuntime.uuidv4();
const data = await hostRuntime.gzipCompress(new Uint8Array([1, 2, 3]));
```

等价地，你也可以直接操作全局对象：

```ts
const md5 = await crypto.md5("hello");
const sha = crypto.createHash("sha256").update("text").digest("hex");
```

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

对于返回二进制的接口，在请求头中加入以下字段可让宿主直接以二进制方式解析响应，避免不必要的类型转换：

```
x-rquickjs-host-offload-binary-v1: 1
```

```js
const res = await fetch(url, {
  headers: { "x-rquickjs-host-offload-binary-v1": "1" },
});
const buf = await res.arrayBuffer();
```

## bridge

插件与 Rust 宿主通信的唯一桥梁。

### 方法

- `bridge.call(name, ...args)` — 异步调用宿主路由
- `bridge.callSync(name, ...args)` — 同步调用（会阻塞，谨慎使用）
- `bridge.gzipCompress(input)` — gzip 压缩
- `bridge.gzipDecompress(input)` — gzip 解压

### 内建路由

以下路由开箱即用，无需注册：

**摘要（推荐）**

- `crypto.md5`
- `crypto.sha1`
- `crypto.sha256`
- `crypto.sha512`
- `crypto.hmac_sha1`
- `crypto.hmac_sha256`
- `crypto.hmac_sha512`

**摘要（旧版，已废弃）**

- `crypto.md5_hex`
- `crypto.sha1_hex`
- `crypto.sha256_hex`
- `crypto.sha512_hex`
- `crypto.hmac_sha1_hex`
- `crypto.hmac_sha256_hex`
- `crypto.hmac_sha512_hex`

**AES（推荐，输入输出均为原始字节）**

- `crypto.aes_ecb_pkcs7_decrypt`
- `crypto.aes_ecb_pkcs7_encrypt`
- `crypto.aes_cbc_pkcs7_encrypt`
- `crypto.aes_cbc_pkcs7_decrypt`
- `crypto.aes_gcm_encrypt`
- `crypto.aes_gcm_decrypt`

**AES（旧版 base64，已废弃）**

- `crypto.aes_ecb_pkcs7_decrypt_b64`
- `crypto.aes_cbc_pkcs7_encrypt_b64`
- `crypto.aes_cbc_pkcs7_decrypt_b64`
- `crypto.aes_gcm_encrypt_b64`
- `crypto.aes_gcm_decrypt_b64`

**压缩**

- `compression.gzip_compress`
- `compression.gzip_decompress`

**原生**

- `native.put`
- `native.take`
- `native.exec`

**数学**

- `math.add`

### 说明

- 参数中的二进制数据会自动转为宿主端 buffer
- 返回的二进制数据会自动还原为 `Uint8Array`

```js
const md5 = await bridge.call("crypto.md5", new TextEncoder().encode("hello"));
const compressed = await bridge.call(
  "compression.gzip_compress",
  new Uint8Array([1, 2, 3]),
);
```

## crypto

Node.js 兼容的加密 API **子集**，非完整实现。优先使用 `crypto.*` 便捷方法，而不是直接调 `bridge.call("crypto.*", ...)`。

### 支持的方法

```js
// 流式哈希
crypto.createHash("sha1"   | "sha-1")
crypto.createHash("sha256" | "sha-256")
crypto.createHash("sha512" | "sha-512")

// 流式 HMAC
crypto.createHmac("sha1"   | "sha-1",   key)
crypto.createHmac("sha256" | "sha-256", key)
crypto.createHmac("sha512" | "sha-512", key)

// 便捷摘要（返回 hex 字符串）
crypto.md5(input)
crypto.sha1(input)
crypto.sha256(input)
crypto.sha512(input)

// 便捷 HMAC（返回 hex 字符串）
crypto.hmacSha1(key, input)
crypto.hmacSha256(key, input)
crypto.hmacSha512(key, input)

// 工具
crypto.randomBytes(size)        // 返回 Buffer
crypto.randomUUID()             // 返回 UUID v4 字符串
crypto.timingSafeEqual(a, b)    // 时序安全比较

// PBKDF2（目前固定走 sha256）
crypto.pbkdf2Sync(password, salt, iterations, keyLen, digest?)
crypto.pbkdf2(password, salt, iterations, keyLen, digest?, callback)

// AES 便捷包装（推荐，输入输出为原始字节）
crypto.aesEcbPkcs7Decrypt(input, keyRaw)
crypto.aesEcbPkcs7Encrypt(input, keyRaw)
crypto.aesCbcPkcs7Encrypt(input, keyRaw, ivRaw)
crypto.aesCbcPkcs7Decrypt(input, keyRaw, ivRaw)
crypto.aesGcmEncrypt(input, keyRaw, nonceRaw, aad?)
crypto.aesGcmDecrypt(input, keyRaw, nonceRaw, aad?)

// 旧版 base64 包装（已废弃，仍兼容）
crypto.aesCbcPkcs7EncryptB64(payloadB64, keyRaw, ivRaw)
crypto.aesCbcPkcs7DecryptB64(payloadB64, keyRaw, ivRaw)
crypto.aesGcmEncryptB64(payloadB64, keyRaw, nonceRaw, aadB64?)
crypto.aesGcmDecryptB64(payloadB64, keyRaw, nonceRaw, aadB64?)
```

### 支持的编码

`utf8` / `utf-8` / `hex` / `base64` / `latin1` / `binary` / `buffer`

### 说明

- `pbkdf2` / `pbkdf2Sync` 目前固定走 sha256
- 旧版 `_hex` / `_b64` API 因行为较为模糊，已废弃，不再建议使用
- 新版 AES / 摘要 / HMAC API 输入输出均为原始字节（`Uint8Array` / `string`），不再内置 base64 编解码

```js
// 推荐写法
const hash = crypto.createHash("sha256").update("text").digest("hex");
const hmac = crypto.createHmac("sha256", "key").update("text").digest("hex");
const md5Hex = await crypto.md5("text");
```

## fs

文件系统 API，与 Node.js `fs/promises` 子集兼容。

```js
await fs.promises.writeFile("/tmp/test.txt", "hello");
const raw = await fs.promises.readFile("/tmp/test.txt"); // Uint8Array
const text = await fs.promises.readFile("/tmp/test.txt", "utf8"); // string
await fs.promises.mkdir("/tmp/dir", { recursive: true });
const files = await fs.promises.readdir("/tmp");
await fs.promises.rm("/tmp/test.txt", { force: true });
```

## path

路径工具，与 Node.js `path` 子集兼容。

```js
path.join("/a", "b", "../c"); // "/a/c"
path.resolve("a", "b");       // 绝对路径
path.dirname("/a/b/c.txt");   // "/a/b"
path.basename("/a/b/c.txt");  // "c.txt"
path.extname("/a/b/c.txt");   // ".txt"
```

## native

字节缓冲池，用于管理二进制数据。大部分场景用 `fetch` 和 `bridge` 即可，不推荐直接操作。

主要方法：

- `native.put(input)` — 将数据放入缓冲池，返回 id
- `native.take(id)` — 从缓冲池取出数据
- `native.free(id)` — 释放缓冲
- `native.gzipCompress(input)` — gzip 压缩
- `native.gzipDecompress(input)` — gzip 解压

## console

```js
console.log("...");
console.info("...");
console.warn("...");
console.error("...");
console.debug("...");
```

输出会转到宿主日志。其他 console 方法会 fallback 到 `console.log` 同级逻辑。

## uuidv4

```js
const id = uuidv4();
```

## Buffer

Node.js 兼容的 Buffer 子集。

```js
Buffer.from(data, encoding?)
Buffer.alloc(size)
Buffer.isBuffer(obj)
Buffer.byteLength(string, encoding?)
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

## 类型定义

示例仓库 `types/` 目录包含完整的 TypeScript 类型定义：

- `types/index.d.ts` — 类型统一导出入口
- `types/crypto.d.ts` — `crypto` 相关类型
- `types/fs.d.ts` — `fs` / `path` 相关类型
- `types/native.d.ts` — `native` 相关类型
- `types/bridge.d.ts` — `bridge` 相关类型
- `types/runtime.d.ts` — 运行时全局对象与 `RuntimeApiSet`
- `types/runtime-api.ts` — `hostRuntime` 便捷封装
- `types/runtime-api.typecheck.ts` — 运行时类型断言示例

建议开发时直接引用这些类型。

## 便捷封装

示例仓库 `src/tools.ts` 提供了一些常用功能的便捷封装（`cache.*`、`pluginConfig.*`、`opencc.*`、`flutterTools.*`、`runtime.*`），详细用法见源码注释。

## 常见用法

```ts
import { hostRuntime } from "../types/runtime-api";

// 1. fetch 拉数据
const res = await fetch("https://api.example.com/list");
const data = await res.json();

// 2. crypto 计算摘要
const md5 = await hostRuntime.crypto.md5("data");
const sha256 = hostRuntime.crypto
  .createHash("sha256")
  .update("data")
  .digest("hex");

// 3. 写本地文件
await hostRuntime.fs.promises.writeFile("/tmp/result.json", JSON.stringify(data));

// 4. console 打日志
console.log("result:", data);
```
