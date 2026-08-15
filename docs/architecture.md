# Code Structure and Implementation

`cordis-transfer-plugin` is a static DSH profile bundle with Host and Client halves.

`cordis-transfer-plugin` 是一个 DSH 静态 profile bundle，包含 Host 与 Client 两半。

## Directory Layout

```
cordis-transfer-plugin/
├── index.js
├── client.js
├── cordis.patch.yml
├── package.json
└── docs/
```

`index.js` is the Host plugin with model tools and the Remote service.

`index.js` 是 Host 插件，包含模型工具与 Remote 服务。

`client.js` is the browser plugin with the import/export panel.

`client.js` 是浏览器插件，包含导入/导出面板。

`cordis.patch.yml` inserts the plugin into the profile tree.

`cordis.patch.yml` 把插件插入 profile 组合树。

## Host: index.js

### Responsibilities

- Registers 3 model tools.

  注册 3 个模型工具。

- Registers the `cordisTransfer` Remote service for the browser panel.

  注册 `cordisTransfer` Remote 服务供浏览器面板调用。

- Builds and parses zip plugin bundles.

  实现 zip 插件包的构建与解析。

- Calls `dynamicCordisRunner` to define and run plugins.

  调用 `dynamicCordisRunner` 完成插件定义与运行。

### Model Tools

| Tool | Implementation |
| --- | --- |
| `cordis_plugin_list` | Calls `dynamicCordisRunner.listPlugins(agent)`.<br>调用 `dynamicCordisRunner.listPlugins(agent)`，返回 pluginId、版本指针、Package 与运行状态。 |
| `cordis_plugin_bundle_export` | Writes `manifest.json` + `plugins/<pluginId>.json`, then zips them with `fflate.zipSync`.<br>生成 manifest 与各插件文档，并用 `fflate.zipSync` 打包。 |
| `cordis_plugin_bundle_import` | Reads the zip, parses documents, and rebuilds packages in order.<br>读取 zip，解析文档，按顺序重建 Package。 |

### Remote Service `cordisTransfer`

- `listPlugins(sessionId)`

  列出插件。

- `exportBundlePayload(sessionId, pluginIds, name, description)` returns `{ filename, contentType, base64 }`.

  导出下载载荷，返回 `{ filename, contentType, base64 }`。

- `importPayload(sessionId, filename, base64, activate)` returns the import result.

  上传导入，返回导入结果。

When an import is not activated, the Host emits `cordis/dynamic-package` so the
browser Cordis Plugin panel refreshes its inventory and the user can activate the plugin manually.

导入未激活时，Host 会发出 `cordis/dynamic-package` 事件，让浏览器 Cordis Plugin 面板刷新 inventory，插件立即可见并可手动激活。

### Import Flow

1. Validate the zip and `manifest.json`.

   校验 zip 与 `manifest.json`。

2. Read `plugins/<pluginId>.json`.

   读取 `plugins/<pluginId>.json`。

3. Call `dynamicCordisRunner.define` for each plugin:
   the first package creates a new Plugin with the same `idPrefix` semantic prefix;
   subsequent packages append to that Plugin.

   对每个插件调用 `dynamicCordisRunner.define`：
   第一个 Package 新建 Plugin 并保留 `idPrefix` 语义前缀；
   后续 Package 追加到该 Plugin。

4. When `activate=true`, run the exported `currentPackageId`.

   `activate=true` 时运行导出时的 `currentPackageId`。

5. On any failure, roll back every plugin imported in this batch.

   任一失败则回滚本次已导入的全部插件。

## Client: client.js

- Browser bundle in `window.__ModuleLoader__.load` format.

  以 `window.__ModuleLoader__.load` 格式提供浏览器 bundle。

- Registers the `id: "transfer"` Import/Export tab in `settings.plugins.tab`.

  在 `settings.plugins.tab` 注册 `id: "transfer"` 的导入/导出标签页。

- Mounts strict Remote descriptors for `cordisTransfer` via `ctx.remote.$mount`.

  通过 `ctx.remote.$mount` 挂载 `cordisTransfer` 的严格 Remote 描述符。

- Export: fetches base64 from Remote and triggers a browser download with Blob.

  导出：从 Remote 获取 base64，在浏览器中用 Blob 触发下载。

- Import: reads a hidden `<input type="file" accept=".zip">` and uploads base64 to the Host.

  导入：隐藏 `.zip` 文件选择框读取文件，base64 上传给 Host。

## Deployment Declarations

- `cordis.patch.yml` inserts the `cordis-transfer-tools` loader entry.

  `cordis.patch.yml` 插入 loader entry `cordis-transfer-tools`。

- `package.json#dsh.bundle.patch` applies the patch as a bundle layer.

  `package.json#dsh.bundle.patch` 将 patch 作为 bundle 层应用。

- `package.json#dsh.client` declares the web client and its injections.

  `package.json#dsh.client` 声明 web 客户端与依赖注入。
