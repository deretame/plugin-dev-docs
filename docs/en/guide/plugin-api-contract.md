# Plugin API Contract

TypeScript types and call semantics for every Breeze plugin `fnPath`.

## 0. Common Conventions

### 0.1 Input Model

The host always passes a flat object. Primary business fields at the top level; passthrough fields in `extern`:

```ts
// Generic payload model
type PluginPayload<T extends Record<string, unknown>> = T & {
  extern?: Record<string, unknown>;
};
```

Example `searchComic` signature:

```ts
import type { SearchComicPayload, SearchResultContract } from "breeze-plugin-kit";

async function searchComic(payload: SearchComicPayload): Promise<SearchResultContract> {}
```

All parameter types come from `breeze-plugin-kit`. Each `fnPath` below notes its Payload and return type.

### 0.2 Return Model

Most APIs return a unified envelope:

```ts
type PluginEnvelope = {
  source: string;                       // plugin ID
  scheme?: Record<string, unknown>;     // page render protocol
  data?: Record<string, unknown>;       // business data
  extern?: Record<string, unknown>;     // passthrough context
  [key: string]: unknown;               // other flat fields (comicId, paging, etc.)
};
```

The host uses `scheme` for “what the page looks like” and `data` for “what the values are”. Fill fields by type.

### 0.3 Error Handling

- Return values must be JSON-serializable objects (non-objects trigger “invalid return format”)
- Thrown `Error` strings are shown directly in the client
- Always return `source` when possible for easier debugging

### 0.4 `init` (Optional)

The host may call `init` after runtime start. Skip if unimplemented. If implemented, prefer `{ source, data: { ok: true } }`.

Note: on hot reload the QJS instance is rebuilt and `init` runs again. Do not use `init` for one-time-only setup.

### 0.5 Type Sources

All types come from `breeze-plugin-kit`. Payload and Contract types below can be imported from that package.

---

## 1. fnPath Overview

Host-invoked functions are triggered by scene; callbacks are invoked by the host when the user acts in the UI.

| fnPath | When triggered |
| ------ | -------------- |
| `getInfo` | Discover page loads plugin card |
| `searchComic` | Search keyword / page / advanced search |
| `getComicDetail` | Open comic detail |
| `getReadSnapshot` | Reader init / chapter switch |
| `getChapter` | Download chapter content |
| `fetchImageBytes` | Read/download image binary |
| `toggleLike` | Like on detail page |
| `toggleFavorite` | Favorite on detail page |
| `listFavoriteFolders` | After favorite, pick folder |
| `moveFavoriteToFolder` | User confirms folder |
| `getCommentFeed` | Open comments / page |
| `loadCommentReplies` | Expand comment replies |
| `postComment` | Post main comment |
| `postCommentReply` | Reply to a comment |
| `getAdvancedSearchScheme` | Open advanced search filters |
| `getComicListSceneBundle` | Discover default list by source |
| `getRankingData` | List page body request |
| `getRankingFilterBundle` | List page filter button |
| `getSettingsBundle` | Open plugin settings |
| `getCapabilitiesBundle` | Open settings (actions section) |
| `getUserInfoBundle` | User card on settings |

Callbacks: plugins set `fnPath` on settings / capabilities; the host calls them on user action:

| fnPath | When |
| ------ | ---- |
| `onAuthChanged` etc. | Settings field changed |
| `clearPluginCache` | Capability action button clicked |

---

## 2. Core APIs

### `getInfo()`

Returns plugin metadata and feature entries.

```ts
// Return type InfoContract
type InfoContract = {
  name: string;
  uuid: string;
  iconUrl: string;
  creator: { name: string; describe: string; coverUrl?: string };
  describe: string;
  version: string;
  home?: string;
  updateUrl?: string;
  npmName?: string;
  function: PluginFunctionItem[];
};

type PluginFunctionItem = {
  id: string;
  title: string;
  action:
    | { type: "openSearch"; payload: { source: string; keyword?: string } }
    | { type: "openComicDetail"; payload: { comicId: string } }
    | { type: "openWeb"; payload: { title?: string; url: string } }
    | { type: "openComicList"; payload: { scene: ComicListScene } }
    | {
        type: "openPluginFunction";
        payload: {
          id: string;
          title?: string;
          presentation?: "page" | "dialog";
        };
      }
    | { type: "openCloudFavorite"; payload: { title: string } };
};

type ComicListScene = {
  title: string;
  source: string;
  body: {
    type: "pluginPagedComicList" | "pluginPagedCreatorList";
    request: ComicListRequest;
  };
  filter?: ComicListRequest;
};

type ComicListRequest = {
  fnPath: string; // list data function name
  core?: Record<string, unknown>; // fixed request params
  extern?: Record<string, unknown>; // passthrough context
};
```

