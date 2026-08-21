# DSH 插件开发说明

本项目是一个 DeepSeek Harness Web 主题插件示例，包含 Host 端主题服务和 Client 端设置界面，支持预设主题、颜色、壁纸、毛玻璃效果和自定义 CSS。

## 1. 架构

DSH 插件包含两个运行端：

- **Host**：运行在 Node.js，负责 Cordis 服务、settings、预设和持久化。
- **Client**：运行在浏览器，负责 DOM、React、CSS 和设置页面。

Host 通过 `cordis.patch.yml` 插入插件树；Client 由 `package.json` 的 `dsh.client` 元数据和 `exports["./client"]` 自动注入。

## 2. 目录结构

```text
my-full-theme-plugin/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── cordis.patch.yml
├── scripts/
│   └── wrap-client.mjs       # 生成 DSH ModuleLoader 包装
├── client/
│   └── client.js             # 构建生成的 Client 入口
├── dist/
│   ├── index.js              # Host ESM bundle
│   ├── index.cjs             # Host CommonJS bundle
│   ├── client.js             # Client ESM bundle
│   └── client.cjs            # Client CommonJS bundle
└── src/
    ├── index.ts              # Host 入口
    ├── client.ts             # Client 入口
    ├── types.ts
    ├── components/
    └── services/
```

## 3. package.json

DSH Client 依赖配置是包名数组，不是源码文件路径：

```json
{
  "type": "module",
  "main": "dist/index.js",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "default": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./client": {
      "import": "./client/client.js",
      "default": "./client/client.js",
      "types": "./dist/client.d.ts"
    },
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml",
      "host": "./src/index.ts"
    },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-connection",
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-settings",
        "@deepseek-ai/dsh-client-ui-theme"
      ]
    }
  }
}
```

必须导出 `./package.json` 和 `./cordis.patch.yml`，这样 DSH 插件管理器才能读取包元数据和补丁。

## 4. Cordis 补丁

补丁只插入 Host entry：

```yaml
- insert:
  - id: my-full-theme
    name: 'my-full-theme-plugin'
    config: {}
```

不要把 Client 再写成普通 Host entry。Client 由 `dsh.client` 自动加载。

## 5. Client ModuleLoader

DSH Web 不接受普通 ESM Client 文件。浏览器入口必须调用：

```js
window.__ModuleLoader__.load({
  id: 'my-full-theme-plugin',
  factory: (require) => {
    // bundled CommonJS body
    return module.exports
  }
})
```

本项目的 `scripts/wrap-client.mjs` 会把 `dist/client.cjs` 包装成 `client/client.js`。因此构建命令必须包含：

```json
{
  "scripts": {
    "build": "tsup && node scripts/wrap-client.mjs"
  }
}
```

如果出现以下错误，说明 Client 没有经过包装：

```text
loaded without registering "my-full-theme-plugin" via __ModuleLoader__.load
```

## 6. Host 开发

### 6.1 入口和服务

```ts
export const name = 'my-full-theme'

export function apply(ctx: Context, config: Config): void {
  ctx.inject(['settings'], (settingsCtx) => {
    // settings provider 就绪后注册 namespace
  })
}
```

只声明当前 profile 中真实存在的服务。错误声明 `logger` 或 `i18n` 会导致：

```text
pending (waiting for service: logger)
pending (waiting for service: i18n)
```

日志可以使用 `ctx.logger('my-theme')`，不需要将 `logger` 加入依赖列表。

### 6.2 Schema

当前项目使用 schemastery 默认导出：

```ts
import z from '@deepseek-ai/schemastery'
```

枚举值使用 `z.union`：

```ts
z.union(['cover', 'contain', 'fill'])
```

当前主题配置包含：

| 字段 | 用途 |
| --- | --- |
| `activePreset` | 当前预设 ID |
| `customColors` | 主色、辅助色、背景、表面和文字颜色 |
| `glassEffect` | 毛玻璃开关、模糊和透明度 |
| `wallpaper` | URL、适配方式和透明度 |
| `customCSS` | 自定义 CSS |

### 6.3 settings 注册

使用 DSH settings namespace：

```ts
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

const namespace = settingsNamespace('my-theme')
const scope = settingsCtx.settings.register(namespace, Config, {
  base: config
})

scope.watch((next, previous) => {
  // 配置发生变化
})

await scope.update({ activePreset: 'ocean' })
```

常用 API：

- `register(ns, schema, options)`：注册 namespace
- `scope.get()`：读取 Host 配置
- `scope.watch(callback)`：监听配置
- `scope.update(patch)`：更新用户配置
- `scope.replace(section)`：整体替换配置

