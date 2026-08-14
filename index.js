// cordis-transfer-plugin：DSH Profile Bundle（host 平面）。
// 持久化版 Cordis Plugin 导入/导出工具集：
//   cordis_plugin_list / cordis_plugin_bundle_export / cordis_plugin_bundle_import
// 导入/导出统一使用 zip 插件包：manifest.json + plugins/<pluginId>.json
// 工具在 Host 组合注册，执行时从 exec.agent.ctx 解析当前 agent 作用域里的
// dynamicCordisRunner 服务，因此支持 cordis 预设下的每个会话导入/导出其自有动态 Plugin。
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

export const name = 'cordis-transfer-plugin'
export const inject = ['tools']

function dshHome() {
  const raw = process.env.DSH_HOME?.trim()
  return raw && raw.length > 0 ? raw : join(homedir(), '.dsh')
}

// 解析锚点策略：本包可能以 tarball/软链安装到 profile 树外，
// 因此先锚到 DSH profile 的平铺 node_modules 解析 @deepseek-ai/dsh-tools。
function harnessRequire() {
  const bases = [join(dshHome(), 'profiles', 'noop.cjs')]
  if (process.argv[1]) bases.push(process.argv[1])
  bases.push(fileURLToPath(import.meta.url))
  for (const base of bases) {
    try {
      const req = createRequire(base)
      req.resolve('@deepseek-ai/dsh-tools/package.json')
      return req
    } catch { /* next anchor */ }
  }
  throw new Error('cordis-transfer-plugin: cannot locate @deepseek-ai/dsh-tools; is the plugin running inside a dsh profile?')
}

