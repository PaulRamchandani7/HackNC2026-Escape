export const referenceSolutions: Record<string, string> = {
  'search-insert-position': `def search_insert(nums, target):
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo
`,
  'best-time-to-buy-and-sell-stock': `def max_energy_profit(prices):
    best = 0
    low = prices[0]
    for price in prices:
        best = max(best, price - low)
        low = min(low, price)
    return best
`,
  'plus-one': `def increment_counter(digits):
    out = digits[:]
    i = len(out) - 1
    while i >= 0 and out[i] == 9:
        out[i] = 0
        i -= 1
    if i < 0:
        return [1] + out
    out[i] += 1
    return out
`,
  'squares-of-a-sorted-array': `def sorted_offset_squares(offsets):
    return sorted(value * value for value in offsets)
`,
  'max-consecutive-ones': `def longest_live_streak(readings):
    best = current = 0
    for value in readings:
        if value == 1:
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best
`,
  'valid-palindrome': `def door_phrase_is_palindrome(s):
    cleaned = [ch.lower() for ch in s if ch.isalnum()]
    return cleaned == cleaned[::-1]
`,
  'length-of-last-word': `def last_token_length(s):
    parts = s.split()
    return len(parts[-1]) if parts else 0
`,
  'first-unique-character-in-a-string': `def first_solo_signal(s):
    from collections import Counter
    counts = Counter(s)
    for index, ch in enumerate(s):
        if counts[ch] == 1:
            return index
    return -1
`,
  'detect-capital': `def badge_capitalization_ok(word):
    return word.isupper() or word.islower() or (word[0].isupper() and word[1:].islower())
`,
  'group-anagrams': `def cluster_anagrams(codes):
    from collections import defaultdict
    groups = defaultdict(list)
    for code in codes:
        groups[''.join(sorted(code))].append(code)
    return list(groups.values())
`,
  'top-k-frequent-elements': `def most_frequent_codes(nums, k):
    from collections import Counter
    return [value for value, _count in Counter(nums).most_common(k)]
`,
  'subarray-sum-equals-k': `def count_charge_slices(nums, k):
    from collections import defaultdict
    seen = defaultdict(int)
    seen[0] = 1
    total = count = 0
    for value in nums:
        total += value
        count += seen[total - k]
        seen[total] += 1
    return count
`,
  'longest-substring-without-repeating-characters': `def longest_clear_channel(s):
    last = {}
    start = best = 0
    for index, ch in enumerate(s):
        if ch in last and last[ch] >= start:
            start = last[ch] + 1
        last[ch] = index
        best = max(best, index - start + 1)
    return best
`,
  'decode-string': `def expand_distress_code(code):
    stack = []
    current = ""
    count = 0
    for ch in code:
        if ch.isdigit():
            count = count * 10 + int(ch)
        elif ch == "[":
            stack.append((current, count))
            current = ""
            count = 0
        elif ch == "]":
            previous, times = stack.pop()
            current = previous + current * times
        else:
            current += ch
    return current
`,
  'search-in-rotated-sorted-array': `def find_beacon(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1
`,
  'find-minimum-in-rotated-sorted-array': `def lowest_bearing(nums):
    lo, hi = 0, len(nums) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] > nums[hi]:
            lo = mid + 1
        else:
            hi = mid
    return nums[lo]
`,
  'number-of-islands': `def count_landmasses(grid):
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    seen = set()
    def walk(row, col):
        if row < 0 or col < 0 or row >= rows or col >= cols:
            return
        if (row, col) in seen or grid[row][col] != "1":
            return
        seen.add((row, col))
        walk(row + 1, col)
        walk(row - 1, col)
        walk(row, col + 1)
        walk(row, col - 1)
    count = 0
    for row in range(rows):
        for col in range(cols):
            if grid[row][col] == "1" and (row, col) not in seen:
                walk(row, col)
                count += 1
    return count
`,
  'course-schedule': `def can_commission_route(num_courses, prerequisites):
    graph = [[] for _ in range(num_courses)]
    indegree = [0] * num_courses
    for course, prior in prerequisites:
        graph[prior].append(course)
        indegree[course] += 1
    queue = [index for index, degree in enumerate(indegree) if degree == 0]
    finished = 0
    while queue:
        node = queue.pop()
        finished += 1
        for nxt in graph[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return finished == num_courses
`,
  'number-of-provinces': `def count_fleets(is_connected):
    count_nodes = len(is_connected)
    seen = set()
    def walk(node):
        for other in range(count_nodes):
            if is_connected[node][other] and other not in seen:
                seen.add(other)
                walk(other)
    fleets = 0
    for node in range(count_nodes):
        if node not in seen:
            seen.add(node)
            walk(node)
            fleets += 1
    return fleets
`,
  'longest-consecutive-sequence': `def longest_code_run(nums):
    pool = set(nums)
    best = 0
    for value in pool:
        if value - 1 in pool:
            continue
        cursor = value
        length = 1
        while cursor + 1 in pool:
            cursor += 1
            length += 1
        best = max(best, length)
    return best
`,
}