当前 API 不使用 `namespace()`、`settings.set()` 或全局 `settings.watch()`。

## 7. Client 开发

### 7.1 浏览器环境保护

Client 可能先在 Node 环境加载，不能无条件访问浏览器对象：

```ts
export function apply(ctx: Context): void {
  if (typeof document === 'undefined') return
  // 浏览器逻辑
}
```

否则会出现：

```text
ReferenceError: document is not defined
```

当前主题 Client 使用：

```ts
export const inject = ['slots', 'settingsScope', 'connection', 'remote']
```

### 7.2 注册设置页面

当前 DSH 设置界面使用 slot：

```ts
ctx.slots.inject('settings.section', () => ctx.slots.register({
  name: 'settings.section',
  id: 'my-theme',
  order: 30,
  label: '主题设置',
  inject: () => ({ scope })
}, SettingsPanel))
```

不要使用旧的：

```ts
shell.overlay('settings.general.items', ...)
```

### 7.3 Client settingsScope

浏览器端使用 `settingsScope`，不能直接调用 Host 的 `ctx.settings.get()`：

```ts
const scope = ctx.settingsScope.bind({
  namespace: 'my-theme'
})

const snapshot = scope.getSnapshot()
const unsubscribe = scope.subscribe(() => {
  const config = scope.getSnapshot().value
})

await scope.set('activePreset', 'ocean')
```

设置面板应处理 `loading` 和 `unavailable` 状态。本项目提供默认配置回退，使 settings provider 暂时没有快照时页面仍可显示。

### 7.4 清理 DOM

```ts
ctx.effect(() => {
  const style = document.createElement('style')
  document.head.appendChild(style)

  return () => style.remove()
})
```

主题管理器还需要清理壁纸、CSS 变量和自定义样式。

## 8. 构建、安装和启动

```powershell
pnpm install
.\node_modules\.bin\tsc.cmd --noEmit
pnpm build
dsh plugin --profile web add F:\Code\DshPlugin\my-full-theme-plugin
dsh web
```

浏览器访问：

```text
http://127.0.0.1:3080
```

如果 3080 已被旧实例占用，先关闭旧的 `dsh web` 再重启。否则会出现：

```text
EADDRINUSE: address already in use 127.0.0.1:3080
```

修改 `package.json`、`exports`、`dsh.client` 或构建脚本后，必须重新执行 `dsh plugin --profile web add <本地路径>`，然后重启 DSH。

## 9. 排错清单

### 插件已安装但没有“主题设置”

依次确认：

1. `package.json` 存在 `dsh.client`
2. `dsh.client.inject` 是依赖包数组
3. `exports["./client"]` 指向 `client/client.js`
4. `client/client.js` 包含 `__ModuleLoader__.load`
5. `cordis.patch.yml` 只插入 Host
6. 执行 `pnpm build`
7. 重新执行 `dsh plugin --profile web add <路径>`
8. 完全重启 `dsh web`
9. 浏览器强制刷新

浏览器资源中应出现：

```text
/plugins/my-full-theme-plugin/client.js
```

### `settings.namespace is not a function`

使用 `settings.register()` 返回的 scope，不要使用旧 API。

### 页面显示“主题设置”但一直“加载中”

检查：

1. Host 是否注册 `my-theme` namespace
2. Client 是否绑定 `settingsScope` 的 `my-theme`
3. `/api/settings.describe` 是否返回 `my-theme`
4. 设置组件是否处理 `loading` 和 `unavailable`

### `document is not defined`

为所有 DOM 代码增加 `typeof document` 保护。

## 10. 验证清单

- [ ] `pnpm install` 成功
- [ ] TypeScript 检查通过
- [ ] `pnpm build` 通过
- [ ] `client/client.js` 包含 `__ModuleLoader__.load`
- [ ] 本地插件重新注册成功
- [ ] `dsh web` 无 loader error
- [ ] 浏览器加载 `/plugins/my-full-theme-plugin/client.js`
- [ ] 设置导航显示“主题设置”
- [ ] 主题页面显示预览和预设主题
- [ ] 页面无 `document is not defined`
- [ ] `http://127.0.0.1:3080` 返回 HTTP 200

## 11. 当前边界

- 主题页面和 Client 注入已通过 DSH Web profile 验证。
- 壁纸当前保存为 data URL，适合本地使用；生产环境应考虑远程存储。
- 设置页面提供默认配置回退，确保 settings provider 暂时不可用时仍能显示 UI。
- 生产环境仍应确认 `/api/settings.describe` 返回 `my-theme`，以确保用户修改能够持久化。
- 当前没有实现配置导入导出、快捷键和远程壁纸存储。
