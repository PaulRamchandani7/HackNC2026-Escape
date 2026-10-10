const SCENES = [
  {
    kicker: "03:17 AM — NORTH ATLANTIC OCEAN",
    lines: ["You open your eyes.", "The floor beneath you rocks violently.", "You don't remember boarding this ship."],
  },
  {
    kicker: "CREW CABIN",
    lines: [
      "The crew is gone.",
      "The emergency lights are barely functioning.",
      "Every door is sealed by the ship's automated security system.",
    ],
  },
  {
    kicker: "EMERGENCY PROTOCOL ACTIVE",
    lines: [
      "Navigation offline.",
      "Engine controls restricted.",
      "Bridge access denied.",
      "Manual recovery requires successful completion of system diagnostics.",
    ],
  },
  {
    kicker: "MISSION: REACH THE BRIDGE",
    lines: [
      "Restore the ship's systems, unlock each compartment, and regain control before the storm overtakes the vessel.",
    ],
  },
];

let index = 0;
const kicker = document.getElementById("kicker");
const lines = document.getElementById("lines");
const next = document.getElementById("next");
const error = document.getElementById("error");
const skip = document.getElementById("skip");

function render() {
  const scene = SCENES[index];
  kicker.textContent = scene.kicker;
  lines.innerHTML = scene.lines.map((line) => `<p>${line}</p>`).join("");
  next.textContent = index < SCENES.length - 1 ? "Continue" : "Enter the First Room";
}

async function enterShip() {
  next.disabled = true;
  next.textContent = "Opening the hatch…";
  error.textContent = "";
  try {
    let player = playerStore.loadPlayer();
    if (!player) {
      player = await api.createPlayer();
      playerStore.savePlayer(player);
    }
    const mission = await api.startMission(player.id);
    playerStore.saveMissionId(mission.id);
    location.href = "/ship";
  } catch (err) {
    error.textContent = err.message || "The terminal failed to boot";
    next.disabled = false;
    next.textContent = "Enter the First Room";
  }
}

next.addEventListener("click", () => {
  if (index < SCENES.length - 1) {
    index += 1;
    render();
    return;
  }
  enterShip();
});

skip.addEventListener("click", () => {
  index = SCENES.length - 1;
  render();
});

render();
