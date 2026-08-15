# Bundle File Format

Exports and imports use a single zip bundle format, conventionally named `*.dsh-cordis-bundle.zip`.

导出与导入统一使用 zip 插件包，扩展名约定为 `.dsh-cordis-bundle.zip`。

## Layout

```
<name>.dsh-cordis-bundle.zip
├── manifest.json
└── plugins/
    ├── <pluginId>.json
    └── ...
```

`manifest.json` is the bundle manifest.

`manifest.json` 是包清单。

`plugins/<pluginId>.json` contains one document per plugin.

`plugins/<pluginId>.json` 每个插件一个文档。

## manifest.json

```json
{
  "format": "dsh-cordis-plugin-bundle",
  "version": 1,
  "exportedAt": "2026-08-14T00:00:00.000Z",
  "manifest": {
    "name": "my-bundle",
    "description": "optional",
    "pluginCount": 1,
    "plugins": [
      {
        "order": 0,
        "pluginId": "demo-1",
        "file": "plugins/demo-1.json",
        "packageCount": 1,
        "currentPackageId": "pkg-1",
        "nextPackageId": null
      }
    ]
  }
}
```

## plugins/<pluginId>.json

```json
{
  "format": "dsh-cordis-plugin",
  "version": 1,
  "exportedAt": "2026-08-14T00:00:00.000Z",
  "plugin": {
    "pluginId": "demo-1",
    "packages": [
      {
        "packageId": "pkg-1",
        "name": "demo-greeting-tool",
        "purpose": "a demo plugin",
        "code": {
          "host": "return { apply(ctx) { ... } }",
          "client": "optional client code"
        }
      }
    ],
    "currentPackageId": "pkg-1",
    "nextPackageId": null
  }
}
```

## Rules

- `currentPackageId` and `nextPackageId` are optional and must reference a `packageId` in `packages`.

  `currentPackageId` 与 `nextPackageId` 可选，必须引用 packages 中的 `packageId`。

- At least one of `code.host` and `code.client` must exist.

  `code.host` 与 `code.client` 至少存在一个。

- On import, the Host mints new pluginId and packageId values and returns the old-to-new mapping.

  导入时 pluginId 与 packageId 由 Host 重新铸造，并返回新旧映射。

- Plugins with Client code enter the normal approval flow when `activate=true`.

  含 Client 代码且 `activate=true` 时进入正常审批流程。

## Import Limits

Import rejects a bundle that exceeds any of these limits (all generously above
realistic bundles; the guards exist to stop zip-bomb style memory exhaustion):

| Limit | Value |
| --- | --- |
| Zip file size (input) | 64 MiB |
| Declared size of one entry | 64 MiB |
| Total declared size of all entries | 256 MiB |
| Entry count | 4096 |

## 导入限制

超过以下任一上限的插件包会被拒绝导入（上限远高于真实插件包规模，仅用于阻止
zip bomb 式内存耗尽攻击）：

| 限制 | 上限 |
| --- | --- |
| zip 文件大小（输入） | 64 MiB |
| 单个条目的声明大小 | 64 MiB |
| 全部条目的声明总大小 | 256 MiB |
| 条目数 | 4096 |
