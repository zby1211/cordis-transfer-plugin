# cordis-transfer-plugin

A persistent DSH plugin for importing and exporting dynamic Cordis Plugins.
It provides two interfaces: model tools (callable by the agent) and a browser
Settings panel for download/upload workflows.

> 中文说明见 [README_CN.md](README_CN.md)。

## Browser panel (v0.1.0)

After restarting `dsh web`, open **Settings → Plugins → Import / Export**
(tab id `transfer`):

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

## Installation (download and install)

This is a static profile bundle (not an in-memory dynamic plugin). Install the
tarball from GitHub Releases:

1. Download the latest `cordis-transfer-plugin-<version>.tgz` from Releases.
2. Install it into the web profile:
   ```bash
   dsh plugin --profile web add /path/to/cordis-transfer-plugin-<version>.tgz
   ```
3. Make sure the profile registers the bundle in
   `$DSH_HOME/profiles/web/package.json`:
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
4. Restart `dsh web` and open **Settings → Plugins → Import / Export**.

## Documentation

- [Code structure and implementation](doc/architecture.md)
- [Bundle file format](doc/file-format.md)
- [Build and verification](doc/development.md)
