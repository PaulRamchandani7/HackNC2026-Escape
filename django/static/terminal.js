const data = JSON.parse(document.getElementById("terminal-data").textContent)
const draftKey = `adrift.draft.${data.slug}`
const started = Date.now()
const clock = document.getElementById("elapsed")
const hintButton = document.getElementById("hint-button")
const hintList = document.getElementById("hints")
const errorLine = document.getElementById("terminal-error")
const messageLine = document.getElementById("terminal-message")
const executorNote = document.getElementById("executor-note")
const resultsBox = document.getElementById("results")
const outputsBox = document.getElementById("outputs")
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
  errorLine.hidden = !text
  errorLine.textContent = text || ""
}

function showMessage(text) {
  if (!messageLine) return
  messageLine.hidden = !text
  messageLine.textContent = text || ""
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

function renderResults(body, kind) {
  showError("")
  if (executorNote) {
    executorNote.hidden = !body.pistonNote && !body.executor
    executorNote.textContent = body.pistonNote || (body.executor ? `Executed by ${body.executor}` : "")
  }
  if (kind === "run") {
    showMessage(
      body.passedAll
        ? "Sample diagnostics passed. Submit to run the sealed tests."
        : body.error || "Sample diagnostics failed.",
    )
  } else if (body.passedAll) {
    showMessage(body.success || "Hidden diagnostics passed.")
  } else {
    showMessage(body.error || "Hidden diagnostics failed. The door stays sealed.")
  }
  if (resultsBox) {
    resultsBox.replaceChildren()
    for (const result of body.results || []) {
      const row = document.createElement("div")
      row.className = result.passed ? "result" : "result is-fail"
      const title = document.createElement("strong")
      title.textContent = result.passed ? "PASS" : "FAIL"
      row.append(title, ` ${result.label}`)
      if (result.error) {
        const fault = document.createElement("div")
        fault.className = "fault"
        fault.textContent = result.error
        row.append(fault)
      } else if (!result.passed) {
        const detail = document.createElement("div")
        detail.className = "detail"
        const expected =
          result.expected !== undefined
            ? ` · expected ${JSON.stringify(result.expected)}`
            : " · the sealed expected value stays on the server"
        detail.textContent = `got ${JSON.stringify(result.got)}${expected}`
        row.append(detail)
      }
      resultsBox.append(row)
    }
  }
  if (outputsBox) {
    outputsBox.replaceChildren()
    for (const [label, text, danger] of [
      ["stdout", body.stdout, false],
      ["stderr", body.stderr, true],
    ]) {
      if (!text) continue
      const block = document.createElement("pre")
      block.className = danger ? "program-output is-danger" : "program-output"
      const name = document.createElement("span")
      name.textContent = label
      block.append(name, text)
      outputsBox.append(block)
    }
  }
}

async function judge(kind, button, idleLabel, busyLabel) {
  if (!editor) {
    showError("Terminal offline")
    return
  }
  button.disabled = true
  button.textContent = busyLabel
  showError("")
  try {
    const response = await fetch(`/room/${data.room}/${kind}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": data.csrfToken,
      },
      body: JSON.stringify({ code: editor.getValue() }),
    })
    const body = await response.json()
    if (!response.ok || body.ok === false) {
      showMessage("")
      showError(body.error || (kind === "run" ? "Run failed" : "Submit failed"))
      if (executorNote) executorNote.hidden = true
      return
    }
    renderResults(body, kind)
  } catch (err) {
    showError(err instanceof Error ? err.message : kind === "run" ? "Run failed" : "Submit failed")
  } finally {
    button.disabled = false
    button.textContent = idleLabel
  }
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
    judge("run", runButton, "Run Code", "Running samples…")
  })
}

const submitButton = document.getElementById("submit-code")
if (submitButton) {
  submitButton.addEventListener("click", () => {
    judge("submit", submitButton, "Submit Solution", "Checking sealed tests…")
  })
}

if (!data.locked) bootEditor()
