"""Public room copy for the coding terminal.

Each room shows one seed diagnostic so the page has a brief, samples, and starter.
Live LeetCode assignment replaces the title, id, and link in a later phase.
Hidden tests stay out of this module.
"""

ROOMS = [
    {
        "room": 1,
        "name": "Crew Quarters",
        "chapter": "The First Signal",
        "story": (
            "You find a damaged emergency terminal beside an abandoned bunk. "
            "A security prompt flashes across the screen. The ship requires a "
            "successful diagnostic before the hallway doors can reopen."
        ),
        "success": "ACCESS GRANTED. CORRIDOR LIGHTING RESTORED.",
        "slug": "search-insert-position",
        "question_id": "35",
        "title": "Search Insert Position",
        "difficulty": "Easy",
        "category": "Arrays",
        "metadata_source": "seed",
        "leetcode_url": "https://leetcode.com/problems/search-insert-position/",
        "statement": """A list of probe ids is already sorted in ascending order. Every id is unique.

Return the index where target should be inserted so the list stays sorted. If target is already present, return that index.

Constraints:
- 1 <= len(nums) <= 10_000
- The list is sorted ascending and contains distinct integers.""",
        "starter_code": '''from typing import List

def search_insert(nums: List[int], target: int) -> int:
    """Ship diagnostic. Replace the placeholder."""
    return 0
''',
        "samples": [
            {"label": "Sample A", "args": [[1, 3, 5, 6], 5], "expected": 2},
            {"label": "Sample B", "args": [[1, 3, 5, 6], 2], "expected": 1},
        ],
        "hints": [
            "Because the ledger is sorted, each comparison can throw away half of the remaining ids.",
            "Keep a half-open window [lo, hi). When it collapses, lo is the insertion index.",
            "If the midpoint is still below the target, move the left edge past it. Otherwise move the right edge onto the midpoint.",
        ],
    },
    {
        "room": 2,
        "name": "Engine Room",
        "chapter": "Power in the Darkness",
        "story": (
            "The engine room is almost completely dark. The auxiliary generators "
            "are offline. A maintenance terminal displays a corrupted diagnostic program."
        ),
        "success": "GENERATOR ONLINE. AUXILIARY POWER RESTORED.",
        "slug": "valid-palindrome",
        "question_id": "125",
        "title": "Valid Palindrome",
        "difficulty": "Easy",
        "category": "Strings",
        "metadata_source": "seed",
        "leetcode_url": "https://leetcode.com/problems/valid-palindrome/",
        "statement": """Decide whether s is a palindrome after this cleanup:

- Ignore every character that is not a letter or digit.
- Compare letters without caring about case.

Return True or False.

Constraints:
- 0 <= len(s) <= 20_000
- s may contain letters, digits, spaces, and punctuation""",
        "starter_code": '''def door_phrase_is_palindrome(s: str) -> bool:
    """GlitchLab room function. Replace the placeholder."""
    return False
''',
        "samples": [
            {"label": "Sample A", "args": ["Lab 1 — 1 bal"], "expected": True},
            {"label": "Sample B", "args": ["glitch"], "expected": False},
        ],
        "hints": [
            "Build a cleaned string of lowercase letters and digits, or compare with two pointers that skip junk.",
            "A phrase is valid when the cleaned sequence equals its reverse.",
            "Move the two pointers toward the middle. Skip anything that is not a letter or a digit before you compare.",
        ],
    },
    {
        "room": 3,
        "name": "Communications Room",
        "chapter": "The Distress Call",
        "story": (
            "Static fills the speakers. The distress transmitter is functional, "
            "but the communication protocol is locked behind a programming diagnostic."
        ),
        "success": "DISTRESS SIGNAL TRANSMITTED. COORDINATES RECEIVED.",
        "slug": "decode-string",
        "question_id": "394",
        "title": "Decode String",
        "difficulty": "Medium",
        "category": "Strings",
        "metadata_source": "seed",
        "leetcode_url": "https://leetcode.com/problems/decode-string/",
        "statement": """A distress code uses digits, letters, and brackets.

k[word] means word repeated k times. Codes can nest.

Return the expanded message.

Constraints:
- 1 <= len(code) <= 100
- k is a positive integer""",
        "starter_code": '''def expand_distress_code(code: str) -> str:
    """Replace the placeholder."""
    return ""
''',
        "samples": [
            {"label": "Sample A", "args": ["2[ab]"], "expected": "abab"},
            {"label": "Sample B", "args": ["3[a2[c]]"], "expected": "accaccacc"},
        ],
        "hints": [
            "When you see an opening bracket, pause the current text and remember the repeat count.",
            "A stack of (text so far, repeat count) handles nesting.",
            "Digits can have more than one character. Build the number until you hit a bracket.",
        ],
    },
    {
        "room": 4,
        "name": "Navigation Room",
        "chapter": "Finding the Way Home",
        "story": (
            "The navigation computers are on, but the route planner is corrupted. "
            "The ship cannot find a safe passage through the storm."
        ),
        "success": "ROUTE CALCULATED. BRIDGE ACCESS AUTHORIZED.",
        "slug": "number-of-islands",
        "question_id": "200",
        "title": "Number of Islands",
        "difficulty": "Medium",
        "category": "Searching",
        "metadata_source": "seed",
        "leetcode_url": "https://leetcode.com/problems/number-of-islands/",
        "statement": """A chart is a grid of "1" (land) and "0" (water).

Land cells connect up, down, left, and right. Return how many islands the chart contains.

Constraints:
- 1 <= rows, cols <= 50""",
        "starter_code": '''from typing import List

def count_landmasses(grid: List[List[str]]) -> int:
    """Ship diagnostic. Replace the placeholder."""
    return 0
''',
        "samples": [
            {
                "label": "Sample A",
                "args": [[["1", "0", "1"], ["0", "0", "1"], ["1", "0", "0"]]],
                "expected": 3,
            },
            {
                "label": "Sample B",
                "args": [[["1", "1"], ["1", "0"]]],
                "expected": 1,
            },
        ],
        "hints": [
            "Each unvisited land cell can start a new island.",
            "A depth-first or breadth-first walk marks every connected land cell as seen.",
            "Count one island per time you start a walk, not once per land cell.",
        ],
    },
    {
        "room": 5,
        "name": "The Bridge",
        "chapter": "The Final Command",
        "story": (
            "Rain covers the bridge windows. Towering waves sit ahead. "
            "The steering system is locked. One last diagnostic stands between you and the helm."
        ),
        "success": "ALL SYSTEMS RESTORED. COURSE SET FOR HOME.",
        "slug": "course-schedule",
        "question_id": "207",
        "title": "Course Schedule",
        "difficulty": "Medium",
        "category": "Graphs",
        "metadata_source": "seed",
        "leetcode_url": "https://leetcode.com/problems/course-schedule/",
        "statement": """There are numCourses helm checks, labeled 0 through numCourses - 1.

prerequisites[i] = [course, prior] means prior must be finished before course.

Return True if every check can be ordered, and False if the dependencies loop.

Constraints:
- 1 <= numCourses <= 2_000
- 0 <= len(prerequisites) <= 5_000""",
        "starter_code": '''from typing import List

def can_commission_route(num_courses: int, prerequisites: List[List[int]]) -> bool:
    """Ship diagnostic. Replace the placeholder."""
    return False
''',
        "samples": [
            {"label": "Sample A", "args": [2, [[1, 0]]], "expected": True},
            {"label": "Sample B", "args": [2, [[1, 0], [0, 1]]], "expected": False},
        ],
        "hints": [
            "This is a directed graph. A loop means some check can never be started.",
            "Track how many prerequisites each course still needs.",
            "Start from courses with none, and reduce the counts of what they unlock. You can finish only if every course is reached.",
        ],
    },
]


def room_by_number(number):
    return next((room for room in ROOMS if room["room"] == number), None)
