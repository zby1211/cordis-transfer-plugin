# 插件包格式

导出与导入统一使用 zip 插件包，扩展名约定为 `.dsh-cordis-bundle.zip`。

## 目录结构

```
<name>.dsh-cordis-bundle.zip
├── manifest.json          # 包清单
└── plugins/
    ├── <pluginId>.json    # 每个插件一个文档
    └── ...
```

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

每个插件文档：

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

## 规则

- `currentPackageId` / `nextPackageId` 可选，引用必须是 packages 中的 `packageId`
- `code.host` / `code.client` 至少存在一个
- 导入时 pluginId / packageId 由 Host 重新铸造，并返回新旧映射
- 含 Client 代码且 `activate=true` 时进入正常审批流程
