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
| `columnOpacity` | 壁纸模式下工作区/聊天记录列的背景不透明度（0-100，0=与 root 一致完全透明，100=纯主题背景色） |
| `composerOpacity` | 壁纸模式下消息发送框的背景不透明度（0-100，0=完全透明，100=纯表面色，与列底色互不影响） |
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

当前主题 Client 只注入页面渲染所需的最少服务（持久化走 localStorage，见 [7.3](#73-配置持久化localstorage)）：

```ts
export const inject = ['slots']
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

### 7.3 配置持久化（localStorage）

**重要**：本插件不再通过浏览器的 `settingsScope` 读写配置，而是使用客户端 `localStorage`。

原因见 [第 12 节 · 问题 1](#12-常见问题与修复记录)：DSH 的设置协议对浏览器只暴露一张**白名单**（`locale`、`permission`、`ui-conversation`、`ui-theme`、`shell`、`agent-loop`、`web-search-deepseek`、`ui-onboarding`、`agent-presets`，以及 LLM 可配置提供方的 namespace）。第三方插件自行 `settings.register` 的 namespace **不会**暴露给浏览器，`settingsScope.set()` 会返回 `settings-not-exposed` 并被 `catch` 静默吞掉——界面乐观更新但永不落盘。只有 Host 侧自己调用 `settings.update()` 时才能写进 `settings.yaml`。

因此持久化统一走客户端，壁纸采用**「独立数据 key + 当前 id + 历史列表」**存储：

```ts
const CONFIG_KEY = 'my-full-theme-plugin:config'                  // 主题配置；wallpaper 只存 fit/opacity，url 存空
const WALLPAPER_CURRENT_KEY = 'my-full-theme-plugin:wallpaper-current' // 当前壁纸 id
const WALLPAPER_HISTORY_KEY = 'my-full-theme-plugin:wallpaper-history' // [{ id, name, ts }] 历史壁纸列表（上限 8）
const WALLPAPER_DATA_PREFIX = 'my-full-theme-plugin:wallpaper:'    // 单张壁纸数据 key，wallpaper:<id> = { url, name }
```

- 运行时 `config.wallpaper.url` 始终是解析后的 data URL（DOM、UI 直接使用）；只有落盘时配置里存空 url，当前壁纸由 `wallpaper-current` 的 id 从 `wallpaper:<id>` 取回。
- **每张壁纸一个独立 key**：删一张只删一个 key（O(1)），配额按单 key 算；历史列表只存 id+name，体积极小。
- 壁纸去重：`findIdByUrl()` 扫描现有数据 key，同一张图（上传或从历史切换）复用同一 id，不会重复存储。
- 配额兜底：新增壁纸写入失败时，按 ts 丢最旧且非当前的历史项并重试，同步从历史列表剔除；仍失败则 `console.warn` 并保留当前壁纸。
- `ThemeManager` 同时是主题 store：`applyTheme()` 负责 DOM 应用 + 通知订阅者 + 写入 localStorage；面板通过 `useSyncExternalStore(manager.subscribe, manager.getTheme)` 读写，不维护第二份状态。
- 设置面板的所有改动走 `onConfigChange(next)` → `manager.applyTheme(next)`，配置既落盘又即时生效。
- 壁纸上传改为**先暂存预览、点「保存」才应用并持久化入历史**；历史壁纸点击立即应用；删除/清空历史时保留当前壁纸的 id 和数据 key，避免删掉正在使用的图。

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

本插件持久化不依赖 settings provider，面板直接订阅 `ThemeManager`，正常情况下不会停留在加载中。若出现，检查：

1. `client/client.js` 是否包含 `__ModuleLoader__.load`，浏览器是否加载了 `/plugins/my-full-theme-plugin/client.js`
2. Client 是否注入了 `slots` 服务
3. 是否先执行了 `pnpm build` 并重新 `dsh plugin --profile web add <路径>`、重启 `dsh web`

> 注意：不要依赖 `/api/settings.describe` 返回 `my-theme`。`my-theme` 不在 DSH 浏览器的 settings 白名单里，属于预期行为（见 [问题 1](#12-常见问题与修复记录)）。

### CSS 变量改变但页面仍是深色

Harness 自身不仅使用插件的 `--theme-*` 变量，还使用原生的：

```html
<body data-ds-dark-theme>
```

如果切换到浅色主题时这个属性仍然存在，Harness 内部 CSS 会继续覆盖页面背景、侧边栏和卡片。ThemeManager 必须同步更新：

```ts
const dark = isDarkTheme(config)
document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
document.body.toggleAttribute('data-ds-dark-theme', dark)
document.body.dataset.myTheme = config.activePreset
```

自定义主题还需要用 `body[data-my-theme]` 选择器覆盖 Harness 的框架、侧边栏和输入卡片，否则只有 CSS 变量变化，视觉组件不会跟随变化。

建议通过计算样式验证，而不是只检查设置面板文字：

```js
const root = getComputedStyle(document.documentElement)
const body = getComputedStyle(document.body)
console.log({
  theme: document.documentElement.dataset.theme,
  dark: document.body.hasAttribute('data-ds-dark-theme'),
  scheme: root.colorScheme,
  body: body.backgroundColor,
  primary: root.getPropertyValue('--theme-primary')
})
```

浅色主题应满足 `dark === false`、`scheme === 'light'`；深色主题应满足 `dark === true`、`scheme === 'dark'`。

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
- [ ] 修改主题后**刷新页面仍保留**（localStorage）
- [ ] 上传壁纸后**刷新页面仍显示壁纸**，`body[data-my-wallpaper]` 存在
- [ ] 壁纸点「保存」后进入「历史壁纸」，刷新页面后仍在，可点击切换、单张删除、一键清空
- [ ] 设置壁纸后**聊天记录清晰可读**（壁纸垫底，内容绘制在其上层），移除壁纸/打开设置页时恢复不透明背景
- [ ] `http://127.0.0.1:3080` 返回 HTTP 200

## 11. 当前边界

- 主题页面和 Client 注入已通过 DSH Web profile 验证。
- 配置通过客户端 `localStorage` 持久化，**刷新页面后保留**：主题配置存 `my-full-theme-plugin:config`（壁纸仅存 fit/opacity）、当前壁纸 id 存 `my-full-theme-plugin:wallpaper-current`、历史列表存 `my-full-theme-plugin:wallpaper-history`、单张壁纸数据存 `my-full-theme-plugin:wallpaper:<id>`；新增壁纸超出配额时自动按时间丢最旧非当前项并重试，全部失败则**回滚已删历史**并 `console.warn`，不影响颜色/预设等其余配置。
- **超大壁纸自动压缩**：保存/应用壁纸时，超过约 1.5MB（base64 字符）的 data URL 会用 canvas 压缩到最长边 2560、JPEG 逐步降质，保证能写入 localStorage 持久化；否则 4-5MB 的 PNG 转 base64 后（约 6.3MB 字符）会超过 Chromium/Electron 的 localStorage 配额（约 5MB），导致写入失败——这也是旧版「选大图丢历史、刷新壁纸消失」的根因。
- 该持久化按浏览器隔离：同一主机上的另一个浏览器/配置文件不会共享主题。
- 设置页面由 `ThemeManager` 提供主题状态，不依赖 settings provider 快照，始终可显示。
- 历史壁纸上限 8 张（`WALLPAPER_HISTORY_MAX`），超出自动丢弃最旧。
- 当前没有实现配置导入导出、快捷键和远程壁纸存储。

## 12. 常见问题与修复记录

本节记录本项目迭代过程中修复的问题及根因，方便后续回归。

### 问题 1：主题配置刷新后丢失

**现象**：在设置页切换主题/改颜色/传壁纸后，页面立即生效，但刷新后回到默认。

**根因**：客户端曾通过 `settingsScope`（`scope.set(...)`）写入 `my-theme` namespace。但 DSH 的设置协议对浏览器只暴露一张固定白名单：

- LLM 可配置提供方 namespace（`ctx.llm.listConfigurableProviders()`）
- `agent-loop`、`shell`、`locale`、`permission`、`ui-conversation`、`ui-theme`、`web-search-deepseek`
- `ui-onboarding`、`agent-presets`

`my-theme` 不在其中，因此每个 `settings.describe`/`settings.mutate` 都返回 `settings-not-exposed`。面板里 `.catch(() => undefined)` 把错误吞掉，界面靠 `onConfigChange → applyTheme` 乐观更新，于是“看起来改了、其实没落盘”，`~/.dsh/settings.yaml` 里始终没有 `my-theme:` 段。内置 `ui-theme`/`skin-background` 能持久化，是因为它们由 **Host 侧自己**调用 `settings.update()`，与浏览器白名单无关。

**解决**：改为客户端 `localStorage` 持久化，并把**配置与壁纸拆成两个 key**（`...:config` + `...:wallpaper`）。`ThemeManager.persist()` 在每次 `applyTheme` 时先写壁纸 key、再写配置 key；`loadPersisted()` 在页面加载时读回合并并重新应用。壁纸体积再大也只影响自己的 key，不再拖垮颜色/预设的保存。不再依赖 `settingsScope`（见 [7.3](#73-配置持久化localstorage)）。

> 附：修复过程中还踩到两个"隐藏"坑——(1) 单个 key 存整份配置，壁纸超配额会让所有后续保存（含颜色）一并失败；(2) 启动顺序写成"先 `applyTheme(默认)` 再读存储"，导致每次刷新都用默认值覆盖了已保存的配置。正确的启动顺序必须是**先 `loadPersisted()` 再 `applyTheme(saved ?? 默认)`**。
>
> 注：上述"两个 key"设计后来被 [问题 4](#问题-4新壁纸不进历史--缺少保存确认) 的「独立数据 key + 当前 id + 历史列表」存储取代（当前设计见 [7.3](#73-配置持久化localstorage)），这里保留为当时的修复记录。

### 问题 2：壁纸不生效、设置页变形

**现象**：上传壁纸后主界面看不到背景图；设置页被整体毛玻璃化（"变形"）。

**根因（两部分）**：
1. `applyWallpaper()` 创建了 `#theme-wallpaper` 图层（`position:fixed; inset:0; z-index:-1`），但从未给 `body` 添加 `data-my-wallpaper` 属性，`client.ts` 里的半透明规则永不匹配，app 的 frame/card 保持实心背景，把壁纸完全盖住。
2. 修复 1 后，`body[data-my-wallpaper] [class*="_frame"]` 把**整个应用（含设置页）**变成 68% 透明 + `backdrop-filter:blur(8px)` + `position:relative; z-index:1`，设置页因此"变形"；深色罩 + 模糊又让壁纸看起来只是暗糊。且 `_sidebarCol/_layout/_main/_newSession/_sessionRow` 等选择器在前端里并不存在。

**解决**：
1. `applyWallpaper()` 现在 `document.body.toggleAttribute('data-my-wallpaper', Boolean(url))`，无壁纸时移除图层，`destroy()` 清理属性。
2. 删除 `position:relative; z-index:1` 与 `backdrop-filter:blur`，半透明只作用于真实存在的 `_frame`/`_card` 类，且**豁免设置页**：`body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"]`（75% 背景）与 `[class*="_card"]`（80% 背景）。设置面板挂载时给 `body` 加 `my-theme-settings-open`、卸载移除，因此设置页保持不透明、不变形，壁纸在关闭设置后的主界面清晰透出。

### 问题 3：侧边栏被壁纸层盖住

**现象**：设置壁纸后，主界面左侧会话列表栏显示在壁纸层下面，层级错乱。

**根因**：`#theme-wallpaper` 是 `position:fixed; inset:0; z-index:1`（ThemeManager `applyWallpaper()`），会盖住所有常规流内容；侧边栏默认没有定位、`z-index:auto`（等同 0），因此被压在壁纸之下。

**解决（已被[问题 5](#问题-5壁纸遮挡聊天记录)的「壁纸垫底」方案取代）**：当时在 `client.ts` 注入的样式中增加规则，把侧边栏提到壁纸层之上：

```css
body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="hHd-Xa_root"] { position: absolute; z-index: 2; }
```

- 侧边栏选择器为 `hHd-Xa_root hHd-Xa_quietBars`，用属性选择器 `[class*="hHd-Xa_root"]` 对哈希后缀更稳健。
- `position:absolute` 不写 top/left，侧边栏保持在原位置。

> 注：该「逐组件抬升」方案只救了侧边栏，聊天记录仍被压在壁纸层下（见问题 5）；问题 5 改为壁纸垫底后，本条规则已删除。

### 问题 4：新壁纸不进历史 + 缺少「保存」确认

**现象（两部分）**：
1. 选择新的壁纸文件后，没有出现在「历史壁纸」里。
2. 选择文件即立即应用，缺少"确认保存"环节。

**根因**：
1. **配额重复占用**。同一个 base64 壁纸被存了两份：当前壁纸单独存一份，历史数组里又存一份完整 url。base64 体积约为原图 4/3，一张约 2MB 的图在两个 key 里各占约 2.7MB，加起来逼近 localStorage 约 5MB 配额，历史 key 的 `setItem` 抛错被 `catch` 吞掉（只 `console.warn`），导致壁纸从未写进历史。
2. 原实现文件选择后立刻 `applyTheme`，没有"暂存 → 保存"的确认环节。

**解决**：
- 改为**「独立数据 key + 当前 id + 历史列表」存储**：历史列表只存 `[{ id, name, ts }]`，单张壁纸数据存 `wallpaper:<id>`（`{ url, name }`），当前壁纸 id 存 `wallpaper-current`，配置不再存壁纸数据引用。**每张壁纸只存一份**，删一张只删一个 key；新增壁纸写入超配额时按 ts 丢最旧非当前项并重试，仍失败则 `console.warn` 并保留当前壁纸。
- 壁纸去重：`findIdByUrl()` 扫描现有数据 key，同一张图（上传或从历史切换）复用同一 id，不重复存储。
- 上传流程改为**先暂存预览、点「保存」才应用并持久化入历史**；点「取消」丢弃；切换页签时丢弃未保存的暂存；历史项点击立即应用；删除/清空历史时保留当前壁纸的 id 和数据 key，避免删掉正在使用的图。
- 一次性迁移旧数据（`migrateLegacy()`）：旧 `my-full-theme-plugin:wallpaper` key、上一版 `wallpaper-map`、旧格式历史（含完整 url 的数组）、旧 `@local`/`@local:<id>` 标记的配置自动转换为新结构并清理（旧格式历史优先转换、避免覆盖丢失）。

### 问题 5：壁纸遮挡聊天记录（两次修复）

**现象（第一版）**：设置壁纸后，聊天记录（消息区文字）被壁纸盖住，透明度越低越看不清。

**根因**：壁纸层 `#theme-wallpaper` 是 `position:fixed; inset:0; z-index:1`，绘制在所有常规流内容**之上**；问题 3 只把侧边栏单独抬到 `z-index:2`，中央聊天列（AppFrame 的 `centerCol`，无定位、`z-index:auto`）仍被压在壁纸层下，消息文字因此被图片遮住。这种「覆盖 + 逐组件抬升」模型注定要给每个顶层区域打补丁，漏一个就遮一个。

**第一版解决：改为「壁纸垫底」**——壁纸层 `z-index:-1` + `body[data-my-wallpaper]{background:transparent}`，内容天然在壁纸之上，删除侧边栏抬升规则。

**现象（第二版回归）**：修复后壁纸反而几乎看不见了。

**根因（第二版，两部分）**：
1. **不透明容器挡住垫底壁纸**：中央聊天列里 `wSkVaW_root`（会话列表容器，覆盖整个中心列）自带不透明背景 `rgb(21,21,23)`（`var(--dsw-alias-bg-base)`），壁纸垫底后整个被它盖住；同列的 `ydkMvW_root`（详情列容器）在详情栏打开时同理。
2. **两层半透明叠乘**：`_frame`(75%) 与 `_root`(80%) 两层半透明背景叠乘后，壁纸实际透出约 5%，即便没被挡住也几乎不可见。

**最终方案（令牌映射 + 单层透底 + 兜底，当前实现）**：
- `ThemeManager.applyWallpaper()`：壁纸层 `z-index:-1`（垫底）。
- `client.ts` 主题激活时**映射 DSH 设计令牌**：把 `--dsw-alias-bg-base`、`--dsw-specific-sidebar-fill` 指到 `--theme-background`，把 `--dsw-alias-bg-layer-1/2/3`、`--dsw-specific-input-major`、`--dsw-specific-bubble`、`--dsw-specific-menu`、`--dsw-specific-selector`、`--dsw-alias-bg-module-platform` 指到 `--theme-surface`。工作区列/聊天记录列/侧边栏等所有消费这些令牌的组件（`wSkVaW_root`、`ydkMvW_root`、`hHd-Xa_root` 等）自动与 root 同色，不再依赖哈希类名逐类覆盖，也免受 DSH 每次构建改类名的影响。
- `client.ts` 壁纸激活时把上述背景令牌置为按 `--column-opacity`（0-100%，设置面板「列背景不透明度」可调）混合的主题背景色：0% 时工作区/聊天记录/侧边栏与 root 一样**完全透底**、壁纸全幅可见；100% 时恢复纯主题背景色；中间值半透明衬托、兼顾可读性。`_frame`、`_sidebarCol` 同时直接透底避免叠乘；**兜底规则 `[class*="_frame"] *` 让框架内所有元素背景一律透底**——代码块、状态胶囊、行选中态、选择器等大量自带背景的类全部跟随 root 透明度（conversation 包一个包就用了 21 种背景变量，逐类枚举必然漏）；**列容器规则 `[class*="_root"]` 后声明**，在兜底之上按同一 `--column-opacity` 上色；**消息发送框规则 `[class*="_card"]` 同样后声明**，按独立的 `--composer-opacity`（设置面板「发送框不透明度」）以表面色上色，与列底色互不影响。
- **豁免**：图片与悬浮层（`_panel`/`_menu`/`_popover`/`_tooltip`/`_dialog`/`_modal`）恢复 `--theme-surface`，保证弹层可读；**反馈**：按钮/行悬停与选中态（`[class*="Row" i]:hover`、`[class*="_selected"]`）保留主色淡染。
- 只改背景，**文字保持不透明正常显示**；设置页打开时豁免（`:not(.my-theme-settings-open)`），恢复不透明。

验证要点：设置壁纸后消息文字清晰可读、壁纸从聊天区明显透出、工作区/聊天记录与 root 同色同透明度；移除壁纸后各列与 root 同为 `--theme-background`。

### 问题 6：弹窗会话误跟随列透明度

**现象**：会话管理弹窗（portal 渲染到 body、frame 之外）背景跟随「列背景不透明度」而不是「发送框不透明度」。

**根因**：列容器规则 `[class*="_root"]` 未限定在 frame 内，portal 弹窗的根容器类名同样含 `_root`，被误染。

**解决**：列容器规则收紧为 `[class*="_frame"] [class*="_root"]`；另加 frame 之外的 `[class*="_dialog"]`/`[class*="_modal"]` 规则，按 `--composer-opacity`（发送框不透明度）以表面色上色，弹窗会话与发送框同透明度。

### 问题 7：选大图壁纸会删历史且刷新丢失

**现象**：选择 `D:\个人\wallpaper\20260815124900.png`（约 4.75MB）作壁纸后，历史壁纸被删掉，刷新后壁纸消失。

**根因（配额超限 + 兜底删历史）**：4.75MB PNG 转 base64 后约 6.34M 字符，超过 Chromium/Electron localStorage 配额（约 5MB）。`writeWallpaperData` 保存失败后走「删最旧历史项腾空间」兜底，但新壁纸单张就超配额，删光历史也放不下 → 返回 false → 新壁纸既不进历史也不写 `wallpaper-current`；而被删的历史项没有回滚 → 刷新后当前壁纸丢失、历史也被清掉。

**解决**：
1. **超大壁纸自动压缩**：保存/应用壁纸时，超过约 1.5MB（base64 字符）的 data URL 用 canvas 压缩到最长边 2560、JPEG 从 0.85 起逐步降质（`ThemeManager.compressWallpaperDataUrl()`），4-5MB 原图压到可持久化尺寸。
2. **失败回滚**：`writeWallpaperData` 淘汰历史项前先备份，若最终仍写不下则恢复被删的历史项与历史列表，绝不静默丢历史。
3. `wallpaper-current` 写入补 try-catch，配额满不再抛异常。

验证要点：选择 4-5MB 壁纸保存后历史仍在、刷新后壁纸保留；选图时超大图自动压缩后保存。