Prefer `openComicList` as feature entries. Examples: [Quick Start](/en/guide/quick-start).

### `searchComic(payload)`

```ts
// Input SearchComicPayload
type SearchComicPayload = {
  keyword?: string;
  page?: number;
  extern?: Record<string, unknown>;
};

// Return SearchResultContract
type SearchResultContract = {
  source: string;
  extern: Record<string, unknown> | null;
  scheme: {
    version: "1.0.0";
    type: "searchResult";
    source: string;
    list: string;
  };
  data: { paging: PagingInfo; items: ComicListItem[] };
  paging: PagingInfo;
  items: ComicListItem[];
};

type PagingInfo = {
  page: number;
  pages: number;
  total: number;
  hasReachedMax: boolean;
};

type ComicListItem = {
  source: string;
  id: string;
  title: string;
  subtitle: string;
  finished: boolean;
  likesCount: number;
  viewsCount: number;
  updatedAt: string;
  cover: ImageItem;
  metadata: MetadataListItem[];
  raw: Record<string, unknown>;
  extern: Record<string, unknown>;
};
```

`extern` may include advanced search selections.

### `getComicDetail(payload)`

```ts
// Input ComicDetailPayload
type ComicDetailPayload = {
  comicId?: string;
  extern?: Record<string, unknown>;
};

// Return ComicDetailContract
type ComicDetailContract = {
  source: string;
  comicId: string;
  extern: Record<string, unknown> | null;
  scheme: { version: "1.0.0"; type: "comicDetail"; source: string };
  data: { normal: ComicDetailNormal; raw: unknown };
};

type ComicDetailNormal = {
  comicInfo: {
    id: string;
    title: string;
    titleMeta: ActionItem[];
    creator: {
      id: string;
      name: string;
      avatar: ImageItem;
      onTap: Record<string, unknown>;
      extern: Record<string, unknown>;
    };
    description: string;
    cover: ImageItem;
    metadata: MetadataListItem[];
    extern: Record<string, unknown>;
  };
  eps: ChapterSummary[]; // chapter list
  recommend: RecommendItem[];
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  isFavourite: boolean;
  isLiked: boolean;
  allowComments: boolean;
  allowLike: boolean;
  allowCollected: boolean;
  allowDownload: boolean;
  extern: Record<string, unknown>;
};

// Base types
type ActionItem = {
  name: string;
  onTap: Record<string, unknown>;
  extern: Record<string, unknown>;
};
type ImageItem = {
  id: string;
  url: string;
  name: string;
  path: string;
  extern: Record<string, unknown>;
};
```

> `url` must be a non-empty placeholder string, not a 404 URL. The host does not download via it but validates format. Image download is fully handled by `fetchImageBytes`.

```ts
type MetadataListItem = { type: string; name: string; value: ActionItem[] };
```

### Chapter Fields

Chapter-related data uses these fields in `CommonDetail` `eps[]` and in `getReadSnapshot` / `getChapter` returns:

```ts
type ChapterSummary = {
  id: string;               // chapter id
  requestId: string;        // used by host when calling getReadSnapshot / getChapter
  logicalKey: string;       // host-internal chapter identity (often same as requestId)
  storageChapterId: string; // local download directory name (often same as requestId)
  name: string;             // chapter title
  order: number;            // order
  extern: Record<string, unknown>; // plugin passthrough
};

type ChapterPage = {
  id: string;
  name: string;
  path: string;
  url: string;
  extern: Record<string, unknown>;
};
```

### `getReadSnapshot(payload)`

```ts
// Input ReadSnapshotPayload
type ReadSnapshotPayload = {
  comicId?: string;
  chapterId?: string | number;  // requestId
  extern?: Record<string, unknown>;
};

// Return ReadSnapshotContract
type ReadSnapshotContract = {
  source: string;
  extern: Record<string, unknown> | null;
  data: {
    comic: {
      id: string;
      source: string;
      title: string;
      extern: Record<string, unknown>;
    };
    chapter: ChapterWithPages; // current chapter + pages
    chapters: Array<{
      id: string;
      name: string;
      order: number;
      extern: Record<string, unknown>;
    }>;
  };
};


type ChapterWithPages = ChapterSummary & { pages: ChapterPage[] };
```

