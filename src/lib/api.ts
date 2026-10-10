const prefix = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${prefix}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return body
}

export type SampleTest = {
  args: unknown[]
  expected: unknown
  label: string
}

export type Challenge = {
  id: string
  room: number
  name: string
  chapter: string
  success: string
  questionId: string
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  category: string
  tags: string[]
  story: string
  statement: string
  functionName: string
  starterCode: string
  sampleTests: SampleTest[]
  hintCount: number
  estimatedMinutes: number
  leetcodeUrl: string
  metadataSource: 'live' | 'cache' | 'seed'
  repeated: boolean
  contentPolicy: string
}

export type ProviderStatus = {
  endpoint: string
  officialApi: boolean
  contentPolicy: string
  note: string
  source: string
  error: string | null
  fetchedAt: number | null
  cooldown: boolean
}

export type Mission = {
  id: string
  player_id: string
  status: string
  started_at: number
  escape_ms: number | null
  hints_used: number
  elapsedMs: number
  attempts: number
  unlockedRooms: number[]
  solvedChallengeIds: string[]
  allSolved: boolean
  rooms: Challenge[]
  provider: ProviderStatus
}

export type CaseResult = {
  index: number
  label: string
  passed: boolean
  got?: unknown
  expected?: unknown
  error?: string
}

export type RunResult = {
  passedAll: boolean
  stdout: string
  stderr: string
  results: CaseResult[]
  error?: string
  executor: 'piston' | 'local-python'
  pistonNote: string | null
}

export type BlueprintRoom = {
  room: number
  name: string
  chapter: string
  difficulty: string
  category: string
  topics: string[]
  minutes: number
  story: string
  success: string
}

export const api = {
  catalog: () =>
    request<{
      mission: { id: string; title: string; tagline: string; rooms: number }
      blueprint: BlueprintRoom[]
      provider: ProviderStatus
    }>('/catalog'),
  createPlayer: (nickname?: string) =>
    request<{ id: string; nickname: string }>('/players', {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    }),
  startMission: (playerId: string, redraw = false) =>
    request<Mission>('/missions', {
      method: 'POST',
      body: JSON.stringify({ playerId, redraw }),
    }),
  getMission: (id: string) => request<Mission>(`/missions/${id}`),
  revealedHints: (missionId: string, challengeId: string) =>
    request<{ hints: string[] }>(`/missions/${missionId}/hints/${challengeId}`),
  run: (challengeId: string, code: string) =>
    request<RunResult>('/run', {
      method: 'POST',
      body: JSON.stringify({ challengeId, code }),
    }),
  submit: (playerId: string, missionId: string, challengeId: string, code: string) =>
    request<
      RunResult & {
        unlockedNext: number | null
        completed: boolean
        mission: Mission
      }
    >('/submit', {
      method: 'POST',
      body: JSON.stringify({ playerId, missionId, challengeId, code }),
    }),
  hint: (missionId: string, challengeId: string, index: number) =>
    request<{ index: number; hint: string; hintsUsed: number }>('/hints', {
      method: 'POST',
      body: JSON.stringify({ missionId, challengeId, index }),
    }),
}
