---
sidebar_label: 加密 API
---

# 加密 API

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
> 详见 [breeze-plugin-kit 工具包](/guide/plugin-kit#crypto--加密解密)。

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
