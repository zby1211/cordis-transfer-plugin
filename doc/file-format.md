# Bundle File Format / 插件包格式

Exports and imports use a single zip bundle format, conventionally named `*.dsh-cordis-bundle.zip`.
导出与导入统一使用 zip 插件包，扩展名约定为 `.dsh-cordis-bundle.zip`。

## Layout / 目录结构

```
<name>.dsh-cordis-bundle.zip
├── manifest.json          # Bundle manifest / 包清单
└── plugins/
    ├── <pluginId>.json    # One document per plugin / 每个插件一个文档
    └── ...
```

## manifest.json / 包清单

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

## plugins/<pluginId>.json / 每个插件文档

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

## Rules / 规则

- `currentPackageId` / `nextPackageId` are optional and must reference a `packageId` in `packages` / `currentPackageId` / `nextPackageId` 可选，必须引用 packages 中的 `packageId`
- At least one of `code.host` / `code.client` must exist / `code.host` / `code.client` 至少存在一个
- On import, the Host mints new pluginId / packageId values and returns the old-to-new mapping / 导入时 pluginId / packageId 由 Host 重新铸造，并返回新旧映射
- Plugins with Client code enter the normal approval flow when `activate=true` / 含 Client 代码且 `activate=true` 时进入正常审批流程
