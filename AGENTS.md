## File Exploration Principles
- You MAY explore files to gather context, but exploration must always be
  **bounded, scoped, and non-repetitive**.
- Never explore a file blindly. Always state the reason for reading a file
  and what specific information you expect to extract.

## File Read Limits
- Never read the same file path more than once per task.
- Maximum of **3 total file-read operations** per subtask (full reads + view_range).
- If a file is larger than ~50 KB (or appears truncated), DO NOT attempt a full read.
  Switch immediately to `view_range`.

## Handling Truncated or Empty Reads
- If a read returns truncated, empty, or obviously incomplete content:
  - Do NOT retry the same read.
  - Switch to `view_range` with explicit line numbers.
  - If `view_range` also fails or returns incomplete content, STOP and ask the user
    for the exact line range or a code snippet.

## View Range Rules
- When using `view_range`, always specify:
  - file path
  - start line
  - end line
- Never request overlapping or repeated ranges.
- Never request more than 200 lines at once.

## Escalation Rules
- If you cannot obtain the needed content after:
  - one full read attempt (or zero, if file is large)
  - one view_range attempt
  …then escalate to the user instead of retrying.

## No Retry Loops
- You must NEVER:
  - repeat the same read request
  - re-issue a failed read
  - attempt to “try again” without new parameters
- If you detect that you are about to repeat an action, STOP and escalate.

## Summary Behavior
- If you only receive partial content, summarize what you have.
- Proceed with best-effort reasoning unless the missing content is critical.
- If critical content is missing, ask the user for the exact snippet.

## Session Memory
- At the start of each subtask, list all files already read this session.
- Do not re-read any file on that list.