`chapters` is the navigation list (slim); `chapter` is the selected chapter (with `pages`).

### `fetchImageBytes(payload)`

```ts
// Input FetchImageBytesPayload
type FetchImageBytesPayload = {
  url?: string;
  timeoutMs?: number;
  taskGroupKey?: string;  // download task group; host can cancel in batch
  extern?: Record<string, unknown>;
};

// Return type (direct Uint8Array; no longer { nativeBufferId })
type FetchImageBytesResult = Uint8Array<ArrayBufferLike>;
```

`url` comes from `ImageItem.url`. The host does not download with it; the plugin implements download. The `url` must still be a valid placeholder string — not empty or 404.

> ⚠️ **Binary offload header required**: always send `"x-rquickjs-host-offload-binary-v1": "1"` so the host returns raw binary instead of stringifying or re-encoding. Without it, image data often has wrong length, fails to decode, or displays incorrectly.

```ts
// Implementation sketch:
async function fetchImageBytes({
  url,
  timeoutMs = 30000,
}: FetchImageBytesPayload): Promise<Uint8Array> {
  const res = await fetch(url, {
    headers: { "x-rquickjs-host-offload-binary-v1": "1" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}
```

### `getChapter(payload)`

Used for downloads. Similar to `getReadSnapshot` but with full `scheme + data + comicId/chapterId`:

```ts
// Input ChapterPayload
type ChapterPayload = {
  comicId?: string;
  chapterId?: string | number;
  page?: number;
  extern?: Record<string, unknown>;
};

// Return ChapterContentContract
type ChapterContentContract = {
  source: string;
  comicId: string;
  chapterId: string;
  extern: Record<string, unknown> | null;
  scheme: { version: "1.0.0"; type: "chapterContent"; source: string };
  data: {
    comic: {
      id: string;
      source: string;
      title: string;
      extern: Record<string, unknown>;
    };
    chapter: ChapterWithPages;
    chapters: Array<{
      id: string;
      name: string;
      order: number;
      extern: Record<string, unknown>;
    }>;
  };
};
```

---

## 3. Social APIs

### `toggleLike(payload)`

```ts
// Input ToggleLikePayload
type ToggleLikePayload = {
  comicId?: string;
  currentLiked?: boolean;
  extern?: Record<string, unknown>;
};

// Return ToggleLikeResult
type ToggleLikeResult = { liked: boolean };

```

### `toggleFavorite(payload)`

```ts
// Input ToggleFavoritePayload
type ToggleFavoritePayload = {
  comicId?: string;
  currentFavorite?: boolean;
  extern?: Record<string, unknown>;
};

// Return ToggleFavoriteResult
type ToggleFavoriteResult = {
  favorited: boolean;
  nextStep: "none" | "selectFolder";
};

```

When `nextStep` is `selectFolder`, the host continues with `listFavoriteFolders` and `moveFavoriteToFolder`.

### `listFavoriteFolders()`

```ts
// Return ListFavoriteFoldersResult
type ListFavoriteFoldersResult = { items: Array<{ id: string; name: string }> };
```

### `moveFavoriteToFolder(payload)`

```ts
// Input MoveFavoriteToFolderPayload
type MoveFavoriteToFolderPayload = {
  comicId?: string;
  folderId?: string;
  folderName?: string;
  extern?: Record<string, unknown>;
};

// Return { ok: boolean }
```

### Comment Feed

```ts
// Input CommentFeedPayload
type CommentFeedPayload = {
  comicId?: string;
  page?: number;
  extern?: Record<string, unknown>;
};

// Return CommentFeedContract
type CommentFeedContract = {
  source: string;
  extern: Record<string, unknown> | null;
  scheme: { version: "1.0.0"; type: "commentFeed" };
  data: {
    topItems: CommentItem[];
    items: CommentItem[];
    paging: { hasReachedMax: boolean };
    replyMode: "lazy" | "embedded"; // lazy: load replies on demand; embedded: replies inline
    canComment: { comic: boolean; reply: boolean };
  };
};

type CommentItem = {
  id: string;
  author: { name: string; avatar: { url: string; path: string } };
  content: string;
  createdAt: string;
  replyCount: number;
  replies: CommentItem[];
  extern: Record<string, unknown>;
};

// Load replies
type CommentRepliesPayload = {
  comicId?: string;
  commentId?: string;
  page?: number;
  extern?: Record<string, unknown>;
};

type CommentRepliesContract = {
  source: string;
  extern: Record<string, unknown> | null;
  scheme: { version: "1.0.0"; type: "commentReplies" };
  data: {
    commentId: string;
    items: CommentItem[];
    paging: { hasReachedMax: boolean };
  };
};

// Post comment
type CommentPostPayload = {
  comicId?: string;
  content?: string;
  extern?: Record<string, unknown>;
};

// Reply to comment
type CommentReplyPayload = {
  comicId?: string;
  commentId?: string;
  content?: string;
  extern?: Record<string, unknown>;
};

// Shared return for post / reply
type CommentMutationContract = {
  source: string;
  scheme: { version: "1.0.0"; type: "commentMutation" };
  data: {
    ok: boolean;
    mode: "postComment" | "postReply";
    parentId?: string;
    created: CommentItem | null;
    insertHint: {
      needsRefetch: boolean;
      strategy?: "prependAfterTop" | "prepend";
      targetCommentId?: string;
    };
  };
};
```

