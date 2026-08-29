# Lifecycle & Structure

This chapter describes third-party plugin runtime rules and data flow.

## 1) How Breeze Calls Plugins

1. Breeze loads the plugin bundle
2. Breeze finds the function by `fnPath`
3. Breeze passes arguments to that function
4. Breeze renders the returned data

Core rule: **`fnPath` must match a key on `export default`.**

## 2) Payload Model

When Breeze calls a plugin, the common input model is:

```ts
type PluginPayload<T extends Record<string, unknown>> = T & {
  extern?: Record<string, unknown>;
};
```

Recommended conventions:

- Primary business fields (e.g. `comicId` / `page` / `keyword`) at the top level
- Session / context passthrough in `extern`

## 3) Return Model

Most APIs may return:

```ts
type PluginEnvelope = {
  source: string;
  scheme?: Record<string, unknown>;
  data?: Record<string, unknown>;
  extern?: Record<string, unknown>;
};
```

Notes:

- `source`: plugin ID
- `scheme`: page render protocol (optional)
- `data`: business data
- `extern`: passthrough context. The host stores returned `extern` and sends it back on the next request

## 4) Runtime API

Breeze plugins run in the **QuickJS-NG** engine — not Node.js and not a browser.

Available globals (`fetch`, `bridge`, `crypto`, `Temporal`, `console`, etc.) are documented in [Runtime API](/guide/runtime-api).

## 5) Debugging & State

In debug mode, when the bundle file changes the host recreates the QJS instance.

That means:

- In-memory plugin state is not preserved
- Module-level variables reinitialize

Store data by lifetime:

- Short-lived data in `cache` (lives with the host process; survives QuickJS rebuilds)
- Long-lived data in `config` (survives app restarts)

Both are provided by `breeze-plugin-kit`; see [breeze-plugin-kit Toolkit](/guide/plugin-kit).

## 6) Compatibility

- Prefer backward-compatible API additions
- Provide defaults for optional fields

## 7) Common Pitfalls

### QJS Instance Rebuild

In debug mode every bundle change rebuilds the QJS instance. That means:

- Top-level module code (other than `export default`) re-runs each time
- `init` is called again
- Do not rely on module-level variables for state

### `getInfo` Changes Require Reinstall

The `function` entry list from `getInfo()` is read once when the plugin loads. After changes you need to:

- Restart the app, or
- Uninstall and reinstall the plugin

Hot reload does not re-read `getInfo`.

### Single-File Bundle

Build output is a single `.cjs` file; all dependencies must be bundled by Rspack. **No runtime npm external dependencies.**

### `bridge.callSync` Limits

Sync calls block the host thread and are only for very short work. **Do not perform network I/O or file I/O inside `bridge.callSync`.**

### `extern` Round-Trip

`extern` returned by the plugin is stored by the host and sent back on the next request in the same context. Use it for pagination tokens, session state, and similar context.

### `ImageItem.url` Rules

`ImageItem` has a `url` field, and `fetchImageBytes` receives that `url`, but **the host does not download images via `url`** — downloading is entirely handled by the plugin in `fetchImageBytes`.

That does not mean `url` can be arbitrary. **It must not be a 404 URL or empty string**; it must be a valid-format placeholder (e.g. `"https://example.com/placeholder.jpg"`), or the host will refuse to render.
