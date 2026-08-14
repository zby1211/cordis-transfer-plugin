# Code Structure and Implementation / 代码结构与实现

`cordis-transfer-plugin` is a static DSH profile bundle with Host and Client halves.
`cordis-transfer-plugin` 是一个 DSH 静态 profile bundle，包含 Host 与 Client 两半。

## Directory Layout / 目录结构

```
cordis-transfer-plugin/
├── index.js            # Host plugin: model tools + Remote service / Host 插件：模型工具 + Remote 服务
├── client.js           # Browser plugin: import/export panel / 浏览器插件：导入/导出面板
├── cordis.patch.yml    # Bundle patch inserted into the profile tree / 插入 profile 组合树的 bundle patch
├── package.json        # Metadata, dsh.bundle / dsh.client declarations / 包元数据与 dsh.bundle / dsh.client 声明
└── doc/                # Documentation / 文档
```

## Host: index.js / Host 侧：index.js

### Responsibilities / 职责

- Registers 3 model tools / 注册 3 个模型工具
- Registers the `cordisTransfer` Remote service for the browser panel / 注册 `cordisTransfer` Remote 服务供浏览器面板调用
- Builds and parses zip plugin bundles / 实现 zip 插件包的构建与解析
- Calls `dynamicCordisRunner` to define and run plugins / 调用 `dynamicCordisRunner` 完成插件定义与运行

### Model Tools / 模型工具

| Tool / 工具 | Implementation / 实现要点 |
| --- | --- |
| `cordis_plugin_list` | `dynamicCordisRunner.listPlugins(agent)`; returns pluginId, version pointers, packages, run state / 调用 `dynamicCordisRunner.listPlugins(agent)`，返回 pluginId、版本指针、Package 与运行状态 |
| `cordis_plugin_bundle_export` | Collects all package sources, writes `manifest.json` + `plugins/<pluginId>.json`, zips with `fflate.zipSync` / 收集全部 Package 源码，生成 manifest 与各插件文档并用 `fflate.zipSync` 打包 |
| `cordis_plugin_bundle_import` | Reads the zip, parses the manifest and plugin documents, rebuilds packages in order / 读取 zip，解析 manifest 与各插件文档，按顺序重建 Package |

### Remote Service `cordisTransfer` / Remote 服务 `cordisTransfer`

Methods / 方法：

- `listPlugins(sessionId)` / 列出插件
- `exportBundlePayload(sessionId, pluginIds, name, description)` → `{ filename, contentType, base64 }` / 导出下载载荷
- `importPayload(sessionId, filename, base64, activate)` → import result / 上传导入

When an import is not activated, the Host emits `cordis/dynamic-package` so the
browser Cordis Plugin panel refreshes its inventory and the user can activate the plugin manually.
导入未激活时，Host 会发出 `cordis/dynamic-package` 事件，让浏览器 Cordis Plugin 面板刷新 inventory，插件立即可见并可手动激活。

### Import Flow / 导入流程

1. Validate the zip and `manifest.json` / 校验 zip 与 `manifest.json`
2. Read `plugins/<pluginId>.json` / 读取 `plugins/<pluginId>.json`
3. Call `dynamicCordisRunner.define` for each plugin / 对每个插件调用 `dynamicCordisRunner.define`：
   - First package creates a new Plugin, keeping the `idPrefix` semantic prefix / 第一个 Package 新建 Plugin，保留 `idPrefix` 语义前缀
   - Subsequent packages append to that Plugin / 后续 Package 追加到该 Plugin
4. When `activate=true`, run the exported `currentPackageId` / `activate=true` 时运行导出时的 `currentPackageId`
5. On any failure, roll back every plugin imported in this batch / 任一失败则回滚本次已导入的全部插件

## Client: client.js / Client 侧：client.js

- Browser bundle in `window.__ModuleLoader__.load` format / 以 `window.__ModuleLoader__.load` 格式提供浏览器 bundle
- Registers the `id: "transfer"` Import / Export tab in `settings.plugins.tab` / 在 `settings.plugins.tab` 注册 `id: "transfer"` 的导入/导出标签页
- Mounts strict Remote descriptors for `cordisTransfer` via `ctx.remote.$mount` / 通过 `ctx.remote.$mount` 挂载 `cordisTransfer` 的严格 Remote 描述符
- Export: fetches base64 from Remote and triggers a browser download with Blob / 导出：从 Remote 获取 base64，在浏览器中用 Blob 触发下载
- Import: reads a hidden `<input type="file" accept=".zip">` and uploads base64 to the Host / 导入：隐藏 `.zip` 文件选择框读取文件，base64 上传给 Host

## Deployment Declarations / 部署声明

- `cordis.patch.yml` inserts the `cordis-transfer-tools` loader entry / `cordis.patch.yml` 插入 loader entry `cordis-transfer-tools`
- `package.json#dsh.bundle.patch` applies the patch as a bundle layer / `package.json#dsh.bundle.patch` 将 patch 作为 bundle 层应用
- `package.json#dsh.client` declares the web client and its injections / `package.json#dsh.client` 声明 web 客户端与依赖注入