export async function apply(ctx) {
  const peerRequire = harnessRequire()
  const { defineTool } = await import(pathToFileURL(peerRequire.resolve('@deepseek-ai/dsh-tools')))

  const FORMAT_SINGLE = 'dsh-cordis-plugin'
  const FORMAT_BUNDLE = 'dsh-cordis-plugin-bundle'
  const FORMAT_VERSION = 1

  function resolveContext(exec) {
    if (exec === undefined || exec.agent === undefined) {
      throw new Error('cordis_plugin_* tools require an Agent-backed session')
    }
    const agent = exec.agent
    const runner = agent.ctx.get('dynamicCordisRunner')
    if (runner === undefined) {
      throw new Error('dynamicCordisRunner service is not available in this agent preset; the cordis_plugin_* tools require the cordis preset')
    }
    return { agent, runner }
  }

  function str(v) {
    return v === undefined || v === null ? null : String(v)
  }

  function now() {
    return new Date().toISOString()
  }

  function isRecord(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
  }

  function derivePrefix(pluginId) {
    const dash = pluginId.indexOf('-')
    if (dash < 3 || dash > 6) {
      throw new Error('pluginId "' + pluginId + '" must start with a 3-6 lowercase-letter prefix followed by "-"')
    }
    for (let i = 0; i < dash; i++) {
      const code = pluginId.charCodeAt(i)
      if (code < 97 || code > 122) {
        throw new Error('pluginId "' + pluginId + '" prefix must contain only lowercase letters a-z')
      }
    }
    return pluginId.slice(0, dash)
  }

  function requirePlugin(agent, runner, pluginId) {
    const id = String(pluginId || '')
    if (id.length === 0) throw new Error('pluginId is required')
    return runner.inspectPlugin(agent, id)
  }

  async function collectPluginRecord(agent, runner, pluginId) {
    const meta = requirePlugin(agent, runner, pluginId)
    const packages = []
    for (const pkg of meta.packages) {
      const full = runner.inspectPackage(agent, String(meta.pluginId), String(pkg.packageId))
      const code = {}
      if (full.code.host !== undefined) code.host = full.code.host
      if (full.code.client !== undefined) code.client = full.code.client
      packages.push({
        packageId: String(pkg.packageId),
        name: String(full.name),
        purpose: String(full.purpose),
        code: code
      })
    }
    const record = { pluginId: String(meta.pluginId), packages: packages }
    if (meta.currentPackageId !== undefined) record.currentPackageId = String(meta.currentPackageId)
    if (meta.nextPackageId !== undefined) record.nextPackageId = String(meta.nextPackageId)
    return record
  }

  function pluginSummary(meta) {
    return {
      pluginId: String(meta.pluginId),
      currentPackageId: meta.currentPackageId === undefined ? null : String(meta.currentPackageId),
      nextPackageId: meta.nextPackageId === undefined ? null : String(meta.nextPackageId),
      activeRun: meta.activeRun === undefined ? null : {
        pluginRunId: String(meta.activeRun.pluginRunId),
        packageId: String(meta.activeRun.packageId)
      },
      packages: (meta.packages || []).map(function (pkg) {
        return {
          packageId: String(pkg.packageId),
          name: str(pkg.name),
          purpose: str(pkg.purpose),
          hasHostHalf: pkg.hasHostHalf === true,
          hasClientHalf: pkg.hasClientHalf === true,
          isCurrent: meta.currentPackageId !== undefined && String(pkg.packageId) === String(meta.currentPackageId)
        }
      })
    }
  }

  function summarizeRun(run) {
    if (run === null || run === undefined) return null
    const summary = {
      ok: run.ok === true,
      status: typeof run.status === 'string' ? run.status : (run.ok === false ? 'failed' : 'ok'),
      pluginId: str(run.pluginId),
      packageId: str(run.packageId),
      pluginRunId: str(run.pluginRunId),
      mode: str(run.mode),
      waitingFor: Array.isArray(run.waitingFor) ? run.waitingFor.map(String) : []
    }
    if (run.ok === false) {
      summary.reason = str(run.reason)
      summary.message = str(run.message)
    }
    return summary
  }

  function validatePluginRecord(record, label) {
    if (!isRecord(record)) throw new Error(label + ' must be a plugin record object')
    if (typeof record.pluginId !== 'string' || record.pluginId.length === 0) {
      throw new Error(label + '.pluginId must be a non-empty string')
    }
    const prefix = derivePrefix(record.pluginId)
    if (!Array.isArray(record.packages) || record.packages.length === 0) {
      throw new Error(label + '.packages must be a non-empty array')
    }
    const seen = {}
    for (let i = 0; i < record.packages.length; i++) {
      const pkg = record.packages[i]
      const where = label + '.packages[' + i + ']'
      if (!isRecord(pkg)) throw new Error(where + ' must be an object')
      if (typeof pkg.packageId !== 'string' || pkg.packageId.length === 0) {
        throw new Error(where + '.packageId must be a non-empty string')
      }
      if (seen[pkg.packageId] !== undefined) {
        throw new Error(where + ' duplicates packageId "' + pkg.packageId + '"')
      }
      seen[pkg.packageId] = true
      if (typeof pkg.name !== 'string' || pkg.name.trim().length === 0) {
        throw new Error(where + '.name must be a non-empty string')
      }
      if (typeof pkg.purpose !== 'string' || pkg.purpose.trim().length === 0) {
        throw new Error(where + '.purpose must be a non-empty string')
      }
      if (!isRecord(pkg.code)) throw new Error(where + '.code must be an object')
      const hasHost = pkg.code.host !== undefined
      const hasClient = pkg.code.client !== undefined
      if (!hasHost && !hasClient) throw new Error(where + '.code needs host, client, or both')
      if (hasHost && (typeof pkg.code.host !== 'string' || pkg.code.host.length === 0)) {
        throw new Error(where + '.code.host must be a non-empty string')
      }
      if (hasClient && (typeof pkg.code.client !== 'string' || pkg.code.client.length === 0)) {
        throw new Error(where + '.code.client must be a non-empty string')
      }
    }
    if (record.currentPackageId !== undefined) {
      if (typeof record.currentPackageId !== 'string' || seen[record.currentPackageId] === undefined) {
        throw new Error(label + '.currentPackageId must reference one of the exported packages')
      }
    }
    if (record.nextPackageId !== undefined) {
      if (typeof record.nextPackageId !== 'string' || seen[record.nextPackageId] === undefined) {
        throw new Error(label + '.nextPackageId must reference one of the exported packages')
      }
    }
    return {
      pluginId: record.pluginId,
      prefix: prefix,
      packages: record.packages,
      currentPackageId: record.currentPackageId === undefined ? null : record.currentPackageId,
      nextPackageId: record.nextPackageId === undefined ? null : record.nextPackageId
    }
  }

  async function importOne(agent, runner, record, activate) {
    const valid = validatePluginRecord(record, 'plugin record')
    let pluginId = null
    const importedPackages = []
    try {
      for (let i = 0; i < valid.packages.length; i++) {
        const pkg = valid.packages[i]
        const code = {}
        if (pkg.code.host !== undefined) code.host = pkg.code.host
        if (pkg.code.client !== undefined) code.client = pkg.code.client
        const receipt = runner.define({
          sessionId: agent.id,
          plugin: i === 0
            ? { kind: 'new', idPrefix: valid.prefix }
            : { kind: 'existing', pluginId: pluginId },
          name: pkg.name,
          purpose: pkg.purpose,
          code: code
        })
        if (i === 0) pluginId = String(receipt.pluginId)
        importedPackages.push({
          sourcePackageId: String(pkg.packageId),
          packageId: String(receipt.packageId)
        })
      }
      let activation = null
      if (activate) {
        const sourceTarget = valid.currentPackageId !== null
          ? valid.currentPackageId
          : String(valid.packages[valid.packages.length - 1].packageId)
        let targetPackageId = null
        for (const entry of importedPackages) {
          if (entry.sourcePackageId === sourceTarget) targetPackageId = entry.packageId
        }
        if (targetPackageId === null) {
          throw new Error('imported plugin "' + valid.pluginId + '" has no package "' + sourceTarget + '" to activate')
        }
        const run = await runner.run(agent, pluginId, targetPackageId, 'run')
        activation = summarizeRun(run)
      } else if (importedPackages.length > 0) {
        // 只 define 不 run 时，dynamicCordisRunner 不会发 cordis/dynamic-package，
        // 浏览器 Cordis Plugin 面板的 inventory 就不会刷新。这里补发一次该事件
        // （面板只把它当作刷新信号），让导入的插件立即出现在面板里供用户激活。
        ctx.emit('cordis/dynamic-package', {
          pluginId: pluginId,
          packageId: importedPackages[0].packageId,
          pluginRunId: 'import-' + pluginId,
          name: valid.packages[0].name
        })
      }
      return {
        sourcePluginId: valid.pluginId,
        pluginId: pluginId,
        packages: importedPackages,
        activation: activation
      }
    } catch (error) {
      if (pluginId !== null) {
        try { await runner.undefine(agent, pluginId) } catch (cleanupError) { /* already gone */ }
      }
      throw error
    }
  }

  async function importBundle(agent, runner, records, activate) {
    const imported = []
    try {
      for (const record of records) {
        imported.push(await importOne(agent, runner, record, activate))
      }
      return imported
    } catch (error) {
      for (let i = imported.length - 1; i >= 0; i--) {
        try { await runner.undefine(agent, imported[i].pluginId) } catch (cleanupError) { /* already gone */ }
      }
      throw error
    }
  }

  // ── 下载/上传与 zip 插件包 ────────────────────────────────────────────────
  // GUI 不再传文件路径：导出返回文件名+内容（浏览器触发下载），
  // 导入上传文件内容（浏览器本地文件选择后 base64 传入）。
  function singleDocument(record) {
    return { format: FORMAT_SINGLE, version: FORMAT_VERSION, exportedAt: now(), plugin: record }
  }

  function singleDocumentText(record) {
    return JSON.stringify(singleDocument(record), null, 2)
  }

  function safeBundleFileName(name) {
    const base = String(name || 'cordis-plugin-bundle').trim()
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return (base.length === 0 ? 'cordis-plugin-bundle' : base) + '.dsh-cordis-bundle.zip'
  }

  function buildBundleZip(records, name, description) {
    const files = {}
    const plugins = records.map(function (record, index) {
      const file = 'plugins/' + record.pluginId + '.json'
      files[file] = strToU8(singleDocumentText(record))
      return {
        order: index,
        pluginId: record.pluginId,
        file: file,
        packageCount: record.packages.length,
        currentPackageId: record.currentPackageId === undefined ? null : record.currentPackageId,
        nextPackageId: record.nextPackageId === undefined ? null : record.nextPackageId
      }
    })
    const manifest = {
      name: name ? String(name).trim() : 'cordis-plugin-bundle',
      description: description ? String(description).trim() : '',
      pluginCount: records.length,
      plugins: plugins
    }
    files['manifest.json'] = strToU8(JSON.stringify({
      format: FORMAT_BUNDLE,
      version: FORMAT_VERSION,
      exportedAt: now(),
      manifest: manifest
    }, null, 2))
    return { zip: zipSync(files, { level: 6 }), manifest: manifest }
  }

  function parseBundleZip(bytes) {
    let entries
    try {
      entries = unzipSync(bytes)
    } catch (error) {
      throw new Error('invalid plugin bundle zip: ' + (error && error.message ? error.message : String(error)))
    }
    const manifestBytes = entries['manifest.json']
    if (manifestBytes === undefined) throw new Error('plugin bundle zip has no manifest.json')
    const doc = JSON.parse(strFromU8(manifestBytes))
    if (!isRecord(doc) || doc.format !== FORMAT_BUNDLE || doc.version !== FORMAT_VERSION) {
      throw new Error('plugin bundle zip manifest is not a ' + FORMAT_BUNDLE + ' v' + FORMAT_VERSION + ' document')
    }
    const list = doc.manifest && Array.isArray(doc.manifest.plugins) ? doc.manifest.plugins : []
    if (list.length === 0) throw new Error('plugin bundle zip manifest has no plugins')
    const records = []
    const seen = {}
    for (const entry of list) {
      if (!isRecord(entry) || typeof entry.pluginId !== 'string') throw new Error('plugin bundle zip manifest has an invalid plugin entry')
      if (seen[entry.pluginId]) throw new Error('plugin bundle zip manifest repeats pluginId "' + entry.pluginId + '"')
      seen[entry.pluginId] = true
      const file = typeof entry.file === 'string' && entry.file.length > 0 ? entry.file : ('plugins/' + entry.pluginId + '.json')
      const pluginBytes = entries[file]
      if (pluginBytes === undefined) throw new Error('plugin bundle zip is missing ' + file)
      const pluginDoc = JSON.parse(strFromU8(pluginBytes))
      if (!isRecord(pluginDoc) || pluginDoc.format !== FORMAT_SINGLE || pluginDoc.version !== FORMAT_VERSION) {
        throw new Error(file + ' is not a ' + FORMAT_SINGLE + ' v' + FORMAT_VERSION + ' document')
      }
      records.push(pluginDoc.plugin)
    }
    return records
  }

  async function importPayloadBytes(agent, runner, bytes, filename, activate) {
    const lower = String(filename || '').toLowerCase()
    const hasZipMagic = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b
    if (!hasZipMagic && !lower.endsWith('.zip')) {
      throw new Error('unsupported plugin file: expected a ' + FORMAT_BUNDLE + ' zip bundle')
    }
    const records = parseBundleZip(bytes)
    const imported = await importBundle(agent, runner, records, activate)
    return {
      format: FORMAT_BUNDLE,
      importedCount: imported.length,
      activated: imported.some(function (entry) { return entry.activation !== null }),
      imported: imported
    }
  }

  const executors = {}
  function registerTool(name, description, parameters, execute) {
    executors[name] = execute
    return ctx.tools.register(defineTool({
      name: name,
      description: description,
      parameters: parameters,
      output: {
        schema: { type: 'json' },
        render: function (_args, value) {
          return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
        }
      },
      execute: execute
    }))
  }

  // 浏览器 Settings → Plugins → “导入 / 导出” 标签页的 Client→Host Remote 服务。
  // 没有使用 typert 编译器：Host 侧靠 Remote 标记走 api-gateway 的 SRC 发现，
  // Client 侧由 client.js 自带严格描述符并通过 ctx.remote.$mount 挂载。
  function markRemoteMethod(prototype, method) {
    Remote(method)(prototype[method], {
      kind: 'method',
      name: method,
      static: false,
      private: false,
      access: { has() { return false }, get() { return undefined } },
      addInitializer(fn) { fn.call(Object.create(prototype)) }
    })
  }

  class CordisTransferRemote extends TypertRemoteService {
    constructor(ownerCtx) {
      super(ownerCtx, 'cordisTransfer')
    }

    resolveSession(sessionId) {
      const agents = this.ctx.get('agents')
      if (agents === undefined) throw new Error('agents service is unavailable')
      const agent = agents.get(sessionId)
      if (agent === undefined) throw new Error('session "' + String(sessionId) + '" has no live agent; open that session first')
      const runner = agent.ctx.get('dynamicCordisRunner')
      if (runner === undefined) throw new Error('dynamicCordisRunner service is not available in this agent preset')
      return { agent: agent, runner: runner }
    }

    listPlugins(sessionId) {
      const { agent, runner } = this.resolveSession(sessionId)
      return { plugins: runner.listPlugins(agent).map(pluginSummary) }
    }

    async exportBundlePayload(sessionId, pluginIds, name, description) {
      const { agent, runner } = this.resolveSession(sessionId)
      if (!Array.isArray(pluginIds) || pluginIds.length === 0) throw new Error('pluginIds must be a non-empty array')
      const ids = []
      const seen = {}
      for (const raw of pluginIds) {
        const id = String(raw || '')
        if (id.length === 0) throw new Error('pluginIds must contain only non-empty strings')
        if (seen[id]) throw new Error('duplicate pluginId "' + id + '" in pluginIds')
        seen[id] = true
        ids.push(id)
      }
      const records = []
      for (const id of ids) records.push(await collectPluginRecord(agent, runner, id))
      const built = buildBundleZip(records, name, description)
      return {
        filename: safeBundleFileName(name),
        contentType: 'application/zip',
        base64: Buffer.from(built.zip).toString('base64'),
        manifest: built.manifest
      }
    }

    async importPayload(sessionId, filename, base64, activate) {
      const { agent, runner } = this.resolveSession(sessionId)
      if (typeof base64 !== 'string' || base64.length === 0) throw new Error('uploaded file content is empty')
      const bytes = Buffer.from(base64, 'base64')
      const result = await importPayloadBytes(agent, runner, bytes, filename, activate)
      return { ok: true, filename: str(filename), result: result }
    }
  }
  for (const method of ['listPlugins', 'exportBundlePayload', 'importPayload']) {
    markRemoteMethod(CordisTransferRemote.prototype, method)
  }
  new CordisTransferRemote(ctx)

  registerTool('cordis_plugin_list', '列出当前会话创建的全部动态 Cordis Plugin（pluginId、版本指针、Package 列表、运行状态），供导入/导出前选择。', {}, function (_args, exec) {
    const { agent, runner } = resolveContext(exec)
    return { plugins: runner.listPlugins(agent).map(pluginSummary) }
  })

  registerTool('cordis_plugin_bundle_export', '把一个或多个动态 Cordis Plugin 连同 manifest 清单导出为 zip 插件包（manifest.json + plugins/<pluginId>.json，格式 dsh-cordis-plugin-bundle）；只选一个插件时 zip 内只含该插件。', {
    pluginIds: { type: 'array', items: { type: 'string' }, required: true, description: '要导出的一组稳定 pluginId。' },
    path: { type: 'string', required: true, description: '导出 zip 插件包文件的绝对路径。' },
    name: { type: 'string', description: '插件包清单名称；默认 cordis-plugin-bundle。' },
    description: { type: 'string', description: '插件包清单描述；可省略。' }
  }, async function (args, exec) {
    const { agent, runner } = resolveContext(exec)
    if (!Array.isArray(args.pluginIds) || args.pluginIds.length === 0) {
      throw new Error('pluginIds must be a non-empty array')
    }
    const ids = []
    const seen = {}
    for (const raw of args.pluginIds) {
      const id = String(raw || '')
      if (id.length === 0) throw new Error('pluginIds must contain only non-empty strings')
      if (seen[id] !== undefined) throw new Error('duplicate pluginId "' + id + '" in pluginIds')
      seen[id] = true
      ids.push(id)
    }
    const records = []
    for (const id of ids) {
      records.push(await collectPluginRecord(agent, runner, id))
    }
    const built = buildBundleZip(records, args.name, args.description)
    writeFileSync(String(args.path), built.zip)
    return {
      ok: true,
      format: FORMAT_BUNDLE,
      path: String(args.path),
      bytes: built.zip.length,
      manifest: built.manifest
    }
  })

  registerTool('cordis_plugin_bundle_import', '从 zip 插件包（manifest.json + plugins/*.json）导入全部 Cordis Plugin；activate=true 时激活各 Plugin 的 current 版本（含 Client 代码时可能进入审批）。任一 Plugin 导入失败会回滚本次已导入的 Plugin。', {
    path: { type: 'string', required: true, description: '要导入的 zip 插件包文件绝对路径。' },
    activate: { type: 'boolean', description: '导入后是否立即运行各 Plugin 的 current 版本；默认 false（只建立定义）。' }
  }, async function (args, exec) {
    const { agent, runner } = resolveContext(exec)
    const bytes = readFileSync(String(args.path))
    const result = await importPayloadBytes(agent, runner, bytes, String(args.path), args.activate === true)
    return { ok: true, path: String(args.path), result: result }
  })
}
