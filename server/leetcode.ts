import { db } from './db.ts'
import { judgeProblems, problemsForRoom, ROOM_PLAN } from './problems.ts'

export const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql'

const LIST_TTL_MS = 15 * 60 * 1000
const DETAIL_TTL_MS = 6 * 60 * 60 * 1000
const STALE_OK_MS = 7 * 24 * 60 * 60 * 1000

export type Difficulty = 'Easy' | 'Medium' | 'Hard'
export type MetadataSource = 'live' | 'cache' | 'seed'

export type ProblemMeta = {
  questionId: string
  title: string
  slug: string
  difficulty: Difficulty
  paid: boolean
  tags: string[]
  url: string
}

export type ListedProblem = ProblemMeta & {
  acRate: number | null
}

type CacheRow = { payload: string; fetched_at: number; fresh_until: number }

let cooldownUntil = 0
let lastError = ''
let lastLiveAt = 0

const SEED: Record<string, ProblemMeta> = {
  'search-insert-position': meta('35', 'Search Insert Position', 'search-insert-position', 'Easy', ['array', 'binary-search']),
  'best-time-to-buy-and-sell-stock': meta('121', 'Best Time to Buy and Sell Stock', 'best-time-to-buy-and-sell-stock', 'Easy', ['array', 'dynamic-programming']),
  'plus-one': meta('66', 'Plus One', 'plus-one', 'Easy', ['array', 'math']),
  'squares-of-a-sorted-array': meta('977', 'Squares of a Sorted Array', 'squares-of-a-sorted-array', 'Easy', ['array', 'two-pointers', 'sorting']),
  'max-consecutive-ones': meta('485', 'Max Consecutive Ones', 'max-consecutive-ones', 'Easy', ['array']),
  'valid-palindrome': meta('125', 'Valid Palindrome', 'valid-palindrome', 'Easy', ['two-pointers', 'string']),
  'length-of-last-word': meta('58', 'Length of Last Word', 'length-of-last-word', 'Easy', ['string']),
  'first-unique-character-in-a-string': meta('387', 'First Unique Character in a String', 'first-unique-character-in-a-string', 'Easy', ['hash-table', 'string', 'queue', 'counting']),
  'detect-capital': meta('520', 'Detect Capital', 'detect-capital', 'Easy', ['string']),
  'group-anagrams': meta('49', 'Group Anagrams', 'group-anagrams', 'Medium', ['array', 'hash-table', 'string', 'sorting']),
  'top-k-frequent-elements': meta('347', 'Top K Frequent Elements', 'top-k-frequent-elements', 'Medium', ['array', 'hash-table', 'divide-and-conquer', 'sorting', 'heap-priority-queue', 'bucket-sort', 'counting', 'quickselect']),
  'subarray-sum-equals-k': meta('560', 'Subarray Sum Equals K', 'subarray-sum-equals-k', 'Medium', ['array', 'hash-table', 'prefix-sum']),
  'longest-consecutive-sequence': meta('128', 'Longest Consecutive Sequence', 'longest-consecutive-sequence', 'Medium', ['array', 'hash-table', 'union-find']),
  'longest-substring-without-repeating-characters': meta('3', 'Longest Substring Without Repeating Characters', 'longest-substring-without-repeating-characters', 'Medium', ['hash-table', 'string', 'sliding-window']),
  'decode-string': meta('394', 'Decode String', 'decode-string', 'Medium', ['string', 'stack', 'recursion']),
  'search-in-rotated-sorted-array': meta('33', 'Search in Rotated Sorted Array', 'search-in-rotated-sorted-array', 'Medium', ['array', 'binary-search']),
  'find-minimum-in-rotated-sorted-array': meta('153', 'Find Minimum in Rotated Sorted Array', 'find-minimum-in-rotated-sorted-array', 'Medium', ['array', 'binary-search']),
  'number-of-islands': meta('200', 'Number of Islands', 'number-of-islands', 'Medium', ['array', 'depth-first-search', 'breadth-first-search', 'union-find', 'matrix']),
  'course-schedule': meta('207', 'Course Schedule', 'course-schedule', 'Medium', ['depth-first-search', 'breadth-first-search', 'graph', 'topological-sort']),
  'number-of-provinces': meta('547', 'Number of Provinces', 'number-of-provinces', 'Medium', ['depth-first-search', 'breadth-first-search', 'union-find', 'graph']),
}

function meta(
  questionId: string,
  title: string,
  slug: string,
  difficulty: Difficulty,
  tags: string[],
): ProblemMeta {
  return {
    questionId,
    title,
    slug,
    difficulty,
    paid: false,
    tags,
    url: problemUrl(slug),
  }
}

export function problemUrl(slug: string) {
  return `https://leetcode.com/problems/${slug}/`
}

function readCache(key: string): { value: unknown; fresh: boolean; fetchedAt: number } | null {
  const row = db.prepare('SELECT payload, fetched_at, fresh_until FROM problem_cache WHERE cache_key = ?').get(key) as
    | CacheRow
    | undefined
  if (!row) return null
  const age = Date.now() - row.fetched_at
  if (age > STALE_OK_MS) return null
  return {
    value: JSON.parse(row.payload) as unknown,
    fresh: Date.now() <= row.fresh_until,
    fetchedAt: row.fetched_at,
  }
}

