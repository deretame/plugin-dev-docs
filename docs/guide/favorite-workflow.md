# 云端收藏工作流

版本：`1.0`

云端收藏不能只抽象成一个 `toggleFavorite`：有的图源直接收藏，有的需要选择收藏夹，有的允许临时创建收藏夹，还有的只能从当前收藏夹移除。

本协议将流程拆成“插件执行 + 宿主交互 + 插件继续执行”。宿主负责展示交互界面和驱动流程，插件负责调用图源接口、保存继续令牌、判断真实状态以及报告部分成功。

## 1. 函数签名

类型由 `breeze-plugin-kit` 提供：

```ts
import type {
  FavoriteWorkflowResult,
  FavoriteWorkflowStartPayload,
  FavoriteWorkflowContinuePayload,
} from "breeze-plugin-kit";
```

插件需要导出两个函数，函数名必须是：

```ts
export async function startFavoriteAction(
  payload: FavoriteWorkflowStartPayload,
): Promise<FavoriteWorkflowResult> {
  // ...
}

export async function continueFavoriteAction(
  payload: FavoriteWorkflowContinuePayload,
): Promise<FavoriteWorkflowResult> {
  // ...
}
```

对应的函数类型为：

```ts
type StartFavoriteAction = (
  payload: FavoriteWorkflowStartPayload,
) => Promise<FavoriteWorkflowResult>;

type ContinueFavoriteAction = (
  payload: FavoriteWorkflowContinuePayload,
) => Promise<FavoriteWorkflowResult>;
```

插件返回协议对象本身即可，不需要再包一层 `source`、`scheme` 或 `data`。宿主兼容 `data` 包装，但新插件应直接返回协议对象。

## 2. 开始操作参数

```ts
type FavoriteWorkflowAction =
  | "add"
  | "removeAll"
  | "removeFromTarget"
  | "move";

type FavoriteWorkflowContext = {
  target?: {
    id?: string;
    name?: string;
  };
};

type FavoriteWorkflowStartPayload = {
  comicId: string;
  action: FavoriteWorkflowAction;
  currentFavorite?: boolean;
  context?: FavoriteWorkflowContext;
  extern?: Record<string, unknown>;
};
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `comicId` | 图源自己的漫画 ID，宿主原样传入。 |
| `action` | 操作类型，见下方动作语义。 |
| `currentFavorite` | 宿主已知的全局收藏状态，仅供插件优化，不能替代图源侧判断。 |
| `context.target` | 从指定收藏夹打开漫画时的上下文，可能只有 ID、只有名称或两者都有。 |
| `extern` | 宿主预留的扩展参数。插件不能依赖不存在的字段。 |

动作语义：

- `add`：加入图源收藏体系，可以直接完成，也可以进入交互。
- `removeAll`：取消全局收藏。只有图源支持全局取消时才能使用。
- `removeFromTarget`：只从 `context.target` 指定的收藏夹或目标中移除。
- `move`：移动到另一个目标，目标信息通常通过交互参数传回。

如果图源只有“从收藏夹移除”而没有“全局取消”，必须实现 `removeFromTarget`，不能把它伪装成 `removeAll`。

## 3. 返回结果

```ts
type FavoriteWorkflowResult = {
  status: "completed" | "awaitingInput" | "partial" | "failed" | "cancelled";
  favorited?: boolean;
  committed?: boolean;
  message?: string;
  errorCode?: string;
  continuationToken?: string;
  input?: FavoriteWorkflowInput;
};
```

### `completed`

操作已经完成，应返回真实的全局收藏状态：

```ts
return { status: "completed", favorited: true, committed: true };
```

取消全局收藏时返回 `favorited: false`。

### `awaitingInput`

操作需要用户输入。必须返回非空的 `continuationToken` 和 `input`：

```ts
return {
  status: "awaitingInput",
  favorited: true,
  committed: true,
  continuationToken: "favorite:add:abc123",
  input: {
    type: "select",
    key: "folderId",
    title: "选择收藏夹",
    selection: "single",
    required: false,
    options: folders.map((folder) => ({
      id: folder.id,
      label: folder.name,
    })),
    allowCreate: true,
    createField: {
      key: "folderName",
      type: "text",
      label: "新建收藏夹",
      placeholder: "输入收藏夹名称",
    },
  },
};
```

`awaitingInput` 不是失败。插件可以先完成全局收藏，再等待用户选择归类目标。

### `partial`

操作只完成了一部分，例如全局收藏成功但移动收藏夹失败：

```ts
return {
  status: "partial",
  favorited: true,
  committed: true,
  message: "已收藏，但移动到收藏夹失败，请稍后重试",
  errorCode: "MOVE_FOLDER_FAILED",
};
```

### `failed`

操作没有完成：

```ts
return {
  status: "failed",
  favorited: false,
  committed: false,
  message: "登录已失效",
  errorCode: "UNAUTHORIZED",
};
```

登录失效仍应沿用插件现有的登录异常协议；`message` 和 `errorCode` 用于普通工作流错误。

### `cancelled`

用户取消交互，或插件收到取消请求后确认流程已取消：

```ts
return {
  status: "cancelled",
  favorited: true,
  committed: true,
  message: "已收藏，未选择收藏夹",
};
```

`cancelled` 不代表已回滚。插件必须根据已经提交的图源请求填写 `favorited` 和 `committed`。

字段含义：

- `favorited`：全局收藏状态，不表示当前收藏夹中是否存在。
- `committed`：是否已经对图源产生不可忽略的副作用。
- `continuationToken`：恢复工作流所需的短期令牌，不要放入密码、Cookie 或登录凭据。

## 4. 交互参数定义

### 4.1 完整类型

```ts
type FavoriteWorkflowOption = {
  id: string;
  label: string;
  description?: string;
  selected?: boolean;
};

