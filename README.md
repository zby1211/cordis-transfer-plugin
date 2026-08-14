# cordis-transfer-plugin

DSH 持久化插件：导入/导出本会话创建的动态 Cordis Plugin。
两种界面：模型工具（agent 可调用）+ 浏览器设置面板（人可直接操作，浏览器下载/上传）。

## 浏览器面板（v1.2.1）

DSH Web 重启后：**Settings → Plugins → 「导入 / 导出」** 标签页（tab id `transfer`）：

- 列出当前活动会话的动态插件（可多选）
- **导出插件包**：勾选 1 个或多个插件（可填清单名称/描述）→ 浏览器直接下载 `.dsh-cordis-bundle.zip`；只勾选 1 个时 zip 内只含该插件
- **导入插件**：本地文件选择框（`.zip`，兼容旧 `.json`）→ 上传到 Host 自动识别并导入
- 导入（未激活）后 Host 会补发刷新事件，插件会立即出现在底部 **Cordis Plugin** 面板中供用户手动激活
- 不再需要填写任何文件路径

Client half 通过包私有 Remote（namespace `cordisTransfer`）调用 Host：
`listPlugins` / `exportBundlePayload` / `importPayload`。
Host 侧以 `Remote` 标记走 api-gateway 的 SRC 发现，Client 侧在 `client.js`
中自挂载严格描述符（`ctx.remote.$mount`），无需重建 `dsh-api-remotes`
或运行 typert 编译器。

## 模型工具

| 工具 | 作用 |
| --- | --- |
| `cordis_plugin_list` | 列出当前会话的全部动态 Cordis Plugin |
| `cordis_plugin_import` | 从旧版单 Plugin JSON 文件导入（保留兼容） |
| `cordis_plugin_bundle_export` | 1 个或多个 Plugin 导出为 **zip** 插件包文件 |
| `cordis_plugin_bundle_import` | 从 zip 插件包导入（兼容旧单 JSON bundle） |

## 文件格式

- 单 Plugin（JSON）：`{ format: "dsh-cordis-plugin", version: 1, exportedAt, plugin: { pluginId, packages[], currentPackageId?, nextPackageId? } }`
- 插件包（**zip**）：压缩包内含
  - `manifest.json`：`{ format: "dsh-cordis-plugin-bundle", version: 1, exportedAt, manifest: { name, description, pluginCount, plugins[{order, pluginId, file, packageCount, currentPackageId, nextPackageId}] } }`
  - `plugins/<pluginId>.json`：每个插件一个单 Plugin 文档

导入时 pluginId/packageId 由 Host 重新铸造（保持 `idPrefix` 语义前缀），返回新旧映射；
含 Client 代码的 `activate=true` 会进入正常审批流程。

## 持久化与部署

本插件是静态 profile bundle（非内存动态插件），以 **tarball 独立包**方式安装进 web profile：

- 源码（打包源）：本仓库根目录 `cordis-transfer-plugin/`
- 发布物：`cordis-transfer-plugin/dist/cordis-transfer-plugin-1.2.1.tgz`
- profile 依赖：`$DSH_HOME/profiles/web/package.json`
  ```json
  "cordis-transfer-plugin": "file:<workspace>/cordis-transfer-plugin/dist/cordis-transfer-plugin-1.2.1.tgz"
  ```
- 注册点：同文件 `dsh.profile.bundles` 中的 `"cordis-transfer-plugin"`
- 安装物：`$DSH_HOME/profiles/web/node_modules/cordis-transfer-plugin/`（从 tarball 解包的真实副本，不是工作区软链）

重新打包并升级（改源码后）：

```bash
cd cordis-transfer-plugin
npm pack --pack-destination ./dist --cache ./npm-cache
dsh plugin --profile web add file:$PWD/dist/cordis-transfer-plugin-1.2.1.tgz
```

验证组合树与 client bundle：

```bash
dsh --profile web --dump-config | grep -A2 cordis-transfer
# 启动后浏览器 boot graph 中应出现：
# /plugins/cordis-transfer-plugin/client.js?rev=...
```

