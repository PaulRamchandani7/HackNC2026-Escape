const prefix = "/api";

async function request(path, init = {}) {
  const res = await fetch(`${prefix}${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

window.api = {
  catalog: () => request("/catalog"),
  createPlayer: (nickname) =>
    request("/players", { method: "POST", body: JSON.stringify({ nickname }) }),
  startMission: (playerId, redraw = false) =>
    request("/missions", {
      method: "POST",
      body: JSON.stringify({ playerId, redraw }),
    }),
  getMission: (id) => request(`/missions/${id}`),
  revealedHints: (missionId, challengeId) =>
    request(`/missions/${missionId}/hints/${challengeId}`),
  run: (challengeId, code) =>
    request("/run", {
      method: "POST",
      body: JSON.stringify({ challengeId, code }),
    }),
  submit: (playerId, missionId, challengeId, code) =>
    request("/submit", {
      method: "POST",
      body: JSON.stringify({ playerId, missionId, challengeId, code }),
    }),
  hint: (missionId, challengeId, index) =>
    request("/hints", {
      method: "POST",
      body: JSON.stringify({ missionId, challengeId, index }),
    }),
};

window.playerStore = {
  loadPlayer() {
    try {
      return JSON.parse(localStorage.getItem("code-adrift-player") || "null");
    } catch {
      return null;
    }
  },
  savePlayer(player) {
    localStorage.setItem("code-adrift-player", JSON.stringify(player));
  },
  loadMissionId() {
    return localStorage.getItem("code-adrift-mission") || "";
  },
  saveMissionId(id) {
    localStorage.setItem("code-adrift-mission", id);
  },
  draftKey(challengeId) {
    return `code-adrift-draft:${challengeId}`;
  },
  formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  },
};
