const stats = document.getElementById("stats");
const error = document.getElementById("error");
const again = document.getElementById("again");
const share = document.getElementById("share");

let mission = null;
let cardText = "";

async function load() {
  const id = playerStore.loadMissionId();
  if (!id) {
    location.href = "/";
    return;
  }
  try {
    mission = await api.getMission(id);
    if (!mission.allSolved) {
      location.href = "/ship";
      return;
    }
    const elapsed = mission.escape_ms ?? mission.elapsedMs;
    const difficulties = [...new Set(mission.rooms.map((room) => room.difficulty))].join(", ");
    const rows = [
      ["Problems solved", String(mission.solvedChallengeIds.length)],
      ["Escape time", playerStore.formatDuration(elapsed)],
      ["Hints used", String(mission.hints_used)],
      ["Attempts", String(mission.attempts)],
      ["Difficulty", difficulties],
    ];
    stats.innerHTML = rows
      .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
      .join("");
    cardText = [
      "CODE: ADRIFT",
      "YOU MADE IT HOME",
      `Problems solved: ${mission.solvedChallengeIds.length}`,
      `Escape time: ${playerStore.formatDuration(elapsed)}`,
      `Hints used: ${mission.hints_used}`,
      `Submission attempts: ${mission.attempts}`,
      `Difficulty: ${difficulties}`,
    ].join("\n");
  } catch (err) {
    error.textContent = err.message || "The horizon is still dark";
  }
}

again.addEventListener("click", async () => {
  const player = playerStore.loadPlayer();
  if (!player) {
    location.href = "/intro";
    return;
  }
  const next = await api.startMission(player.id, true);
  playerStore.saveMissionId(next.id);
  location.href = "/ship";
});

share.addEventListener("click", async () => {
  if (navigator.share) {
    await navigator.share({ title: "CODE: ADRIFT", text: cardText }).catch(() => undefined);
    return;
  }
  await navigator.clipboard.writeText(cardText);
  share.textContent = "Copied";
});

load();
