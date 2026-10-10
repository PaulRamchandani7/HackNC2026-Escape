export function difficultyVariant(difficulty: string): 'easy' | 'medium' | 'hard' | 'default' {
  const key = difficulty.toLowerCase()
  if (key === 'easy' || key === 'medium' || key === 'hard') return key
  return 'default'
}