type FavoriteWorkflowField = {
  key: string;
  type:
    | "text"
    | "password"
    | "number"
    | "switch"
    | "confirm"
    | "choice"
    | "multiChoice";
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: FavoriteWorkflowOption[];
};

type FavoriteWorkflowInput = {
  type: "select" | "text" | "confirm" | "form";
  key?: string;
  title?: string;
  description?: string;
  required?: boolean;
  selection?: "single" | "multiple";
  options?: FavoriteWorkflowOption[];
  allowCreate?: boolean;
  createField?: FavoriteWorkflowField;
  fields?: FavoriteWorkflowField[];
};
```

### 4.2 `select`

`options` 和 `allowCreate` 可以同时存在。此时宿主应在同一个选择界面中展示已有目标，并提供新建目标的输入框；用户可以二选一，不能同时提交已有目标和新目标。

`selection: "single"` 时，宿主返回：

```ts
{ key: "targetId", value: "folder-1" }
```

`selection: "multiple"` 时，宿主返回：

```ts
{ key: "targetId", value: ["folder-1", "folder-2"] }
```

启用 `allowCreate` 后，用户输入新目标时返回：

```ts
{
  key: "targetId",
  value: null,
  created: "新收藏夹",
}
```

插件应以 `created` 是否存在判断是否创建目标，不要依赖宿主猜测字段名。

### 4.3 `text`

```ts
input: {
  type: "text",
  key: "folderName",
  title: "新建收藏夹",
  description: "请输入收藏夹名称",
  required: true,
}
```

宿主返回 `{ key: "folderName", value: "待读" }`。

### 4.4 `confirm`

```ts
input: {
  type: "confirm",
  key: "confirmRemove",
  title: "确认移除",
  description: "将从当前收藏夹移除这本漫画，是否继续？",
}
```

确认时宿主返回 `value: true`。用户取消时走统一取消流程，不伪造确认值。

### 4.5 `form`

`form` 用于一次询问多个字段：

```ts
input: {
  type: "form",
  title: "收藏设置",
  fields: [
    {
      key: "folderName",
      type: "text",
      label: "收藏夹名称",
      required: true,
    },
    {
      key: "markRead",
      type: "switch",
      label: "标记为已读",
      defaultValue: false,
    },
    {
      key: "labels",
      type: "multiChoice",
      label: "标签",
      options: [{ id: "later", label: "稍后阅读" }],
    },
  ],
}
```

宿主返回：

```ts
{
  values: {
    folderName: "待读",
    markRead: false,
    labels: ["later"],
  },
}
```

## 5. 继续与取消

继续函数的完整参数：

```ts
type FavoriteWorkflowInteraction = {
  cancelled?: boolean;
  key?: string;
  value?: unknown;
  created?: string;
  values?: Record<string, unknown>;
};

