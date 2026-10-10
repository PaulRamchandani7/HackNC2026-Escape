const scenes = [
  {
    kicker: "03:17 AM — NORTH ATLANTIC OCEAN",
    lines: ["You open your eyes.", "The floor beneath you rocks violently.", "You don't remember boarding this ship."],
    tone: "void",
  },
  {
    kicker: "CREW CABIN",
    lines: ["The crew is gone.", "The emergency lights are barely functioning.", "Every door is sealed by the ship's automated security system."],
    tone: "cabin",
  },
  {
    kicker: "EMERGENCY PROTOCOL ACTIVE",
    lines: ["Navigation offline.", "Engine controls restricted.", "Bridge access denied.", "Manual recovery requires successful completion of system diagnostics."],
    tone: "terminal",
  },
  {
    kicker: "MISSION: REACH THE BRIDGE",
    lines: ["Restore the ship's systems, unlock each compartment, and regain control before the storm overtakes the vessel."],
    tone: "mission",
  },
]

const stage = document.getElementById("intro")
const rain = document.getElementById("intro-rain")
const slot = document.getElementById("scene")
const continueButton = document.getElementById("continue")
const enterForm = document.getElementById("enter-form")
let index = 0

function show(next) {
  index = next
  const scene = scenes[index]
  stage.classList.toggle("is-ocean", scene.tone !== "void")
  rain.hidden = scene.tone === "void"
  const kicker = document.createElement("p")
  kicker.className = scene.tone === "terminal" ? "scene-kicker is-amber" : "scene-kicker"
  kicker.textContent = scene.kicker
  const block = document.createElement("div")
  block.className = "scene"
  block.append(kicker)
  for (const line of scene.lines) {
    const paragraph = document.createElement("p")
    paragraph.className = "scene-line display"
    paragraph.textContent = line
    block.append(paragraph)
  }
  slot.replaceChildren(block)
  const last = index === scenes.length - 1
  continueButton.hidden = last
  enterForm.hidden = !last
}

document.getElementById("skip").addEventListener("click", () => show(scenes.length - 1))
continueButton.addEventListener("click", () => show(Math.min(index + 1, scenes.length - 1)))
enterForm.addEventListener("submit", () => {
  const button = document.getElementById("enter")
  button.disabled = true
  button.textContent = "Opening the hatch…"
})

show(document.body.dataset.bootError ? scenes.length - 1 : 0)
