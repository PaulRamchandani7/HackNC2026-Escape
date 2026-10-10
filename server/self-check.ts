import { runTests } from './judge.ts'
import { listProblems, selectMissionRooms } from './leetcode.ts'
import { judgeProblems } from './problems.ts'
import { referenceSolutions } from './references.ts'

const failures: string[] = []

for (const problem of judgeProblems) {
  const code = referenceSolutions[problem.slug]
  if (!code) {
    failures.push(`${problem.slug}: missing reference solution`)
    continue
  }
  const hidden = await runTests({
    code,
    functionName: problem.functionName,
    tests: problem.hiddenTests,
    compare: problem.compare,
    revealExpected: true,
  })
  const sample = await runTests({
    code,
    functionName: problem.functionName,
    tests: problem.sampleTests,
    compare: problem.compare,
    revealExpected: true,
  })
  if (!hidden.passedAll || !sample.passedAll) {
    failures.push(
      `${problem.slug}: sample=${sample.passedAll} hidden=${hidden.passedAll} executor=${hidden.executor} error=${hidden.error ?? ''} ${JSON.stringify(hidden.results)}`,
    )
  } else {
    console.log(`pass ${problem.slug} via ${hidden.executor}`)
  }
}

const wrong = await runTests({
  code: 'def search_insert(nums, target):\n    return 0\n',
  functionName: 'search_insert',
  tests: judgeProblems[0]!.hiddenTests,
  compare: 'exact',
  revealExpected: false,
})
if (wrong.passedAll) failures.push('placeholder solution was accepted')
else console.log(`reject placeholder via ${wrong.executor}`)

const listed = await listProblems({ difficulty: 'Easy', topic: 'array', limit: 5 })
console.log(
  `leetcode list source=${listed.source} total=${listed.total} sample=${listed.questions
    .slice(0, 3)
    .map((row) => row.slug)
    .join(', ')} error=${listed.error ?? ''}`,
)
if (listed.questions.length === 0 && listed.source === 'unavailable') {
  failures.push(`leetcode list unavailable: ${listed.error}`)
}

const selected = await selectMissionRooms([])
console.log(
  `selected ${selected.rooms
    .map((room) => `${room.room}:${room.meta.questionId} ${room.meta.title} (${room.source})`)
    .join(' | ')}`,
)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('self-check ok')
