---
sidebar_label: Built-ins & Utilities
---

# Built-ins & Utilities

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

## Base64

Two global helpers for Base64 encode/decode; call them directly, no import needed:

```ts
const bytes = bytesFromBase64("aGVsbG8="); // Uint8Array
const text = bytesToBase64(new TextEncoder().encode("hello")); // "aGVsbG8="
```

> `breeze-plugin-kit` only provides **type declarations** for these two functions
> (`base64.d.ts`), not runnable values. Importing `bytesFromBase64` from the package
> gives you a type, and calling it at runtime will fail. For explicit type
> annotations, use `import type`:
>
> ```ts
> import type { Buffer } from "breeze-plugin-kit";
> ```

Often used with `crypto`: decrypt to `Uint8Array`, then `bytesToBase64` for a string.

## hostCrypto and \_\_web

Besides mounting `crypto` on `globalThis.crypto`, the runtime also exposes:

- `hostCrypto` — same object as `crypto`, fallback access path
- `__web` — internal runtime bus with all injected capabilities (`fs`, `path`, `native`, `bridge`, `base64`, `crypto`, `uuidv4`, etc.)

Prefer not to use `__web` directly; its `fs` does not exist on real Breeze hosts. Use `breeze-plugin-kit` wrappers or named globals (`bridge`, `native`, `BreezeHtml`, etc.).
