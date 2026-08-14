# Build and Verification / 构建与验证

## Build from Source / 从源码构建

```bash
npm pack --pack-destination ./dist --cache ./npm-cache
```

Output: `dist/cordis-transfer-plugin-<version>.tgz` / 产物：`dist/cordis-transfer-plugin-<version>.tgz`

## Install / 安装

```bash
dsh plugin --profile web add /path/to/cordis-transfer-plugin-<version>.tgz
```

`$DSH_HOME/profiles/web/package.json` must contain / `$DSH_HOME/profiles/web/package.json` 需要包含：

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

## Verify / 验证

```bash
dsh --profile web --dump-config | grep -A2 cordis-transfer
```

The browser boot graph should contain / 浏览器 boot graph 中应出现：

```text
/plugins/cordis-transfer-plugin/client.js?rev=...
```

## Release / 发布

1. Commit and push `main` / 提交并推送 `main`
2. Create a tag and a GitHub Release / 创建 tag 与 GitHub Release
3. Upload `dist/cordis-transfer-plugin-<version>.tgz` as the asset / 上传 `dist/cordis-transfer-plugin-<version>.tgz` 作为资产
