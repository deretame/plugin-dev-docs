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
Yes. Users can install via “Network Install” or “Local Install”.  
As long as `getInfo()` provides a working `npmName` or `updateUrl`, the client can still check for updates **even if the plugin is not in the store list** (see section 4).  
Without the list, users cannot discover the plugin in the store, but the update channel still works.

## 4) Plugin Updates

The client has two non-fallback update paths: the **cloud catalog** and the **plugin’s own channel** (`npmName` / `updateUrl`).  
The plugin list is for discovery and store distribution only — it is **not** a hard gate for updates.

### 4.1 Update channel fields

Provide these in `getInfo()` (and in published `manifest.json`):

| Field | Role |
|------|------|
| `version` | Installed version; compared semantically with remote (`x.y.z`, optional `v` prefix) |
| `npmName` | Preferred channel: query npm `latest` and download the bundle via CDN |
| `updateUrl` | Secondary channel: fetch a GitHub Release–like JSON, then download assets |

**Prefer setting both.** When `npmName` is set, npm/CDN is tried first; download may fall back to `updateUrl` if CDN fails (this is download fallback only, separate from catalog vs self-channel routing).

Recommended `updateUrl`:

```text
https://api.github.com/repos/<owner>/<repo>/releases/latest
```

Custom `updateUrl` is allowed. **Minimal expected JSON** (field names match the GitHub Release API):

```json
{
  "tag_name": "1.2.3",
  "assets": [
    {
      "name": "my-plugin.bundle.cjs.br",
      "browser_download_url": "https://example.com/my-plugin.bundle.cjs.br"
    }
  ]
}
```

Notes:

- `tag_name`: remote version (falls back to `name` if missing)
- `assets[]`: at least one item; each needs `name` and `browser_download_url`
- Preferred assets: `*.bundle.cjs.br`, then `*.cjs` / `*.bundle.cjs`

> **Proxy rule:** GitHub acceleration applies only when `updateUrl` is on `api.github.com`. Other hosts are requested directly (no proxy prefix rewriting).

### 4.2 Silent auto-update (background after launch)

After launch the app schedules a silent update pass:

1. Fetch the cloud plugin catalog (on failure, all plugins use the self channel)
2. For each **installed, non-deleted** plugin:
   - **In the catalog:** use only catalog `version` / `npmName` / `updateUrl` — **no** fallback to local `getInfo`
   - **Not in the catalog:** use only cached local `getInfo` (`npmName` first, else `updateUrl`) — **no** fallback to the catalog
3. Download only when remote version `>` local; after download, run `getInfo` and **reject if uuid does not match**
4. After any successful update, re-run `getInfo` and persist the cache

**How plugins outside the list get updates:**

1. Fill `npmName` and/or `updateUrl` in `getInfo()`, and keep `version` / `uuid` correct
2. Publish to npm, or ensure `updateUrl` returns the latest release info
3. After the user installs via local/network install, silent update checks the self channel
4. If the local `getInfo` cache is empty, the client runs `getInfo` once from the installed script and caches it

### 4.3 Manual update (user-facing)

On the **per-plugin settings page** (Discover → plugin → settings):

| Action | Where | Behavior |
|------|------|------|
| **Sync** | Top-right icon | Check + download via `npmName` / `updateUrl`; installs only when remote is newer |
| **Update** | Bottom “Plugin management” → dialog | Manual reinstall entry (does **not** check “is there a new version”): Install from network / Install from local / Cancel; runs `getInfo` and **rejects on uuid mismatch** |

Notes:

- Plugin-defined settings / user info / actions stay on top; bottom “Plugin management” has version, update, debug, delete
- **Sync** means “check for updates” via `getInfo`’s `npmName` / `updateUrl` (whether or not the plugin is in the store list)
- **Update** is a convenience path for **manual install/reinstall** — e.g. poor network, user already has a package, or temporarily swapping a build:
  - **Install from network**: user pastes a bundle URL; the host downloads and installs it
  - **Install from local**: user picks a downloaded `.js` / `.cjs` / `.br` file
- Both manual install paths verify uuid so a different plugin cannot overwrite the current one
- This is **not** “pull from the store catalog”; use **Sync** for automatic update checks

### 4.4 Developer checklist (updates)

- [ ] Keep `getInfo().uuid` stable — **never change it casually** (a new uuid is a new plugin)
- [ ] Bump `version` before every release, then `pnpm run build` and publish
- [ ] GitHub Release tag matches `version`
- [ ] `npmName` matches `package.json` `name` when using npm
- [ ] `updateUrl` is reachable; do not rely on host proxies for non–GitHub API URLs
- [ ] If the plugin is unlisted, `getInfo` **must** provide `npmName` or `updateUrl`, or silent update and **Sync** will not work

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
