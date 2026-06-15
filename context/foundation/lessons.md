# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Trim-consistent gate and display

- **Context**: `app/routes/challenges.tsx` — character counter in comment form (surfaced in S-04 impl review)
- **Problem**: Character counter used raw `.length` for display color and value while `canPost` validated on `.trim().length`. A user typing only whitespace (10 spaces) saw the counter turn green and read "10 / 10 characters", but the Post button stayed disabled — the UI misled the user about their progress toward the gate.
- **Rule**: When a form field gate uses `.trim().length`, all visual feedback tied to that gate (counter label, color threshold, progress indicator) must also use `.trim().length`. Raw `.length` and trimmed `.length` must never diverge in the same gate/display pair.
- **Applies to**: Any form in this app with a character minimum gate and a live counter — currently the reflection textarea (S-02) and the comment textarea (S-04). Check both when adding new gated inputs.
