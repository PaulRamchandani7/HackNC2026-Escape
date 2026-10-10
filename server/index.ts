import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { v4 as uuid } from 'uuid'
import { db } from './db.ts'
import { runTests } from './judge.ts'
import {
  listProblems,
  providerStatus,
  selectMissionRooms,
  type Difficulty,
  type MetadataSource,
} from './leetcode.ts'
import {
  MISSION_ID,
  MISSION_TITLE,
  ROOM_COUNT,
  ROOM_PLAN,
  getJudgeProblem,
  roomPlan,
} from './problems.ts'

const app = express()
app.use(cors())
app.use(express.json({ limit: '400kb' }))

type PlayerRow = {
  id: string
  nickname: string
  wallet: string | null
  created_at: number
}

type MissionRow = {
  id: string
  player_id: string
  mission_key: string
  started_at: number
  completed_at: number | null
  expired_at: number | null
  escape_ms: number | null
  hints_used: number
  status: string
}

type RoomRow = {
  mission_id: string
  room: number
  slug: string
  question_id: string
  title: string
  difficulty: string
  category: string
  leetcode_url: string
  tags_json: string
  metadata_source: MetadataSource
  repeated: number
}

function playerById(id: string) {
  return db.prepare('SELECT * FROM players WHERE id = ?').get(id) as PlayerRow | undefined
}

function missionById(id: string) {
  return db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as MissionRow | undefined
}

function roomsFor(missionId: string) {
  return db
    .prepare('SELECT * FROM mission_rooms WHERE mission_id = ? ORDER BY room ASC')
    .all(missionId) as RoomRow[]
}

function unlockedIds(missionId: string) {
  const rows = db
    .prepare('SELECT challenge_id FROM unlocks WHERE mission_id = ?')
    .all(missionId) as Array<{ challenge_id: string }>
  return new Set(rows.map((row) => row.challenge_id))
}

function completedSlugs(playerId: string) {
  const rows = db
    .prepare('SELECT slug FROM completed_problems WHERE player_id = ?')
    .all(playerId) as Array<{ slug: string }>
  return rows.map((row) => row.slug)
}

function refreshMission(mission: MissionRow) {
  return mission
}

function publicRoom(row: RoomRow) {
  const problem = getJudgeProblem(row.slug)
  const plan = roomPlan(row.room)
  return {
    id: row.slug,
    room: row.room,
    name: plan?.name ?? `Room ${row.room}`,
    chapter: plan?.chapter ?? '',
    success: plan?.success ?? 'SYSTEM RESTORED.',
    questionId: row.question_id,
    title: row.title,
    difficulty: row.difficulty,
    category: row.category,
    tags: JSON.parse(row.tags_json) as string[],
    story: plan?.story || problem?.story || '',
    statement: problem?.statement ?? '',
    functionName: problem?.functionName ?? '',
    starterCode: problem?.starterCode ?? '',
    sampleTests: problem?.sampleTests ?? [],
    hintCount: problem?.hints.length ?? 0,
    estimatedMinutes: problem?.estimatedMinutes ?? 6,
    leetcodeUrl: row.leetcode_url,
    metadataSource: row.metadata_source,
    repeated: Boolean(row.repeated),
    contentPolicy: 'original-brief',
  }
}

function missionPayload(mission: MissionRow) {
  const rooms = roomsFor(mission.id)
  const unlocked = unlockedIds(mission.id)
  const unlockedRooms = rooms.flatMap((room, index) => {
    const previous = rooms[index - 1]
    const open = index === 0 || (previous ? unlocked.has(previous.slug) : false)
    return open ? [room.room] : []
  })
  const attempts = (
    db.prepare('SELECT COUNT(*) as n FROM submissions WHERE mission_id = ?').get(mission.id) as {
      n: number
    }
  ).n
  return {
    ...mission,
    elapsedMs: Math.max(0, Date.now() - mission.started_at),
    attempts,
    unlockedRooms,
    solvedChallengeIds: rooms.filter((room) => unlocked.has(room.slug)).map((room) => room.slug),
    allSolved: rooms.length === ROOM_COUNT && rooms.every((room) => unlocked.has(room.slug)),
    rooms: rooms.map(publicRoom),
    provider: providerStatus(
      rooms.some((room) => room.metadata_source === 'live')
        ? 'live'
        : rooms.some((room) => room.metadata_source === 'cache')
          ? 'cache'
          : rooms.length
            ? 'seed'
            : 'idle',
    ),
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'code-adrift',
    leetcode: providerStatus(),
  })
})

