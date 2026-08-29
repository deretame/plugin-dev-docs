---
sidebar_label: Core Runtime APIs
---

# Core Runtime APIs

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

> Crypto routes (`crypto.*`) are covered under [crypto](/guide/runtime-api/crypto) below and are not repeated here.

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
