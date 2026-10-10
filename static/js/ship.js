const roomsEl = document.getElementById("rooms");
const systemsEl = document.getElementById("systems");
const notice = document.getElementById("notice");
const error = document.getElementById("error");
const voyageLabel = document.getElementById("voyage-label");
const voyageTimer = document.getElementById("voyage-timer");
const restart = document.getElementById("restart");

let mission = null;
let now = Date.now();

setInterval(() => {
  now = Date.now();
  if (!mission) return;
  const elapsed =
    mission.status === "completed" && mission.escape_ms != null
      ? mission.escape_ms
      : Math.max(0, now - mission.started_at);
  voyageTimer.textContent = playerStore.formatDuration(elapsed);
}, 1000);

function systemsFor(solvedRooms) {
  return [
    { name: "Quarters", state: solvedRooms.includes(1) ? "Access restored" : "Sealed", on: solvedRooms.includes(1) },
    { name: "Engines", state: solvedRooms.includes(2) ? "Aux power online" : "Offline", on: solvedRooms.includes(2) },
    { name: "Comms", state: solvedRooms.includes(3) ? "Distress transmitted" : "Static", on: solvedRooms.includes(3) },
    { name: "Nav / Bridge", state: solvedRooms.includes(5) ? "Course set" : "Restricted", on: solvedRooms.includes(5) },
  ];
}

function render() {
  if (!mission) return;
  const solvedRooms = mission.rooms
    .filter((room) => mission.solvedChallengeIds.includes(room.id))
    .map((room) => room.room);
  voyageLabel.textContent = `${solvedRooms.length} of 5 ship systems restored`;
  roomsEl.innerHTML = mission.rooms
    .map((room) => {
      const unlocked = mission.unlockedRooms.includes(room.room);
      const solved = mission.solvedChallengeIds.includes(room.id);
      const classes = ["room-card"];
      if (!unlocked) classes.push("locked");
      if (solved) classes.push("solved");
      return `
        <button type="button" class="${classes.join(" ")}" data-room="${room.room}" ${unlocked ? "" : "disabled"}>
          <span class="badge ${room.difficulty.toLowerCase()}">${room.difficulty}</span>
          <h2>${room.name}</h2>
          <p>${room.chapter}</p>
          <p>${solved ? "Restored" : unlocked ? "Terminal online" : "Compartment sealed"}</p>
        </button>
      `;
    })
    .join("");
  systemsEl.innerHTML = systemsFor(solvedRooms)
    .map(
      (system) => `
      <div class="system ${system.on ? "on" : ""}">
        <p class="name">${system.name}</p>
        <p class="state" style="color:${system.on ? "var(--signal)" : "inherit"}">${system.state}</p>
      </div>
    `,
    )
    .join("");
  roomsEl.querySelectorAll("[data-room]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const room = Number(btn.getAttribute("data-room"));
      if (!mission.unlockedRooms.includes(room)) {
        notice.textContent = "That compartment is still sealed.";
        return;
      }
      location.href = `/room/${room}`;
    });
  });
}

async function load() {
  const player = playerStore.loadPlayer();
  const id = playerStore.loadMissionId();
  if (!player || !id) {
    location.href = "/";
    return;
  }
  try {
    mission = await api.getMission(id);
    if (mission.status === "completed") {
      location.href = "/finale";
      return;
    }
    render();
  } catch (err) {
    error.textContent = err.message || "Deck plan unavailable";
  }
}

restart.addEventListener("click", async () => {
  const player = playerStore.loadPlayer();
  if (!player) return;
  error.textContent = "";
  try {
    mission = await api.startMission(player.id, true);
    playerStore.saveMissionId(mission.id);
    notice.textContent = "A new diagnostic sequence has been assigned.";
    render();
  } catch (err) {
    error.textContent = err.message || "Restart failed";
  }
});

load();