function writeCache(key: string, value: unknown, ttl: number) {
  const now = Date.now()
  db.prepare(
    `INSERT INTO problem_cache (cache_key, payload, fetched_at, fresh_until)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at, fresh_until = excluded.fresh_until`,
  ).run(key, JSON.stringify(value), now, now + ttl)
}

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (Date.now() < cooldownUntil) {
    throw new Error('LeetCode rate-limit cooldown is active')
  }
  const response = await fetch(LEETCODE_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Referer: 'https://leetcode.com/problemset/',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12_000),
  })
  if (response.status === 429 || response.status === 403) {
    cooldownUntil = Date.now() + 60_000
    lastError = `LeetCode HTTP ${response.status}`
    throw new Error(lastError)
  }
  if (!response.ok) {
    lastError = `LeetCode HTTP ${response.status}`
    throw new Error(lastError)
  }
  const body = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> }
  if (body.errors?.length) {
    lastError = body.errors[0]?.message || 'LeetCode GraphQL error'
    throw new Error(lastError)
  }
  if (!body.data) {
    lastError = 'LeetCode returned an empty payload'
    throw new Error(lastError)
  }
  lastError = ''
  lastLiveAt = Date.now()
  return body.data
}

const LIST_QUERY = `
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total: totalNum
    questions: data {
      acRate
      difficulty
      frontendQuestionId: questionFrontendId
      paidOnly: isPaidOnly
      title
      titleSlug
      topicTags { name slug }
    }
  }
}`

type ListPayload = {
  problemsetQuestionList?: {
    total?: number
    questions?: Array<{
      acRate?: number
      difficulty?: string
      frontendQuestionId?: string
      paidOnly?: boolean
      title?: string
      titleSlug?: string
      topicTags?: Array<{ name?: string; slug?: string }>
    }>
  }
}

function normalizeDifficulty(value: string | undefined): Difficulty | null {
  const key = (value ?? '').toLowerCase()
  if (key === 'easy') return 'Easy'
  if (key === 'medium') return 'Medium'
  if (key === 'hard') return 'Hard'
  return null
}

