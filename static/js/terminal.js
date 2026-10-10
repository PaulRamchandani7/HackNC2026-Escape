const roomNum = Number(window.ROOM_NUMBER || 1);
const voyageLabel = document.getElementById("voyage-label");
const voyageTimer = document.getElementById("voyage-timer");
const title = document.getElementById("title");
const roomName = document.getElementById("room-name");
const difficulty = document.getElementById("difficulty");
const leetcode = document.getElementById("leetcode");
const story = document.getElementById("story");
const statement = document.getElementById("statement");
const samples = document.getElementById("samples");
const hintBtn = document.getElementById("hint-btn");
const hintList = document.getElementById("hint-list");
const message = document.getElementById("message");
const error = document.getElementById("error");
const executor = document.getElementById("executor");
const results = document.getElementById("results");
const transition = document.getElementById("transition");
const runBtn = document.getElementById("run");
const submitBtn = document.getElementById("submit");
const resetBtn = document.getElementById("reset");

let mission = null;
let challenge = null;
let editor = null;
let hints = [];
let now = Date.now();

setInterval(() => {
  now = Date.now();
  if (!mission) return;
  voyageTimer.textContent = playerStore.formatDuration(Math.max(0, now - mission.started_at));
}, 1000);

function showResults(rows) {
  results.innerHTML = (rows || [])
    .map((row) => {
      const detail = row.error
        ? row.error
        : `got=${JSON.stringify(row.got)}${row.expected !== undefined ? ` expected=${JSON.stringify(row.expected)}` : ""}`;
      return `<div class="result ${row.passed ? "pass" : "fail"}">${row.label}: ${row.passed ? "pass" : "fail"} — ${detail}</div>`;
    })
    .join("");
}

function renderBrief() {
  if (!challenge || !mission) return;
  roomName.textContent = challenge.name;
  title.textContent = challenge.title;
  difficulty.innerHTML = `<span class="badge ${challenge.difficulty.toLowerCase()}">${challenge.difficulty}</span>`;
  leetcode.href = challenge.leetcodeUrl;
  story.textContent = challenge.story || "";
  statement.textContent = challenge.statement || "";
  samples.innerHTML = (challenge.sampleTests || [])
    .map(
      (test) =>
        `<div class="sample"><strong>${test.label}</strong><br />args=${JSON.stringify(test.args)}<br />expected=${JSON.stringify(test.expected)}</div>`,
    )
    .join("");
  voyageLabel.textContent = challenge.chapter;
  hintList.innerHTML = hints.map((hint) => `<li>${hint}</li>`).join("");
  const locked = !mission.unlockedRooms.includes(challenge.room);
  runBtn.disabled = locked;
  submitBtn.disabled = locked;
  if (locked) message.textContent = "This compartment is still sealed.";
}

function bootEditor(code) {
  require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" } });
  require(["vs/editor/editor.main"], () => {
    editor = monaco.editor.create(document.getElementById("editor"), {
      value: code,
      language: "python",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: "JetBrains Mono, ui-monospace, monospace",
      fontSize: 14,
    });
    editor.onDidChangeModelContent(() => {
      if (!challenge) return;
      localStorage.setItem(playerStore.draftKey(challenge.id), editor.getValue());
    });
  });
}

async function load() {
  const player = playerStore.loadPlayer();
  const missionId = playerStore.loadMissionId();
  if (!player || !missionId) {
    location.href = "/";
    return;
  }
  try {
    mission = await api.getMission(missionId);
    challenge = mission.rooms.find((item) => item.room === roomNum);
    if (!challenge) {
      error.textContent = "Terminal offline";
      return;
    }
    const draft = localStorage.getItem(playerStore.draftKey(challenge.id));
    const revealed = await api.revealedHints(mission.id, challenge.id).catch(() => ({ hints: [] }));
    hints = revealed.hints || [];
    renderBrief();
    bootEditor(draft || challenge.starterCode);
  } catch (err) {
    error.textContent = err.message || "Terminal offline";
  }
}

runBtn.addEventListener("click", async () => {
  if (!challenge || !editor) return;
  runBtn.disabled = true;
  error.textContent = "";
  try {
    const out = await api.run(challenge.id, editor.getValue());
    showResults(out.results);
    executor.textContent = out.pistonNote || `Executed by ${out.executor}`;
    message.textContent = out.passedAll
      ? "Sample diagnostics passed. Submit to run the sealed tests."
      : out.error || "Sample diagnostics failed.";
  } catch (err) {
    error.textContent = err.message || "Run failed";
  } finally {
    runBtn.disabled = false;
  }
});

submitBtn.addEventListener("click", async () => {
  if (!challenge || !editor || !mission) return;
  const player = playerStore.loadPlayer();
  if (!player) return;
  submitBtn.disabled = true;
  error.textContent = "";
  try {
    const out = await api.submit(player.id, mission.id, challenge.id, editor.getValue());
    showResults(out.results);
    mission = out.mission;
    executor.textContent = out.pistonNote || `Executed by ${out.executor}`;
    if (out.passedAll && out.completed) {
      transition.textContent = challenge.success;
      transition.classList.remove("hidden");
      setTimeout(() => {
        location.href = "/finale";
      }, 1600);
    } else if (out.passedAll) {
      transition.textContent = challenge.success;
      transition.classList.remove("hidden");
      setTimeout(() => {
        location.href = "/ship";
      }, 1600);
    } else {
      message.textContent = out.error || "Hidden diagnostics failed. The door stays sealed.";
    }
  } catch (err) {
    error.textContent = err.message || "Submit failed";
  } finally {
    submitBtn.disabled = false;
  }
});

hintBtn.addEventListener("click", async () => {
  if (!challenge || !mission) return;
  const index = hints.length;
  if (index >= challenge.hintCount) return;
  try {
    const out = await api.hint(mission.id, challenge.id, index);
    hints.push(out.hint);
    hintList.innerHTML = hints.map((hint) => `<li>${hint}</li>`).join("");
  } catch (err) {
    error.textContent = err.message || "Hint unavailable";
  }
});

resetBtn.addEventListener("click", () => {
  if (!challenge || !editor) return;
  editor.setValue(challenge.starterCode);
  localStorage.removeItem(playerStore.draftKey(challenge.id));
});

load();