app.get('/api/catalog', (_req, res) => {
  res.json({
    mission: {
      id: MISSION_ID,
      title: MISSION_TITLE,
      tagline: 'Lost at sea. Trapped aboard. Code your way home.',
      rooms: ROOM_COUNT,
    },
    blueprint: ROOM_PLAN.map((room) => ({
      room: room.room,
      name: room.name,
      chapter: room.chapter,
      difficulty: room.difficulty,
      category: room.category,
      topics: room.topics,
      minutes: room.minutes,
      story: room.story,
      success: room.success,
    })),
    provider: providerStatus(),
  })
})

app.get('/api/problems', async (req, res) => {
  const difficulty = String(req.query.difficulty ?? 'Easy')
  const topic = String(req.query.topic ?? '')
  if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
    res.status(400).json({ error: 'difficulty must be Easy, Medium, or Hard' })
    return
  }
  const listed = await listProblems({
    difficulty: difficulty as Difficulty,
    topic: topic || undefined,
    limit: 24,
  })
  res.json({
    ...listed,
    contentPolicy: 'metadata-only',
  })
})

app.post('/api/players', (req, res) => {
  const nickname =
    typeof req.body?.nickname === 'string' && req.body.nickname.trim()
      ? req.body.nickname.trim().slice(0, 32)
      : `Castaway-${uuid().slice(0, 4)}`
  const id = uuid()
  db.prepare('INSERT INTO players (id, nickname, created_at) VALUES (?, ?, ?)').run(
    id,
    nickname,
    Date.now(),
  )
  res.json({ id, nickname })
})

app.patch('/api/players/:id', (req, res) => {
  const player = playerById(req.params.id)
  if (!player) {
    res.status(404).json({ error: 'Player not found' })
    return
  }
  const nickname =
    typeof req.body?.nickname === 'string'
      ? req.body.nickname.trim().slice(0, 32)
      : player.nickname
  const wallet = typeof req.body?.wallet === 'string' ? req.body.wallet : player.wallet
  db.prepare('UPDATE players SET nickname = ?, wallet = ? WHERE id = ?').run(
    nickname || player.nickname,
    wallet,
    player.id,
  )
  res.json(playerById(player.id))
})

app.post('/api/missions', async (req, res) => {
  const player = playerById(req.body?.playerId)
  if (!player) {
    res.status(404).json({ error: 'Player not found' })
    return
  }
  const existing = db
    .prepare(
      `SELECT * FROM missions WHERE player_id = ? AND mission_key = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
    )
    .get(player.id, MISSION_ID) as MissionRow | undefined
  if (existing && !req.body?.redraw) {
    res.json(missionPayload(refreshMission(existing)))
    return
  }
  if (existing && req.body?.redraw) {
    db.prepare(
      `UPDATE missions SET status = 'abandoned', expired_at = ? WHERE id = ? AND status = 'active'`,
    ).run(Date.now(), existing.id)
  }

  try {
    const selected = await selectMissionRooms(completedSlugs(player.id))
    const id = uuid()
    const started = Date.now()
    const insertMission = db.prepare(
      `INSERT INTO missions (id, player_id, mission_key, started_at, hints_used, status)
       VALUES (?, ?, ?, ?, 0, 'active')`,
    )
    const insertRoom = db.prepare(
      `INSERT INTO mission_rooms
        (mission_id, room, slug, question_id, title, difficulty, category, leetcode_url, tags_json, metadata_source, repeated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const tx = db.transaction(() => {
      insertMission.run(id, player.id, MISSION_ID, started)
      for (const room of selected.rooms) {
        insertRoom.run(
          id,
          room.room,
          room.problemSlug,
          room.meta.questionId,
          room.meta.title,
          room.meta.difficulty,
          room.category,
          room.meta.url,
          JSON.stringify(room.meta.tags),
          room.source,
          room.repeated ? 1 : 0,
        )
      }
    })
    tx()
    res.json({ ...missionPayload(missionById(id)!), provider: selected.provider })
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Could not select LeetCode problems',
    })
  }
})

app.get('/api/missions/:id', (req, res) => {
  const mission = missionById(req.params.id)
  if (!mission) {
    res.status(404).json({ error: 'Mission not found' })
    return
  }
  res.json(missionPayload(refreshMission(mission)))
})

function assignedRoom(missionId: string, slug: string) {
  return db
    .prepare('SELECT * FROM mission_rooms WHERE mission_id = ? AND slug = ?')
    .get(missionId, slug) as RoomRow | undefined
}

