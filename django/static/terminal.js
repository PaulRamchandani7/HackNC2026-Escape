const data = JSON.parse(document.getElementById("terminal-data").textContent)
const draftKey = `adrift.draft.${data.slug}`
const started = Date.now()
const clock = document.getElementById("elapsed")
const hintButton = document.getElementById("hint-button")
const hintList = document.getElementById("hints")
const errorLine = document.getElementById("terminal-error")
let hintsShown = 0
let editor = null

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const face = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  return hours > 0 ? `${hours}:${face}` : face
}

function showError(text) {
  if (!errorLine) return
  errorLine.hidden = false
  errorLine.textContent = text
}

window.setInterval(() => {
  const elapsed = Date.now() - started
  clock.textContent = formatDuration(elapsed)
  clock.dateTime = `PT${Math.floor(elapsed / 1000)}S`
}, 1000)

hintButton.addEventListener("click", async () => {
  if (hintsShown >= data.hintCount) return
  hintButton.disabled = true
  try {
    const response = await fetch(`/room/${data.room}/hint/?index=${hintsShown}`)
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || "Hint failed")
    const line = document.createElement("p")
    line.className = "hint"
    line.textContent = `Hint ${hintsShown + 1}: ${body.hint}`
    hintList.append(line)
    hintsShown += 1
    hintButton.textContent = `Hint ${Math.min(hintsShown + 1, data.hintCount)} of ${data.hintCount}`
  } catch (err) {
    showError(err instanceof Error ? err.message : "Hint failed")
  } finally {
    hintButton.disabled = hintsShown >= data.hintCount
  }
})

function bootEditor() {
  const mount = document.getElementById("code-editor")
  if (!mount || !window.require) {
    showError("Terminal offline")
    return
  }
  window.require.config({
    paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" },
  })
  window.require(["vs/editor/editor.main"], () => {
    const monaco = window.monaco
    monaco.editor.defineTheme("adrift", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "4FD1E8" },
        { token: "string", foreground: "F4B860" },
        { token: "comment", foreground: "6d8294" },
      ],
      colors: {
        "editor.background": "#0b1622",
        "editorLineNumber.foreground": "#6d8294",
      },
    })
    const draft = localStorage.getItem(draftKey)
    editor = monaco.editor.create(mount, {
      value: draft || data.starterCode,
      language: "python",
      theme: "adrift",
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: "JetBrains Mono, ui-monospace, monospace",
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 4,
    })
    editor.onDidChangeModelContent(() => {
      localStorage.setItem(draftKey, editor.getValue())
    })
  })
}

const resetButton = document.getElementById("reset-code")
if (resetButton) {
  resetButton.addEventListener("click", () => {
    localStorage.removeItem(draftKey)
    if (editor) editor.setValue(data.starterCode)
  })
}

const runButton = document.getElementById("run-code")
if (runButton) {
  runButton.addEventListener("click", () => {
    showError("Sample diagnostics are not connected on this page yet.")
  })
}

const submitButton = document.getElementById("submit-code")
if (submitButton) {
  submitButton.addEventListener("click", () => {
    showError("Sealed tests are not connected on this page yet.")
  })
}

if (!data.locked) bootEditor()
