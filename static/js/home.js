(async function () {
  const howBtn = document.getElementById("how-btn");
  const howModal = document.getElementById("how-modal");
  const howClose = document.getElementById("how-close");
  howBtn.addEventListener("click", () => howModal.classList.remove("hidden"));
  howClose.addEventListener("click", () => howModal.classList.add("hidden"));

  const id = playerStore.loadMissionId();
  const player = playerStore.loadPlayer();
  if (!id || !player) return;
  try {
    const mission = await api.getMission(id);
    if (mission.player_id !== player.id || mission.rooms.length !== 5) return;
    if (mission.status === "active") {
      document.getElementById("continue-btn").classList.remove("hidden");
    } else if (mission.status === "completed") {
      document.getElementById("finale-btn").classList.remove("hidden");
    }
  } catch {
    /* ignore stale mission */
  }
})();
