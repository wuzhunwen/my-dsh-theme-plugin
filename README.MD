# DSH 插件开发说明：My Full Theme

这是一个面向 DeepSeek Harness Web 端的完整主题插件示例，同时包含 Host 端服务和 Client 端 UI，支持预设主题、颜色定制、壁纸、毛玻璃效果和自定义 CSS。

本文档也可以作为开发其他 DSH 插件的参考。

## 1. 项目结构

```text
my-full-theme-plugin/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── cordis.patch.yml
├── examples/preset-themes.json
└── src/
    ├── index.ts                 # Host 端入口
    ├── client.ts                # Client 端入口
    ├── types.ts                 # 共享类型和默认配置
    ├── components/
    │   ├── SettingsPanel.tsx   # 设置面板
    │   └── ThemePreview.tsx     # 主题预览
    ├── services/
    │   ├── ThemeService.ts      # Host 端主题服务
    │   ├── ThemeManager.ts      # Client 端 DOM 管理
    │   └── ColorUtils.ts        # 颜色和 CSS 变量工具
    └── styles/theme.css
```

## 2. 运行环境

- Node.js 20+
- pnpm
- DSH Web profile
- TypeScript、tsup
- `@deepseek-ai/cordis` 4.x
- `@deepseek-ai/schemastery` 3.x

安装依赖：

```bash
pnpm install
```

## 3. 插件元数据和构建

`package.json` 中的入口必须指向实际生成的 `dist/` 目录：

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client.js"
  },
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

本项目使用 `tsup.config.ts` 构建两个入口：

```text
dist/index.js       Host CommonJS 入口
dist/index.mjs      Host ESM 入口
dist/index.d.ts     Host 类型声明
dist/client.js      Client CommonJS 入口
dist/client.mjs     Client ESM 入口
dist/client.d.ts    Client 类型声明
```

不要将入口写成不存在的 `lib/` 目录。

## 4. Cordis 加载补丁

当前项目通过包名加载 Host 和 Client：

```yaml
- insert:
  - id: my-full-theme
    name: 'my-full-theme-plugin'
    config: {}
  - id: my-full-theme-client
    name: 'my-full-theme-plugin/client'
```

Host 和 Client 是两个独立的加载条目：

- `my-full-theme` 加载 `dist/index.js`
- `my-full-theme-client` 加载 `dist/client.js`

使用包名可以让 DSH 正确解析 `package.json` 的 `exports`。本地开发时，修改源码后要重新构建，并确保 DSH 使用的是最新安装副本或链接副本。

## 5. Host 端开发

Host 端负责配置注册、预设管理、主题 API 和跨端事件广播。

### 5.1 插件入口和依赖

```ts
export const name = 'my-full-theme'
export const inject = ['settings']

export function apply(ctx: Context, config: Config): void {
  // 注册服务和 API
}
```

`inject` 只能声明当前 profile 实际提供的服务。当前项目验证过的 Host 依赖是 `settings`。不要随意声明 `logger`、`i18n` 等未确认存在的服务，否则插件会停留在：

```text
pending (waiting for service: xxx)
```

日志可以通过 `ctx.logger('my-theme')` 获取，但不需要把 `logger` 写入 `inject`。

### 5.2 Schema 定义

当前项目使用 schemastery v3 的默认导出：

```ts
import z from '@deepseek-ai/schemastery'
```

枚举值使用 `z.union`，不是 `z.enum`：

```ts
fit: z.union(['cover', 'contain', 'fill']).default('cover')
```

主题配置包含：

| 字段 | 说明 |
| --- | --- |
| `activePreset` | 当前预设 ID |
| `customColors` | 主色、辅助色、背景、表面和文字颜色 |
| `glassEffect` | 毛玻璃开关、模糊强度和透明度 |
| `wallpaper` | 壁纸 URL、适配方式和透明度 |
| `customCSS` | 用户自定义 CSS |

### 5.3 settings API

当前 DSH settings 服务的正确 API 是 `register`，不是 `namespace`：

```ts
const scope = ctx.settings.register('my-theme', Config, {
  base: config
})

const current = scope.get()

scope.watch((next, previous) => {
  // 配置提交后执行
})

await scope.update({ activePreset: 'ocean' })
```

常用方法：

- `register(ns, schema, options)`：注册配置命名空间
- `scope.get()`：读取解析后的配置快照
- `scope.watch(callback)`：监听配置变化
- `scope.update(patch)`：深度更新用户配置
- `scope.replace(section)`：整体替换配置，适合重置

配置更新应通过 settings scope 完成，让 DSH 负责持久化和通知其他消费者。不要自行写 settings 文件。

### 5.4 Host 与 Client 通信

Host 端在配置变化后广播主题事件：

```ts
runtime.emit('theme:update', {
  config: next,
  preset: service.getPreset(next.activePreset)
})
```

Client 端监听相同事件并重新应用 CSS 变量：

```ts
ctx.on('theme:update', (event) => {
  manager.applyTheme(event.config)
})
```

## 6. Client 端开发

Client 端负责浏览器 DOM、CSS、React 设置面板和壁纸元素。

### 6.1 Client 入口

```ts
export const name = 'my-full-theme-client'
export const inject = ['settings', 'shell']
export const priority = 10
```