app.post('/api/run', async (req, res) => {
  const slug = String(req.body?.challengeId ?? '')
  const problem = getJudgeProblem(slug)
  if (!problem) {
    res.status(404).json({ error: 'Challenge not found' })
    return
  }
  const code = String(req.body?.code ?? '')
  if (code.length > 40_000) {
    res.status(400).json({ error: 'Source too large' })
    return
  }
  try {
    const result = await runTests({
      code,
      functionName: problem.functionName,
      tests: problem.sampleTests,
      compare: problem.compare,
      revealExpected: true,
    })
    res.json({ ...result, hidden: false })
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Execution failed',
    })
  }
})

app.post('/api/submit', async (req, res) => {
  const player = playerById(req.body?.playerId)
  const mission = req.body?.missionId ? missionById(req.body.missionId) : undefined
  const slug = String(req.body?.challengeId ?? '')
  const problem = getJudgeProblem(slug)
  if (!player || !mission || !problem) {
    res.status(400).json({ error: 'Invalid submit request' })
    return
  }
  if (mission.player_id !== player.id) {
    res.status(403).json({ error: 'Mission does not belong to this player' })
    return
  }
  const room = assignedRoom(mission.id, slug)
  if (!room) {
    res.status(403).json({ error: 'That problem is not part of this mission' })
    return
  }
  const live = refreshMission(mission)
  if (live.status === 'expired') {
    res.status(409).json({ error: 'Mission timer expired. Start a new mission.' })
    return
  }
  if (live.status !== 'active') {
    res.status(409).json({ error: 'Mission is not active' })
    return
  }
  const rooms = roomsFor(live.id)
  const previous = rooms.find((item) => item.room === room.room - 1)
  if (previous && !unlockedIds(live.id).has(previous.slug)) {
    res.status(403).json({ error: 'Previous room is still locked' })
    return
  }

  const code = String(req.body?.code ?? '')
  if (code.length > 40_000) {
    res.status(400).json({ error: 'Source too large' })
    return
  }
  try {
    const result = await runTests({
      code,
      functionName: problem.functionName,
      tests: problem.hiddenTests,
      compare: problem.compare,
      revealExpected: false,
    })
    db.prepare(
      `INSERT INTO submissions (id, mission_id, challenge_id, passed, kind, stdout, stderr, created_at)
       VALUES (?, ?, ?, ?, 'hidden', ?, ?, ?)`,
    ).run(
      uuid(),
      live.id,
      slug,
      result.passedAll ? 1 : 0,
      result.stdout,
      result.stderr,
      Date.now(),
    )

    let unlockedNext: number | null = null
    let completed = false
    if (result.passedAll) {
      db.prepare(
        `INSERT OR IGNORE INTO unlocks (mission_id, challenge_id, accepted_at) VALUES (?, ?, ?)`,
      ).run(live.id, slug, Date.now())
      db.prepare(
        `INSERT INTO completed_problems (player_id, slug, completed_at) VALUES (?, ?, ?)
         ON CONFLICT(player_id, slug) DO UPDATE SET completed_at = excluded.completed_at`,
      ).run(player.id, slug, Date.now())
      const next = rooms.find((item) => item.room === room.room + 1)
      unlockedNext = next?.room ?? null
      const solved = unlockedIds(live.id)
      if (rooms.length === ROOM_COUNT && rooms.every((item) => solved.has(item.slug))) {
        const escapeMs = Date.now() - live.started_at
        db.prepare(
          `UPDATE missions SET status = 'completed', completed_at = ?, escape_ms = ? WHERE id = ? AND status = 'active'`,
        ).run(Date.now(), escapeMs, live.id)
        completed = true
      }
    }

    res.json({
      ...result,
      hidden: true,
      unlockedNext,
      completed,
      mission: missionPayload(missionById(live.id)!),
    })
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Judging failed',
    })
  }
})

app.post('/api/hints', (req, res) => {
  const mission = missionById(req.body?.missionId)
  const slug = String(req.body?.challengeId ?? '')
  const problem = getJudgeProblem(slug)
  const index = Number(req.body?.index ?? 0)
  if (!mission || !problem || !assignedRoom(mission.id, slug) || !problem.hints[index]) {
    res.status(400).json({ error: 'Invalid hint request' })
    return
  }
  const live = refreshMission(mission)
  if (live.status !== 'active') {
    res.status(409).json({ error: 'Hints are only available during an active mission' })
    return
  }
  const inserted = db
    .prepare(
      `INSERT OR IGNORE INTO hint_reveals (mission_id, slug, hint_index) VALUES (?, ?, ?)`,
    )
    .run(live.id, slug, index)
  if (inserted.changes > 0) {
    db.prepare('UPDATE missions SET hints_used = hints_used + 1 WHERE id = ?').run(live.id)
  }
  const hintsUsed = (
    db.prepare('SELECT hints_used FROM missions WHERE id = ?').get(live.id) as { hints_used: number }
  ).hints_used
  res.json({ index, hint: problem.hints[index], hintsUsed })
})

