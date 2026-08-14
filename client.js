window.__ModuleLoader__.load({
  id: "cordis-transfer-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let React = require("react");

    // 严格描述符：client api 只要求 codec.mode === "strict" 且 schema.parse 可调用；
    // Host 侧由 api-gateway 的 SRC 发现解析真实服务，因此这里用恒等解析即可。
    function identity(value) { return value }
    const CODEC = { mode: "strict", typeSymbol: "cordis-transfer-plugin/json", schema: { parse: identity } }
    function parameter(name) {
      return { name: name, wire: name, source: "json", codec: CODEC }
    }
    function descriptor(method, names) {
      return {
        id: "cordis-transfer-plugin#cordisTransfer/" + method,
        service: "cordisTransfer",
        namespace: "cordisTransfer",
        method: method,
        invocation: { kind: "direct" },
        parameters: names.map(parameter),
        result: { mode: "strict", typeSymbol: "cordis-transfer-plugin/json", schema: { parse: identity } },
        sourceLocation: { file: "cordis-transfer-plugin/client.js", line: 1, column: 1 }
      }
    }
    const CONTRIBUTION = {
      package: "cordis-transfer-plugin",
      descriptors: [
        descriptor("listPlugins", ["sessionId"]),
        descriptor("exportBundlePayload", ["sessionId", "pluginIds", "name", "description"]),
        descriptor("importPayload", ["sessionId", "filename", "base64", "activate"])
      ]
    };

    const S = {
      section: { display: "flex", flexDirection: "column", gap: 18, maxWidth: 760, width: "100%" },
      card: { display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 10, padding: 14, background: "var(--dsw-alias-bg-layer-3)" },
      title: { margin: 0, fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
      hint: { margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-tertiary)" },
      row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
      input: { flex: "1 1 260px", minWidth: 0, height: 32, padding: "0 10px", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: 13 },
      check: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--dsw-alias-label-secondary)" },
      button: { height: 32, padding: "0 14px", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: 13, cursor: "pointer" },
      mono: { margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "var(--ds-font-family-code)", fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-primary)", background: "var(--dsw-alias-bg-module-platform)", borderRadius: 8, padding: 10 },
      muted: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)" },
      error: { fontSize: 12, color: "var(--dsw-alias-state-error-primary)" },
      hidden: { display: "none" }
    }

    function downloadBase64(filename, base64, contentType) {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: contentType || "application/octet-stream" })
      triggerDownload(filename, blob)
    }

    function triggerDownload(filename, blob) {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    function arrayBufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer)
      let binary = ""
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
      }
      return btoa(binary)
    }

    function TransferPanel(props) {
      const useSessions = props.useSessions
      const session = useSessions((state) => state.phase === "ready" ? { ready: true, current: state.current } : { ready: false, current: null })
      const [plugins, setPlugins] = React.useState([])
      const [listStatus, setListStatus] = React.useState("idle")
      const [listError, setListError] = React.useState("")
      const [selected, setSelected] = React.useState({})
      const [bundleName, setBundleName] = React.useState("")
      const [bundleDescription, setBundleDescription] = React.useState("")
      const [activate, setActivate] = React.useState(false)
      const [message, setMessage] = React.useState("")
      const [busy, setBusy] = React.useState("")
      const fileInputRef = React.useRef(null)

      function api() {
        const service = props.ctx.get("remote.cordisTransfer")
        if (service === undefined) throw new Error("remote.cordisTransfer namespace is not mounted")
        return service
      }

      async function invoke(method, args) {
        const result = await api()[method].apply(api(), args)
        if (result === null || result === undefined || result.ok !== true) {
          const detail = result && result.error ? result.error.message : "remote call failed"
          throw new Error(String(detail))
        }
        return result.value
      }

      function refresh() {
        if (!session.ready || session.current === null) return
        setListStatus("loading")
        setListError("")
        invoke("listPlugins", [session.current]).then((value) => {
          setPlugins(Array.isArray(value && value.plugins) ? value.plugins : [])
          setListStatus("ready")
        }, (error) => {
          setListStatus("error")
          setListError(error && error.message ? error.message : String(error))
        })
      }

      React.useEffect(() => {
        if (!session.ready || session.current === null) {
          setPlugins([])
          setListStatus("idle")
          return
        }
        refresh()
      }, [session.ready, session.current])

      function runDownload(label, action, consume) {
        setBusy(label)
        setMessage("")
        Promise.resolve().then(action).then((value) => {
          consume(value)
          setMessage("已开始下载 " + value.filename + "。")
        }, (error) => {
          setMessage("Error: " + (error && error.message ? error.message : String(error)))
        }).finally(() => setBusy(""))
      }

      function pickFileAndImport() {
        if (fileInputRef.current === null) return
        fileInputRef.current.click()
      }

      function handleFile(event) {
        const file = event.target.files && event.target.files[0]
        event.target.value = ""
        if (!file) return
        if (!session.ready || session.current === null) return
        setBusy("导入")
        setMessage("正在读取并上传 " + file.name + " …")
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = arrayBufferToBase64(reader.result)
          invoke("importPayload", [session.current, file.name, base64, activate]).then((value) => {
            setMessage(JSON.stringify(value, null, 2))
            refresh()
          }, (error) => {
            setMessage("Error: " + (error && error.message ? error.message : String(error)))
          }).finally(() => setBusy(""))
        }
        reader.onerror = () => {
          setBusy("")
          setMessage("Error: 文件读取失败。")
        }
        reader.readAsArrayBuffer(file)
      }

      function button(label, disabled, onClick) {
        return React.createElement("button", { type: "button", style: S.button, disabled: disabled || busy !== "", onClick: onClick }, label)
      }

      function input(value, onChange, placeholder) {
        return React.createElement("input", { style: S.input, value: value, placeholder: placeholder || "", onChange: (event) => onChange(event.target.value) })
      }

      if (!session.ready || session.current === null) {
        return React.createElement("div", { style: S.section },
          React.createElement("p", { style: S.hint }, "没有活动会话。请先打开一个会话，再使用导入 / 导出。"))
      }

      const pluginIds = plugins.map((plugin) => String(plugin.pluginId || ""))
      const selectedIds = pluginIds.filter((id) => selected[id] === true)

      return React.createElement("div", { style: S.section },
        React.createElement("section", { style: S.card },
          React.createElement("h3", { style: S.title }, "本会话动态插件"),
          React.createElement("p", { style: S.hint }, "列出当前会话用 cordis_define 创建的动态 Cordis Plugin。勾选后可直接下载插件包。"),
          React.createElement("div", { style: S.row },
            button(listStatus === "loading" ? "读取中…" : "刷新", listStatus === "loading", refresh)
          ),
          listStatus === "error" ? React.createElement("p", { style: S.error }, listError) : null,
          plugins.length === 0 && listStatus === "ready"
            ? React.createElement("p", { style: S.hint }, "暂无动态插件。")
            : plugins.map(function (plugin) {
                return React.createElement("label", { key: plugin.pluginId, style: S.check },
                  React.createElement("input", { type: "checkbox", checked: selected[plugin.pluginId] === true, onChange: (event) => setSelected((previous) => Object.assign({}, previous, { [plugin.pluginId]: event.target.checked })) }),
                  React.createElement("strong", null, String(plugin.pluginId)),
                  React.createElement("span", { style: S.muted }, "当前版本 " + String(plugin.currentPackageId || "—") + " · " + String((plugin.packages || []).length) + " 个 Package"))
              }),
          React.createElement("div", { style: S.row },
            button("全选", plugins.length === 0, () => {
              const next = {}
              for (const id of pluginIds) next[id] = true
              setSelected(next)
            }),
            button("清空选择", selectedIds.length === 0, () => setSelected({})))
        ),

        React.createElement("section", { style: S.card },
          React.createElement("h3", { style: S.title }, "导入插件（本地文件上传）"),
          React.createElement("p", { style: S.hint }, "选择 zip 插件包后自动上传导入。" ),
          React.createElement("input", { ref: fileInputRef, type: "file", accept: ".zip,application/zip", style: S.hidden, onChange: handleFile }),
          React.createElement("div", { style: S.row },
            React.createElement("label", { style: S.check },
              React.createElement("input", { type: "checkbox", checked: activate, onChange: (event) => setActivate(event.target.checked) }),
              React.createElement("span", null, "导入后立即激活 current 版本")),
            button("选择文件并导入", false, pickFileAndImport))
        ),

        React.createElement("section", { style: S.card },
          React.createElement("h3", { style: S.title }, "导出插件包 zip（浏览器下载）"),
          React.createElement("p", { style: S.hint }, "已选 " + String(selectedIds.length) + " 个插件；勾选 1 个插件时 zip 内只含该插件。zip 内含 manifest.json 与 plugins/<pluginId>.json。" ),
          React.createElement("div", { style: S.row },
            input(bundleName, setBundleName, "清单名称（可选）"),
            input(bundleDescription, setBundleDescription, "清单描述（可选）")),
          React.createElement("div", { style: S.row },
            button("导出插件包并下载", selectedIds.length === 0, () => runDownload("导出插件包", () => invoke("exportBundlePayload", [session.current, selectedIds, bundleName.trim() || null, bundleDescription.trim() || null]), (value) => downloadBase64(value.filename, value.base64, value.contentType))))
        ),

        message ? React.createElement("pre", { style: S.mono }, message) : null
      )
    }

    const inject = ["slots", "remote"]

    async function apply(ctx) {
      const disposeRemote = await ctx.remote.$mount(CONTRIBUTION)
      ctx.effect(() => disposeRemote, "cordis-transfer-plugin: remote contribution")
      ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
        name: "settings.plugins.tab",
        id: "transfer",
        order: 20,
        label: "导入 / 导出"
      }, (props) => React.createElement(TransferPanel, Object.assign({}, props, { ctx: ctx }))))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