Client bundle 可能先在 Node 环境中被 DSH 加载，因此不能在 `apply()` 开始时无条件访问 `document` 或 `window`：

```ts
export function apply(ctx: Context): void {
  if (typeof document === 'undefined') return
  // 浏览器端 DOM 逻辑
}
```

即使在 `ctx.effect()` 内部，也建议保留环境判断。

### 6.2 主题应用流程

`ThemeManager` 的应用流程是：

1. 将颜色、透明度和模糊值写入 `document.documentElement.style`
2. 更新 `data-theme`
3. 注入或移除自定义 CSS
4. 创建、更新或删除壁纸元素
5. 更新 `meta[name="theme-color"]`
6. 插件卸载时移除样式、壁纸和 CSS 变量

DOM 修改应提供清理函数：

```ts
ctx.effect(() => {
  const style = document.createElement('style')
  document.head.appendChild(style)

  return () => style.remove()
})
```

### 6.3 设置面板

设置面板通过 `shell.overlay` 注册到设置页面：

```ts
runtime.shell?.overlay?.('settings.general.items', () => ({
  id: 'my-full-theme-client',
  label: '主题设置',
  icon: 'palette',
  component: SettingsPanel,
  order: 10
}))
```

组件内部应使用不可变状态更新。预设切换是异步操作，需要等待持久化完成：

```ts
void api?.setPreset(preset.id).then(() => {
  // 重新读取设置或等待 theme:update
})
```

## 7. 构建和调试

### 7.1 类型检查

```bash
pnpm exec tsc --noEmit
```

如果 pnpm 因安全策略阻止 esbuild 安装脚本，可以直接调用本地编译器：

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

### 7.2 生产构建

```bash
pnpm build
```

### 7.3 开发模式

```bash
pnpm dev
```

`tsup --watch` 会持续生成最新构建产物。若 DSH 使用已安装副本，需要重新链接或更新插件，否则可能继续加载旧的 `dist`。

### 7.4 启动 DSH

```bash
dsh web
```

成功时应看到：

```text
dsh web: http://127.0.0.1:3080
```

PowerShell 健康检查：

```powershell
Invoke-WebRequest http://127.0.0.1:3080 -UseBasicParsing
```

返回 HTTP 200 即表示 Web 服务可访问。

## 8. 常见错误

### `waiting for service: logger` 或 `i18n`

检查入口的 `inject`。只声明实际存在的服务：

```ts
export const inject = ['settings']
```

服务不存在时，插件不会执行 `apply()`。

### `settings.namespace is not a function`

说明使用了旧的 settings 示例。改为：

```ts
const scope = ctx.settings.register('my-theme', Config, { base: config })
```

然后使用 `scope.get()`、`scope.watch()` 和 `scope.update()`。

### `document is not defined`

说明 Client bundle 在 Node 初始化阶段访问了浏览器对象。所有 DOM 逻辑都应放在环境判断之后：

```ts
if (typeof document === 'undefined') return
```

### 修改后错误仍然没有变化

通常是 DSH 加载了旧包或旧构建产物。按以下顺序检查：

1. 执行 `pnpm build`
2. 确认 `dist/index.js` 和 `dist/client.js` 的更新时间
3. 检查 `cordis.patch.yml` 是否使用正确的包名
4. 重新链接或重新安装本地插件
5. 重启 `dsh web`

## 9. 发布检查清单

- [ ] `pnpm install` 成功
- [ ] `pnpm exec tsc --noEmit` 通过
- [ ] `pnpm build` 通过
- [ ] `package.json` 的 `main`、`types`、`exports` 指向 `dist`
- [ ] `cordis.patch.yml` 同时声明 Host 和 Client
- [ ] `inject` 没有声明不存在的服务
- [ ] Client 不在 Node 环境访问 `document` 或 `window`
- [ ] settings 使用 `register` 和 scope API
- [ ] `dsh web` 启动时没有 pending 或 loader error
- [ ] `http://127.0.0.1:3080` 返回 HTTP 200

## 10. 本项目 API

Host 端通过 `ctx.provide` 提供两个服务。

### `themeService`

- `registerPreset(preset)`：注册预设
- `getPreset(id)`：读取指定预设
- `getAllPresets()`：读取全部预设
- `getCurrentTheme()`：读取当前主题
- `uploadWallpaper(file)`：将图片读取为 data URL

### `themeAPI`

- `getTheme()`：读取当前主题
- `setPreset(id)`：异步切换预设，返回 `Promise<boolean>`
- `getPresets()`：读取预设列表
- `uploadWallpaper(file)`：上传或转换壁纸

当前壁纸实现使用 data URL，适合本地原型和个人配置。生产环境若需要大图片或多设备同步，应改为上传到服务端并只保存远程 URL。

## 11. 当前功能边界

- 主题配置通过 DSH settings 持久化
- 颜色以字符串形式保存，UI 默认使用十六进制颜色输入
- 自定义 CSS 是用户输入内容，发布版本应根据产品需求增加内容限制
- 当前没有实现配置导入导出、快捷键注册和远程壁纸存储
- 预设示例位于 `examples/preset-themes.json`，新增预设时需要同步更新 Host 端预设注册逻辑