export async function listProblems(opts: {
  difficulty: Difficulty
  topic?: string
  limit?: number
}): Promise<{
  total: number
  questions: ListedProblem[]
  source: MetadataSource | 'unavailable'
  fetchedAt: number | null
  error: string | null
  endpoint: string
}> {
  const topic = opts.topic ?? ''
  const limit = opts.limit ?? 30
  const key = `list:${opts.difficulty}:${topic}:${limit}`
  const cached = readCache(key)
  if (cached?.fresh) {
    const parsed = cached.value as { total: number; questions: ListedProblem[] }
    return {
      ...parsed,
      source: 'cache',
      fetchedAt: cached.fetchedAt,
      error: null,
      endpoint: LEETCODE_GRAPHQL,
    }
  }

  try {
    const filters: Record<string, unknown> = {
      difficulty: opts.difficulty.toUpperCase(),
    }
    if (topic) filters.tags = [topic]
    const data = await graphql<ListPayload>(LIST_QUERY, {
      categorySlug: '',
      limit,
      skip: 0,
      filters,
    })
    const raw = data.problemsetQuestionList?.questions ?? []
    const questions: ListedProblem[] = []
    for (const row of raw) {
      const difficulty = normalizeDifficulty(row.difficulty)
      const slug = row.titleSlug
      const title = row.title
      const questionId = row.frontendQuestionId
      if (!difficulty || !slug || !title || !questionId || row.paidOnly) continue
      const tags = (row.topicTags ?? [])
        .map((tag) => tag.slug)
        .filter((slugName): slugName is string => Boolean(slugName))
      if (topic && !tags.includes(topic)) continue
      questions.push({
        questionId,
        title,
        slug,
        difficulty,
        paid: false,
        tags,
        url: problemUrl(slug),
        acRate: typeof row.acRate === 'number' ? row.acRate : null,
      })
    }
    const payload = { total: data.problemsetQuestionList?.total ?? questions.length, questions }
    writeCache(key, payload, LIST_TTL_MS)
    return {
      ...payload,
      source: 'live',
      fetchedAt: Date.now(),
      error: null,
      endpoint: LEETCODE_GRAPHQL,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'LeetCode request failed'
    if (cached) {
      const parsed = cached.value as { total: number; questions: ListedProblem[] }
      return {
        ...parsed,
        source: 'cache',
        fetchedAt: cached.fetchedAt,
        error: message,
        endpoint: LEETCODE_GRAPHQL,
      }
    }
    return {
      total: 0,
      questions: [],
      source: 'unavailable',
      fetchedAt: null,
      error: message,
      endpoint: LEETCODE_GRAPHQL,
    }
  }
}

type QuestionRow = {
  questionFrontendId?: string
  title?: string
  titleSlug?: string
  difficulty?: string
  isPaidOnly?: boolean
  topicTags?: Array<{ slug?: string }>
}

export async function resolveCatalogMetadata(): Promise<{
  bySlug: Map<string, { meta: ProblemMeta; source: MetadataSource }>
  source: MetadataSource
  error: string | null
  fetchedAt: number | null
}> {
  const key = 'catalog-meta:v2'
  const cached = readCache(key)
  if (cached?.fresh) {
    const rows = cached.value as ProblemMeta[]
    return {
      bySlug: new Map(rows.map((row) => [row.slug, { meta: row, source: 'cache' as const }])),
      source: 'cache',
      error: null,
      fetchedAt: cached.fetchedAt,
    }
  }

  const fields = judgeProblems
    .map(
      (problem, index) =>
        `p${index}: question(titleSlug: ${JSON.stringify(problem.slug)}) { questionFrontendId title titleSlug difficulty isPaidOnly topicTags { slug } }`,
    )
    .join('\n')

  try {
    const data = await graphql<Record<string, QuestionRow | null>>(`query { ${fields} }`)
    const rows: ProblemMeta[] = []
    for (const [index, problem] of judgeProblems.entries()) {
      const row = data[`p${index}`]
      const difficulty = normalizeDifficulty(row?.difficulty)
      if (!row?.title || !row.titleSlug || !row.questionFrontendId || !difficulty) continue
      rows.push({
        questionId: row.questionFrontendId,
        title: row.title,
        slug: row.titleSlug || problem.slug,
        difficulty,
        paid: Boolean(row.isPaidOnly),
        tags: (row.topicTags ?? [])
          .map((tag) => tag.slug)
          .filter((slug): slug is string => Boolean(slug)),
        url: problemUrl(row.titleSlug || problem.slug),
      })
    }
    if (rows.length === 0) throw new Error('LeetCode returned no catalog metadata')
    writeCache(key, rows, DETAIL_TTL_MS)
    return {
      bySlug: new Map(rows.map((row) => [row.slug, { meta: row, source: 'live' as const }])),
      source: 'live',
      error: null,
      fetchedAt: Date.now(),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'LeetCode request failed'
    if (cached) {
      const rows = cached.value as ProblemMeta[]
      return {
        bySlug: new Map(rows.map((row) => [row.slug, { meta: row, source: 'cache' as const }])),
        source: 'cache',
        error: message,
        fetchedAt: cached.fetchedAt,
      }
    }
    return {
      bySlug: new Map(
        Object.values(SEED).map((row) => [row.slug, { meta: row, source: 'seed' as const }]),
      ),
      source: 'seed',
      error: message,
      fetchedAt: null,
    }
  }
}

export type RoomSelection = {
  room: number
  category: string
  problemSlug: string
  meta: ProblemMeta
  source: MetadataSource
  repeated: boolean
}

export async function selectMissionRooms(completedSlugs: string[]) {
  const resolved = await resolveCatalogMetadata()
  const completed = new Set(completedSlugs)
  const used = new Set<string>()
  const rooms: RoomSelection[] = []

  for (const plan of ROOM_PLAN) {
    const candidates = problemsForRoom(plan.topics, plan.difficulty)
    const confirmed = candidates.flatMap((problem) => {
      const hit = resolved.bySlug.get(problem.slug)
      const meta = hit?.meta ?? SEED[problem.slug]
      const source = hit?.source ?? 'seed'
      if (!meta || meta.paid) return []
      if (meta.difficulty !== plan.difficulty) return []
      if (!meta.tags.includes(problem.roomTopic)) return []
      return [{ slug: problem.slug, meta, source }]
    })
    let pool = confirmed.filter((item) => !completed.has(item.slug) && !used.has(item.slug))
    let repeated = false
    if (pool.length === 0) {
      pool = confirmed.filter((item) => !used.has(item.slug))
      repeated = pool.length > 0
    }
    if (pool.length === 0) {
      throw new Error(`No verifiable LeetCode ${plan.difficulty} ${plan.category} problem is available`)
    }
    const choice = pool[Math.floor(Math.random() * pool.length)]!
    used.add(choice.slug)
    rooms.push({
      room: plan.room,
      category: plan.category,
      problemSlug: choice.slug,
      meta: choice.meta,
      source: choice.source,
      repeated,
    })
  }

  return {
    rooms,
    provider: providerStatus(resolved.source, resolved.error, resolved.fetchedAt),
  }
}

export function providerStatus(
  source: MetadataSource | 'unavailable' | 'idle' = 'idle',
  error: string | null = lastError || null,
  fetchedAt: number | null = lastLiveAt || null,
) {
  return {
    endpoint: LEETCODE_GRAPHQL,
    officialApi: false,
    contentPolicy: 'metadata-only',
    note: 'GlitchLab uses the same unofficial LeetCode GraphQL endpoint as InterVue for titles, ids, difficulty, tags, and links. Problem statements are not copied. Each room uses an original brief and original tests, and links to the official problem.',
    source,
    error,
    fetchedAt,
    cooldown: Date.now() < cooldownUntil,
  }
}