type FavoriteWorkflowContinuePayload = {
  comicId: string;
  action: FavoriteWorkflowAction;
  continuationToken: string;
  input: FavoriteWorkflowInteraction;
  extern?: Record<string, unknown>;
};
```

用户完成交互后，宿主调用：

```ts
await continueFavoriteAction({
  comicId,
  action,
  continuationToken,
  input,
});
```

用户关闭或取消交互时，宿主调用：

```ts
await continueFavoriteAction({
  comicId,
  action,
  continuationToken,
  input: { cancelled: true },
});
```

插件必须校验 `continuationToken`、漫画 ID 和动作。取消后的合法结果有两种：

1. 尚未产生副作用：返回 `cancelled`，`committed: false`；
2. 已经完成部分操作：返回 `cancelled` 或 `partial`，并填写真实的 `favorited`、`committed` 和 `message`。

## 6. 推荐实现

### 6.1 直接收藏

```ts
export async function startFavoriteAction(
  payload: FavoriteWorkflowStartPayload,
): Promise<FavoriteWorkflowResult> {
  if (payload.action === "add") {
    await api.addFavorite(payload.comicId);
    return { status: "completed", favorited: true, committed: true };
  }

  if (payload.action === "removeAll") {
    await api.removeFavorite(payload.comicId);
    return { status: "completed", favorited: false, committed: true };
  }

  return {
    status: "failed",
    message: "当前图源不支持该收藏操作",
    errorCode: "UNSUPPORTED_ACTION",
  };
}
```

### 6.2 收藏后选择或创建收藏夹

推荐先完成全局收藏，再返回 `awaitingInput`。用户取消选择时，插件可以明确报告“已收藏但未归类”：

```ts
await api.addFavorite(payload.comicId);
return {
  status: "awaitingInput",
  favorited: true,
  committed: true,
  continuationToken: createContinuationToken(payload),
  input: buildFolderInput(),
};
```

继续函数根据 `input.value` 或 `input.created` 处理已有目标和新目标：

```ts
export async function continueFavoriteAction(
  payload: FavoriteWorkflowContinuePayload,
): Promise<FavoriteWorkflowResult> {
  const state = readContinuationToken(payload.continuationToken);
  if (!state || state.comicId !== payload.comicId) {
    return {
      status: "failed",
      message: "收藏操作已过期，请重新操作",
      errorCode: "INVALID_CONTINUATION_TOKEN",
    };
  }

  if (payload.input.cancelled) {
    return {
      status: "cancelled",
      favorited: true,
      committed: true,
      message: "已收藏，未选择收藏夹",
    };
  }

  if (payload.input.created) {
    const folder = await api.createFolder(payload.input.created);
    await api.moveFavorite(payload.comicId, folder.id);
  } else if (typeof payload.input.value === "string") {
    await api.moveFavorite(payload.comicId, payload.input.value);
  } else {
    return {
      status: "failed",
      message: "未选择有效的收藏夹",
      errorCode: "INVALID_INPUT",
    };
  }

  return { status: "completed", favorited: true, committed: true };
}
```

### 6.3 从当前收藏夹移除

当图源只支持从收藏夹移除时：

1. 检查 `action === "removeFromTarget"`；
2. 从 `payload.context.target` 读取当前收藏夹；
3. 缺少目标信息时返回 `TARGET_REQUIRED`，不要误删全局收藏；
4. 调用图源的“从收藏夹移除”接口；
5. 重新查询并返回真实的全局收藏状态。

```ts
if (payload.action === "removeFromTarget") {
  const targetId = payload.context?.target?.id;
  if (!targetId) {
    return {
      status: "failed",
      message: "缺少当前收藏夹信息，无法安全移除",
      errorCode: "TARGET_REQUIRED",
    };
  }

  await api.removeFromFolder(targetId, payload.comicId);
  return {
    status: "completed",
    favorited: await api.isFavorite(payload.comicId),
    committed: true,
  };
}
```

## 7. 旧协议兼容

宿主目前仍兼容：

- `toggleFavorite`
- `listFavoriteFolders`
- `moveFavoriteToFolder`

旧协议只能表达直接收藏、取消收藏和收藏后选择已有收藏夹，不能表达从指定收藏夹移除、创建收藏夹、多步表单或部分成功。

宿主会先调用 `startFavoriteAction`；只有确认插件没有该函数时才回退到旧协议。普通网络错误和业务错误不会被当成“缺少新协议”。

## 8. 实现注意事项

- `favorited` 是全局收藏状态，不是当前收藏夹中的存在状态。
- `committed` 必须反映真实副作用，发生过收藏请求后不能随意返回 `false`。
- 继续令牌应设置有效期，不要保存密码、Cookie 或完整登录凭据。
- 网络请求后尽量重新确认状态，避免重复点击造成重复创建收藏夹。
- 不支持的动作返回 `failed` + `UNSUPPORTED_ACTION`，不要静默执行相近但危险的动作。
- 用户取消不等于回滚，返回值必须反映真实结果。
