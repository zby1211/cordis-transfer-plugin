# cordis-transfer-plugin

A persistent DSH plugin for importing and exporting dynamic Cordis Plugins.
It provides two interfaces: model tools (callable by the agent) and a browser
Settings panel for download/upload workflows.

> 中文说明见 [README.zh-CN.md](README.zh-CN.md)。

## Browser panel

Open **Settings → Plugins → Import / Export**:

- List the current session's dynamic plugins (multi-select)
- **Export bundle**: select one or more plugins (optional manifest name/description)
  and download a `.dsh-cordis-bundle.zip`; selecting a single plugin produces a
  zip containing only that plugin
- **Import bundle**: pick a local `.zip` file, upload it to the Host, and import;
  imported plugins appear in the **Cordis Plugin** panel and can be activated there

## Model tools

| Tool | Purpose |
| --- | --- |
| `cordis_plugin_list` | List all dynamic Cordis Plugins in the current session |
| `cordis_plugin_bundle_export` | Export one or more plugins as a zip bundle file |
| `cordis_plugin_bundle_import` | Import plugins from a zip bundle |

## Installation

This is a static profile bundle (not an in-memory dynamic plugin).

**From npm (recommended):**

```bash
dsh plugin --profile web add cordis-transfer-plugin
```

`dsh plugin add` installs the package and, because this package declares
`dsh.bundle.patch`, automatically appends it to `dsh.profile.bundles`.
Restart `dsh web` after installation.

For a plain Node project, you can also run:

```bash
npm install cordis-transfer-plugin
```

**From a tarball (GitHub Releases or local build):**

Get the tarball first:

- GitHub Releases: download `cordis-transfer-plugin-<version>.tgz`, or
- Local build:
  ```bash
  npm pack cordis-transfer-plugin
  ```

Then install it into the web profile:

```bash
dsh plugin --profile web add /path/to/cordis-transfer-plugin-<version>.tgz
```

Restart `dsh web` after installation.

## Documentation

- [Code structure and implementation](docs/architecture.md)
- [Bundle file format](docs/file-format.md)
- [Build and verification](docs/development.md)