- `replyMode: "lazy"` — replies loaded on demand via `loadCommentReplies`
- `replyMode: "embedded"` — replies already in `replies`; no `loadCommentReplies`
- `insertHint.strategy` — `prependAfterTop` for main comments at top; `prepend` for replies

---

## 4. Discover & Lists

### `getAdvancedSearchScheme()`

Defines advanced search fields. Selected values are passed to `searchComic` via `extern`.

```ts
// Return AdvancedSearchContract
type AdvancedSearchContract = {
  source: string;
  scheme: {
    version: "1.0.0";
    type: "advancedSearch";
    title?: string;
    fields: AdvancedSearchField[];
  };
  data: { values: Record<string, unknown> };
};

type AdvancedSearchField = {
  key: string;
  kind: "text" | "switch" | "choice" | "multiChoice";
  label: string;
  options?: Array<{ label: string; value: unknown }>;
};
```

### `getComicListSceneBundle()`

Defines the default Discover list scene. Returns `data.scene`; host renders the list and calls `body.request.fnPath` / `filter.fnPath`.

```ts
// Return ComicListSceneBundleContract
type ComicListSceneBundleContract = {
  source: string;
  scheme: { version: "1.0.0"; type: "comicListSceneBundle" };
  data: { scene: ComicListScene };
};
```

`ComicListScene` is defined under `getInfo`.

### `getRankingData(payload)`

List data function named by `ComicListScene.body.request.fnPath`. Called when the host pages list data.

```ts
// Input same shape as SearchComicPayload (paging + extern)

// Return ComicPagedListContract
type ComicPagedListContract = {
  source: string;
  extern?: Record<string, unknown> | null;
  scheme?: Record<string, unknown>;
  data: { items: ComicListItem[]; hasReachedMax: boolean };
};
```

### `getRankingFilterBundle()`

List filter function named by `ComicListScene.filter.fnPath`. Called when the user opens list filters.

```ts
// Return FilterBundleContract
type FilterBundleContract = {
  source: string;
  scheme: {
    version: "1.0.0";
    type?: string;
    title?: string;
    fields: FilterField[];
  };
  data: { values: Record<string, unknown> };
};

type FilterField = {
  key: string;
  kind: "choice";
  label: string;
  options: FilterOption[];
};

type FilterOption = {
  label: string;
  value: unknown;
  result?: {
    core?: Record<string, unknown>;   // merged into list request top-level
    extern?: Record<string, unknown>; // merged into list request extern
    params?: Record<string, unknown>; // UI params
    [key: string]: unknown;
  };
  children?: FilterOption[];
};
```

---

## 5. Settings

### `getSettingsBundle()`

```ts
// Return SettingsBundleContract
type SettingsBundleContract = {
  source: string;
  scheme: { version: "1.0.0"; type: "settings"; sections: SettingsSection[] };
  data: { canShowUserInfo: boolean; values: Record<string, unknown> };
};

type SettingsSection = {
  id?: string;
  title: string;
  fields: SettingsField[];
};

type SettingsField = OptionField | PlainField;

type OptionField = BaseField & {
  kind: "select" | "choice" | "multiChoice";
  options?: Array<{ label: string; value: unknown }>;
};

type PlainField = BaseField & { kind: "text" | "password" | "switch" };

type BaseField = {
  key: string; // config key in values and callback payload
  kind: FieldKind; // "text" | "password" | "switch" | "select" | "choice" | "multiChoice"
  label: string; // display label
  fnPath?: string; // callback on change
  persist?: boolean; // client persistence; default true
};
```

