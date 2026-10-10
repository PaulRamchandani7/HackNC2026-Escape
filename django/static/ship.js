const rooms = [
  { room: 1, name: "Crew Quarters" },
  { room: 2, name: "Engine Room" },
  { room: 3, name: "Communications Room" },
  { room: 4, name: "Navigation Room" },
  { room: 5, name: "The Bridge" },
]

const systems = [
  {
    key: "power",
    off: "Power offline",
    onText: "Auxiliary power online",
    mark: 2,
  },
  {
    key: "communications",
    off: "Radio silent",
    onText: "Distress signal transmitted",
    mark: 3,
  },
  {
    key: "navigation",
    off: "Navigation offline",
    onText: "Safe course plotted",
    mark: 4,
  },
  {
    key: "bridge",
    off: "Bridge access denied",
    partialText: "Bridge access authorized",
    onText: "Helm restored",
    mark: 4,
    full: 5,
  },
]

let solved = new Set()
let started = Date.now()

const clock = document.getElementById("elapsed")
const progressLabel = document.getElementById("progress-label")
const notice = document.getElementById("notice")

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const face = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  return hours > 0 ? `${hours}:${face}` : face
}

function currentRoom() {
  return rooms.find((room) => room.room === solved.size + 1) ?? null
}

function paint() {
  const current = currentRoom()
  progressLabel.textContent = `${solved.size} of 5 ship systems restored`
  document.querySelectorAll(".room").forEach((button) => {
    const number = Number(button.dataset.room)
    const open = number <= solved.size + 1
    const done = solved.has(number)
    button.disabled = !open
    button.classList.toggle("is-open", open)
    button.classList.toggle("is-solved", done)
    button.classList.toggle("is-current", current?.room === number)
  })
  document.querySelectorAll(".corridor-link").forEach((line) => {
    const live = solved.has(Number(line.dataset.room))
    line.setAttribute("stroke", live ? "#35D0A1" : "#4FD1E8")
    line.setAttribute("stroke-opacity", live ? "0.95" : "0.35")
    line.setAttribute("stroke-width", live ? "3" : "2")
    line.classList.toggle("pulse-line", live)
  })
  systems.forEach((system) => {
    const card = document.querySelector(`[data-system="${system.key}"]`)
    const hasMark = solved.has(system.mark)
    const full = system.full ? solved.has(system.full) : hasMark
    const progress = system.full ? (full ? 1 : hasMark ? 0.6 : 0) : full ? 1 : 0
    card.classList.toggle("is-on", hasMark)
    card.classList.toggle("is-full", full)
    card.querySelector(".system-state").textContent = full
      ? system.onText
      : hasMark
        ? system.partialText
        : system.off
    card.querySelector(".system-flag").textContent = full ? "Restored" : hasMark ? "Partial" : "Offline"
    card.querySelector(".meter span").style.width = `${Math.round(progress * 100)}%`
  })
}

document.querySelectorAll(".room").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return
    window.location.href = `/room/${button.dataset.room}/`
  })
})

document.getElementById("restart").addEventListener("click", () => {
  solved = new Set()
  started = Date.now()
  notice.hidden = false
  notice.textContent = "A new diagnostic sequence has been assigned."
  paint()
})

window.setInterval(() => {
  clock.textContent = formatDuration(Date.now() - started)
  clock.dateTime = `PT${Math.floor((Date.now() - started) / 1000)}S`
}, 1000)

paint()
