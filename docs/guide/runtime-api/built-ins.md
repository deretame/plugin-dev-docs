---
sidebar_label: 内置对象与工具
---

# 内置对象与工具

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
