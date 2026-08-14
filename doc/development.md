# Build and Verification

## Build from Source

```bash
npm pack --pack-destination ./dist --cache ./npm-cache
```

Output: `dist/cordis-transfer-plugin-<version>.tgz`

产物：`dist/cordis-transfer-plugin-<version>.tgz`

## Install

```bash
dsh plugin --profile web add /path/to/cordis-transfer-plugin-<version>.tgz
```

`$DSH_HOME/profiles/web/package.json` must contain:

`$DSH_HOME/profiles/web/package.json` 需要包含：

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

## Verify

```bash
dsh --profile web --dump-config | grep -A2 cordis-transfer
```

The browser boot graph should contain:

浏览器 boot graph 中应出现：

```text
/plugins/cordis-transfer-plugin/client.js?rev=...
```

