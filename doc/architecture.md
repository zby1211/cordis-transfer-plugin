# 代码结构与实现

`cordis-transfer-plugin` 是一个 DSH 静态 profile bundle，由 Host 与 Client 两半组成。

## 目录结构

```
cordis-transfer-plugin/
├── index.js            # Host 插件：模型工具 + Client 调用的 Remote 服务
├── client.js           # 浏览器插件：设置页导入/导出面板
├── cordis.patch.yml    # bundle patch：把插件插入 profile 组合树
├── package.json        # 包元数据、dsh.bundle / dsh.client 声明
└── doc/                # 文档
```

## Host：index.js

### 职责

- 注册 3 个模型工具
- 注册 `cordisTransfer` Remote 服务，供浏览器面板调用
- 实现 zip 插件包的构建与解析
- 调用 `dynamicCordisRunner` 完成插件定义与运行

### 模型工具

| 工具 | 实现要点 |
| --- | --- |
| `cordis_plugin_list` | `dynamicCordisRunner.listPlugins(agent)`，返回 pluginId / 版本指针 / Package / 运行状态 |
| `cordis_plugin_bundle_export` | 收集每个插件的全部 Package 源码，生成 `manifest.json` + `plugins/<pluginId>.json`，用 `fflate.zipSync` 打包写盘 |
| `cordis_plugin_bundle_import` | 读取 zip，解析 manifest 与各插件文档，按顺序重建 Package |

### Remote 服务 `cordisTransfer`

方法：

- `listPlugins(sessionId)`
- `exportBundlePayload(sessionId, pluginIds, name, description)` → `{ filename, contentType, base64 }`
- `importPayload(sessionId, filename, base64, activate)` → 导入结果

导入未激活时，Host 会发出 `cordis/dynamic-package` 事件，让浏览器
Cordis Plugin 面板刷新 inventory，新插件立即可见、可由用户手动激活。

### 导入流程

1. 校验 zip 与 `manifest.json`
2. 读取 `plugins/<pluginId>.json`
3. 对每个插件调用 `dynamicCordisRunner.define`：
   - 第一个 Package 新建 Plugin（保留 `idPrefix` 语义前缀）
   - 后续 Package 追加到该 Plugin
4. `activate=true` 时运行导出时的 `currentPackageId`
5. 任一插件失败，回滚本次已导入的全部插件

## Client：client.js

- 以 `window.__ModuleLoader__.load` 格式提供浏览器 bundle
- 在 `settings.plugins.tab` 注册 `id: "transfer"` 的「导入 / 导出」标签页
- 挂载 `cordisTransfer` 的严格 Remote 描述符（`ctx.remote.$mount`）
- 导出：调用 Remote 获取 base64，浏览器内创建 Blob 触发下载
- 导入：隐藏 `<input type="file" accept=".zip">` 读取文件，base64 上传给 Host

## 部署声明

- `cordis.patch.yml`：插入 loader entry `cordis-transfer-tools`
- `package.json#dsh.bundle.patch`：把 patch 作为 bundle 层应用
- `package.json#dsh.client`：声明 web 客户端与依赖注入
