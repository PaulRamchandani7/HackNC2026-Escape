const PLAYER_KEY = 'adrift.player'
const MISSION_KEY = 'adrift.missionId'

export type LocalPlayer = { id: string; nickname: string }

export function loadPlayer(): LocalPlayer | null {
  const raw = localStorage.getItem(PLAYER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LocalPlayer
  } catch {
    return null
  }
}

export function savePlayer(player: LocalPlayer) {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player))
}

export function loadMissionId(): string | null {
  return localStorage.getItem(MISSION_KEY)
}

export function saveMissionId(id: string) {
  localStorage.setItem(MISSION_KEY, id)
}

export function clearMissionId() {
  localStorage.removeItem(MISSION_KEY)
}

export function draftKey(challengeId: string) {
  return `adrift.draft.${challengeId}`
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${clock}` : clock
}
