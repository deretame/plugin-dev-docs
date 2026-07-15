# Debug & Release

## 1) Debugging

See [Quick Start](/en/guide/quick-start) for step-by-step debug mode setup. Key points:

- Enable debug mode on the plugin settings page and paste the bundle URL from the dev server
- When the bundle changes, the host recreates the QuickJS instance; in-memory state is not preserved
- Some features (`init`, `getInfo` `function` entries) cannot hot-reload; restart or reinstall the plugin

### Remote Logging

The dev server exposes a `/log` endpoint for remote plugin logs. After setting the log URL in app settings, plugin `console.log/warn/error` output is forwarded to the terminal.

## 2) Build

**Before building, update the `version` field in `buildPluginInfo()` in `src/get-info.ts`.** The build script syncs it to `package.json` and `manifest.json`.

```bash
pnpm run build
```

Build pipeline: typecheck → sync version (`get-info.ts` → `package.json`) → generate `manifest.json` → rspack bundle → Brotli compress.

Output is under `dist/`, including `<package-name>.bundle.cjs` and `<package-name>.bundle.cjs.br`.

## 3) Publishing

### 3.1 Naming

Plugin repository names must start with `Breeze-plugin-`, e.g. `Breeze-plugin-example`.

The in-app plugin list searches GitHub for repositories starting with `Breeze-plugin-`. Other name prefixes will not appear in the list.

### 3.2 Publish to GitHub

1. Update the `version` field in `buildPluginInfo()` in `src/get-info.ts`
2. Run `pnpm run build`
3. Push code and `dist/` artifacts to the GitHub repository
4. Create a GitHub Release; **the tag must match `version` in `manifest.json`** (otherwise auto-update fails)

Recommended `updateUrl`:

```
https://api.github.com/repos/<owner>/Breeze-plugin-<name>/releases/latest
```

### 3.3 Publish to npm (Optional)

npm publish is optional but recommended. After publishing, jsDelivr CDN can accelerate downloads.

Before publishing ensure:

- `package.json` `name` matches `manifest.json` `npmName`
- `version` is in `x.y.z` format

### 3.4 FAQ

**Must plugins be open source?**
Not necessarily. Listing requires a GitHub repo named with the `Breeze-plugin-` prefix and a `manifest.json`; source visibility is unrelated. Without `manifest.json` on GitHub, the plugin will not appear in the list and users must use “Network Install” with a manual bundle URL.

**I published but the plugin list still does not show it?**
Collection can lag by 2–4 hours. If it still does not appear, check:

- Repo name starts with `Breeze-plugin-`
- `manifest.json` is valid
- A GitHub Release exists with a tag matching the version

**Can I skip GitHub?**
Yes, but users must load the bundle URL via “Network Install”; discovery and auto-update via the plugin list will not work.

## 4) Auto-Update

The client uses `manifest.json` `version` to detect updates. Versions are compared as semantic `x.y.z`.

`updateUrl` currently supports only the GitHub Release API format:

```text
https://api.github.com/repos/<owner>/<repo>/releases/latest
```

Non-GitHub repositories do not support auto-update yet.

## 5) Troubleshooting

### `target is not function: xxx`

Cause: the function is missing from `export default`.

Fix: ensure `export default { ... }` includes the key, with casing matching `fnPath`.

### `插件返回格式错误` (invalid plugin return format)

Cause: the return structure does not match the page type.

Fix: align fields with the TypeScript types in [API Contract](/en/guide/plugin-api-contract).

### `plugin_not_found` / `bundle_js_missing_db`

Cause: the plugin is not registered correctly, or the bundle URL is unavailable.

Fix: check plugin UUID, config metadata, `debugUrl`, and that the bundle file is reachable.

### Images display but download fails

Cause: `fetchImageBytes` did not return a valid `Uint8Array`.

Fix:

1. Confirm the request header includes `x-rquickjs-host-offload-binary-v1: 1`
2. Confirm you return `new Uint8Array(await res.arrayBuffer())`
3. Confirm image `url` is valid (not empty or 404)

### Images do not display

Cause: `ImageItem.url` is empty or a 404 URL.

Fix: `url` must be a valid-format placeholder string, e.g. `"https://example.com/placeholder.jpg"`. The host validates the format but does not download via this URL.
