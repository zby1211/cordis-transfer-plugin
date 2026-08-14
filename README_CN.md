# cordis-transfer-plugin

DSH 持久化插件：导入/导出本会话创建的动态 Cordis Plugin。
两种界面：模型工具（agent 可调用）+ 浏览器设置面板（人可直接操作，浏览器下载/上传）。

## 浏览器面板（v0.1.0）

DSH Web 重启后：**Settings → Plugins → 「导入 / 导出」** 标签页（tab id `transfer`）：

- 列出当前活动会话的动态插件（可多选）
- **导出插件包**：勾选 1 个或多个插件（可填清单名称/描述）→ 浏览器直接下载 `.dsh-cordis-bundle.zip`；只勾选 1 个时 zip 内只含该插件
- **导入插件**：本地文件选择框（`.zip`）→ 上传到 Host 自动导入；导入后插件会出现在 **Cordis Plugin** 面板中，可手动激活

## 模型工具

| 工具 | 作用 |
| --- | --- |
| `cordis_plugin_list` | 列出当前会话的全部动态 Cordis Plugin |
| `cordis_plugin_bundle_export` | 1 个或多个 Plugin 导出为 **zip** 插件包文件 |
| `cordis_plugin_bundle_import` | 从 zip 插件包导入 |

## 安装（下载并安装）

本插件是静态 profile bundle（非内存动态插件），通过 GitHub Release 的 tarball 安装：

1. 打开 Releases 页面，下载最新版 `cordis-transfer-plugin-<version>.tgz`
2. 安装进 web profile：
   ```bash
   dsh plugin --profile web add /path/to/cordis-transfer-plugin-<version>.tgz
   ```
3. 确保 profile 注册了该 bundle：`$DSH_HOME/profiles/web/package.json`
   ```json
   {
     "dsh": {
       "profile": {
         "bundles": ["...", "cordis-transfer-plugin"]
       }
     },
     "dependencies": {
       "cordis-transfer-plugin": "file:<path>/cordis-transfer-plugin-<version>.tgz"
     }
   }
   ```
4. 重启 `dsh web`，打开 **Settings → Plugins → 导入 / 导出** 使用。

## 文档

- [代码结构与实现](doc/architecture.md)
- [插件包格式](doc/file-format.md)
- [构建与验证](doc/development.md)