When the user changes a field with `fnPath`, the host calls that function with `{ extern: Record<string, unknown>, key: string, value: unknown }`.

### `getCapabilitiesBundle()`

Bottom “Actions” section on the settings page; click calls the matching `fnPath`.

```ts
// Return CapabilitiesBundleContract
type CapabilitiesBundleContract = {
  source: string;
  scheme: {
    version: "1.0.0";
    type: "capabilities";
    actions: CapabilityAction[];
  };
  data: Record<string, unknown>;
};

type CapabilityAction = { key?: string; title: string; fnPath: string };
```

### `getUserInfoBundle()`

User info card on the settings page.

```ts
// Return UserInfoBundleContract
type UserInfoBundleContract = {
  source: string;
  scheme: { version: "1.0.0"; type: "userInfo" };
  data: {
    title?: string;
    avatar: ImageItem;
    lines: string[];
    extern?: Record<string, unknown>;
  };
};
```

---

## 6. Data Flow & Call Chains

### 6.1 Search: Advanced Search → `searchComic`

```
User opens search → host calls getAdvancedSearchScheme() → render advanced UI
User picks filters → no request yet
User searches / pages → host calls searchComic({ keyword, page, extern: { sortBy, categories, ... } })
                                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                              selected advanced filters in extern
```

Details:

- `getAdvancedSearchScheme().scheme.fields[].key` defines filter param names (e.g. `sortBy`, `categories`)
- Selected key-values go into `searchComic` `extern`
- Plugin reads `extern.sortBy` / `extern.categories` inside `searchComic`

### 6.2 Filters: Filter Bundle → List Request

```
List loads → host calls body.request.fnPath (e.g. getRankingData) for initial data
User opens filter → host calls filter.fnPath (e.g. getRankingFilterBundle)
User picks option → host merges option.result into the next list request
```

Merge rules:

- `result.core` fields are written **onto the top level** of the next list request
- `result.extern` fields are **merged into** the next list request `extern`

```ts
// Example FilterOption:
{ label: "Daily", value: "day", result: { core: { type: "comic" }, extern: { rankType: "day" } } }

// After selection, next getRankingData payload becomes:
{ page: 1, type: "comic", extern: { source: "ranking", rankType: "day" } }
//       ^^^^^^^^^^^^                                    ^^^^^^^^^^^^^^^^
//       result.core flattened                           result.extern merged
```

### 6.3 Settings Field Callbacks

Settings fields may set `fnPath`. On change, the host calls it with:

```ts
type SettingsFieldCallbackPayload = {
  extern: Record<string, unknown>;
  key: string;           // field key, e.g. "auth.account"
  value: unknown;        // new value; may be scalar or array
};
```

Examples:

```ts
{ extern: {}, key: "auth.remember", value: true }
{ extern: {}, key: "display.theme", value: "dark" }
{ extern: {}, key: "content.hiddenTags", value: ["tag-b", "tag-c", "tag-d"] }
```

- Plain fields (text / password / switch / choice): `value` is a single value.
- `multiChoice`: `value` is an array (e.g. `onHiddenTagsChanged` receives a tag array).

Example repo callbacks:

- Text/password → `onAuthChanged`
- Switch → `onRememberChanged`, `onAdultChanged`
- Choice → `onThemeChanged`, `onQualityChanged`
- multiChoice → `onHiddenTagsChanged`

Plugins can validate and persist config in these callbacks.

### 6.4 Capability Action Callbacks

Each `fnPath` in `getCapabilitiesBundle().scheme.actions[]` is called by the host on click, with no arguments.

### 6.5 Feature Entry Call Chain

`getInfo().function[]` defines buttons on the plugin card. For `openComicList`:

```
User taps "Ranking"
  → host reads action.payload.scene
  → renders list page (title, filter button, etc.)
  → calls scene.body.request.fnPath (e.g. getRankingData) for list data
  → user opens filter → calls scene.filter.fnPath (e.g. getRankingFilterBundle)
```

`scene.body.request.core` and `scene.body.request.extern` are fixed params on every list request, merged with dynamic filter params.

### 6.6 Practical Tips

- **`core` vs `extern`**: business params (page, type, sort) in `core`; session/context passthrough in `extern`. Prefer `core` when possible.
- **Keep filter `options.value` stable**: changing semantics breaks saved user filters.
- **Always default `data.values`**: empty options lead to missing request params; host does not fill defaults.
- **Keep public `fnPath` keys compatible**: when renaming, export both `snake_case` and `camelCase` if needed.