app.get('/api/missions/:id/hints/:slug', (req, res) => {
  const problem = getJudgeProblem(req.params.slug)
  if (!problem || !assignedRoom(req.params.id, req.params.slug)) {
    res.status(404).json({ error: 'Unknown problem' })
    return
  }
  const rows = db
    .prepare(
      `SELECT hint_index FROM hint_reveals WHERE mission_id = ? AND slug = ? ORDER BY hint_index`,
    )
    .all(req.params.id, req.params.slug) as Array<{ hint_index: number }>
  res.json({
    hints: rows.flatMap((row) => {
      const hint = problem.hints[row.hint_index]
      return hint ? [hint] : []
    }),
  })
})

app.get('/api/leaderboard', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT m.id as mission_id, p.id as player_id, p.nickname, p.wallet,
              m.escape_ms, m.hints_used, m.completed_at,
              (SELECT COUNT(*) FROM unlocks u WHERE u.mission_id = m.id) as problems,
              (SELECT CASE
                 WHEN SUM(CASE WHEN mr.difficulty = 'Hard' THEN 1 ELSE 0 END) > 0 THEN 'Hard'
                 WHEN SUM(CASE WHEN mr.difficulty = 'Medium' THEN 1 ELSE 0 END) > 0 THEN 'Medium'
                 WHEN COUNT(mr.room) > 0 THEN 'Easy'
                 ELSE NULL END
               FROM mission_rooms mr WHERE mr.mission_id = m.id) as difficulty,
              (SELECT a.status FROM achievements a WHERE a.player_id = p.id AND a.mission_key = m.mission_key
                 ORDER BY a.created_at DESC LIMIT 1) as achievement_status,
              (SELECT a.signature FROM achievements a WHERE a.player_id = p.id AND a.status = 'confirmed'
                 ORDER BY a.confirmed_at DESC LIMIT 1) as signature
       FROM missions m
       JOIN players p ON p.id = m.player_id
       WHERE m.status = 'completed'
       ORDER BY m.escape_ms ASC, m.hints_used ASC, m.completed_at ASC
       LIMIT 50`,
    )
    .all()
  res.json({ entries: rows })
})

app.get('/api/players/:id/profile', (req, res) => {
  const player = playerById(req.params.id)
  if (!player) {
    res.status(404).json({ error: 'Player not found' })
    return
  }
  const missions = db
    .prepare(`SELECT * FROM missions WHERE player_id = ? ORDER BY started_at DESC`)
    .all(player.id)
  const solved = db
    .prepare(
      `SELECT COUNT(*) as n FROM unlocks u JOIN missions m ON m.id = u.mission_id WHERE m.player_id = ?`,
    )
    .get(player.id) as { n: number }
  const best = db
    .prepare(
      `SELECT MIN(escape_ms) as best FROM missions WHERE player_id = ? AND status = 'completed'`,
    )
    .get(player.id) as { best: number | null }
  const solvedProblems = db
    .prepare(
      `SELECT mr.slug, mr.title, mr.question_id as questionId, mr.difficulty, mr.room,
              mr.leetcode_url as leetcodeUrl, mr.category, u.accepted_at as acceptedAt, mr.mission_id as missionId
       FROM mission_rooms mr
       JOIN unlocks u ON u.mission_id = mr.mission_id AND u.challenge_id = mr.slug
       JOIN missions m ON m.id = mr.mission_id
       WHERE m.player_id = ?
       ORDER BY u.accepted_at DESC`,
    )
    .all(player.id)
  const achievements = db
    .prepare(`SELECT * FROM achievements WHERE player_id = ? ORDER BY created_at DESC`)
    .all(player.id) as Array<{
    status: string
    signature: string | null
    wallet: string
    error: string | null
    mission_key: string
  }>

  const latest = achievements[0]
  const completed = (missions as Array<{ status: string }>).some((row) => row.status === 'completed')
  let verification: string
  if (latest?.status === 'confirmed') verification = 'verified'
  else if (latest?.status === 'pending') verification = 'pending'
  else if (latest?.status === 'failed') verification = 'failed'
  else if (completed) verification = 'completed_unclaimed'
  else verification = 'in_progress'

  res.json({
    player,
    missions,
    problemsSolved: solved.n,
    bestEscapeMs: best.best,
    solvedProblems,
    achievements: achievements.map((row) => ({
      ...row,
      explorerUrl: null,
    })),
    verification,
  })
})

const port = Number(process.env.PORT ?? 8787)
app.listen(port, () => {
  console.log(`CODE: ADRIFT API on http://localhost:${port}`)
})
