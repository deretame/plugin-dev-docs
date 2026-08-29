---
sidebar_label: Crypto API
---

# Crypto API

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
> See [breeze-plugin-kit Toolkit](/guide/plugin-kit#crypto--encryption--decryption).

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
