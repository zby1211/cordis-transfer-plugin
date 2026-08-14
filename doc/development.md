# 构建与验证

## 从源码构建

```bash
npm pack --pack-destination ./dist --cache ./npm-cache
```

产物：`dist/cordis-transfer-plugin-<version>.tgz`

## 安装

```bash
dsh plugin --profile web add /path/to/cordis-transfer-plugin-<version>.tgz
```

`$DSH_HOME/profiles/web/package.json` 需要满足：

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

## 验证

```bash
dsh --profile web --dump-config | grep -A2 cordis-transfer
```

启动后浏览器 boot graph 中应出现：

```text
/plugins/cordis-transfer-plugin/client.js?rev=...
```

## 发布

1. 提交并推送 `main`
2. 创建 tag 与 GitHub Release
3. 上传 `dist/cordis-transfer-plugin-<version>.tgz` 作为资产
