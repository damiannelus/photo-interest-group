---
project: "Photo Interest Group"
version: 1
status: active
created: 2026-06-16
updated: 2026-06-16
---

# Test Plan: Photo Interest Group

> Derived from `context/foundation/prd.md` (v1) + `context/foundation/roadmap.md` (v1) + Phase 2 user interview 2026-06-16.
> Edit §3 status in-place as the rollout advances. Archive when superseded. Never add file:line anchors to §1 or §2.

---

## §1 Strategy

Three principles every rollout phase and every individual test must satisfy.

**1. Cost × signal.** Every test added — classic or AI-native — must answer one question: *what is the cheapest test that gives a real signal for this risk?* Do not promote to e2e because it "feels safer." Do not layer automation on top of a deterministic unit test that already catches the regression.

**2. User concerns are evidence.** Risks the team has lived through or fears carry the same weight as PRD lines or hot-spot data. The Phase 2 interview surfaced data loss (Q1) and frontend-Firebase sync / nesting correctness (Q3) as the owner's primary concerns; these drove risk ordering.

**3. Risks are scenarios, not code locations.** §2 cites PRD lines, interview answers, and hot-spot directories as likelihood evidence. It does not cite file paths, function names, or line numbers as failure anchors — those are `/10x-research` outputs produced per rollout phase against the current code.

---

## §2 Risk Map

### Top risks

| # | Risk (failure scenario) | Impact | Likelihood | Source(s) — evidence, not anchors |
|---|---|---|---|---|
| R1 | **Reflection gate whitespace bypass** — a direct Firestore write with 50+ bytes of whitespace is accepted by the rule (`reflection.size() >= 50` checks bytes, not trimmed non-whitespace), publishing a substantively empty reflection and undermining the core product hypothesis | High | Low | PRD guardrail "no UI path or direct API call bypasses this"; FR-007 "at least 50 characters"; `firestore.rules` submission create rule |
| R2 | **Rule change locks members out of existing data** — a future Firestore rule edit breaks `isWhitelisted()` or a collection path, making past submissions, comments, or challenges unreadable; members experience this as data loss | High | Medium | Q1 (user's #1 fear: "losing past data friends provided"); hot-spot dir `app/routes/` 15 commits/30d |
| R3 | **`buildSubmissionTree` drops or misorders submissions** — the tree builder fails for Firestore docs where `parent_submission_id` is `undefined` (field absent on old docs, not `null`), silently dropping submissions from the feed | High | Medium | Q1 (data loss fear); Q3 (low confidence in nesting); hot-spot dir `app/routes/` 10 commits on primary route file; S-03 archive plan explicit `?? null` guard |
| R4 | **Follow-up written with wrong `parent_submission_id`** — a follow-up Firestore document lands with a null or incorrect parent ID, silently breaking the inspiration chain | High | Low | PRD guardrail "broken parent links treated as critical bugs, not UI issues"; FR-010 |
| R5 | **Whitelist gate bypassed via direct Firestore call** — an authenticated non-member reads submissions or comments by calling the Firestore API directly, bypassing the client-only `VITE_ALLOWED_EMAILS` check | High | Low | PRD NFR "not via the UI and not via any direct Firestore URL"; FR-002; `firestore.rules` `isWhitelisted()` function |
| R6 | **Real-time listener not cleaned up on unmount** — an `onSnapshot` subscription left running after component unmount causes duplicate data events, stale state, or memory pressure on re-mount | Medium | Medium | Q3 (low confidence in frontend-Firebase sync); hot-spot dir `app/routes/` dominant churn; `mountedRef` guard pattern in codebase |
| R7 | **Trim-consistency regression reintroduced** — a future edit to a gated textarea breaks display/gate parity so the counter advances on whitespace input while the publish button stays disabled, repeating the documented regression | Low | Medium | `context/foundation/lessons.md` one documented regression; hot-spot dir `app/routes/` 10 commits on primary route file |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context needed (for `/10x-research`) | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| R1 | A direct Firestore write with `reflection` set to 50+ whitespace characters is rejected with permission denied; a write with exactly 50 non-whitespace characters succeeds | "The client trims before writing so the server rule is equivalent" — a direct API call bypasses the client trim entirely | Exact semantics of Firestore `.size()` (byte count vs. character count); Firebase emulator setup; whether any non-UI write path exists | Firestore emulator security rules test (`@firebase/rules-unit-testing`) | Testing only the UI gate; the PRD explicitly mandates server-side enforcement — must probe the rule directly |
| R2 | After a rule change, all existing read patterns — member reads challenges, submissions, and comments — still succeed; a non-member is still blocked on every path | "Manual testing after each deploy is sufficient" — rule changes can silently break access patterns not explicitly re-verified | Complete list of collection paths and operations in current use; how `isWhitelisted()` resolves the `/members/{email}` doc | Firestore emulator security rules test suite covering every collection and operation | Testing only happy-path member access; must test non-member and unauthenticated rejection on all paths |
| R3 | Given a flat submission list mixing `undefined`, `null`, and real-ID `parent_submission_id` values, the function groups undefined/null as roots and real IDs as children; children are ordered ascending by timestamp; no submissions are dropped | "It renders fine in the browser" — manual visual check misses edge-case inputs with absent fields | The `buildSubmissionTree` function signature and its treatment of `undefined` vs. `null` keys in the map; how `createdAt` Timestamps are compared | Unit test (pure function — no Firebase, no React needed) | Testing only well-formed fully-populated data; must test `undefined` parent field (pre-S-03 Firestore docs) |
| R4 | The written follow-up Firestore document has `parent_submission_id` equal to the exact document ID of the parent submission (not null, not a stale ID) | "The form pre-fills the parent ID correctly so it's always right" — form state could capture a stale or wrong ID | How `submission.id` flows into the follow-up `addDoc` call; what the emulator returns as the written document | Firestore emulator integration test — write a follow-up, read the document back, assert the field value | Asserting `parent_submission_id` exists without comparing it to the actual parent document ID |
| R5 | An authenticated Firestore request from a non-member email is rejected for all read and write operations on challenges, submissions, and comments | "The UI blocks non-members from reaching the app so they can't reach Firestore" | `isWhitelisted()` rule and `/members/{email}` doc existence check; all three collection paths and their operation types | Firestore emulator security rules test — simulate an authenticated non-member token | Testing only member access; must test non-member rejection on every collection and operation type |
| R6 | Mounting then unmounting the challenge feed component leaves no active Firestore subscriptions; toggling the comment section open/closed starts exactly one listener per toggle and cleans it up on close | "The `useEffect` cleanup return value handles it" — cleanup logic can drift with future edits to the component | The `onSnapshot` call site, its returned unsubscribe function, and the `useEffect` cleanup pattern in `app/routes/` | Unit test with mocked `onSnapshot` that returns a tracked unsubscribe spy; assert the spy is called on cleanup | Mocking so deeply that the test validates the mock pattern, not the real cleanup contract |
| R7 | For every gated textarea in the app, typing whitespace characters up to or past the minimum length displays count 0, button stays disabled; only non-whitespace characters advance the counter and enable the button | "The bug was fixed once so it won't recur" — the primary route file has 10 commits in 30 days, making reintroduction plausible | The `canPublish`, `canPost`, `canFollowUp` derived constants and their corresponding display expressions; all gated forms in the app | Unit test of extracted gate predicate functions | End-to-end browser test — a unit test of the gate predicates catches the same regression at a fraction of the cost |

### Negative space (explicit do-not-test)

- **Firebase SDK internals** — the SDK is Google's responsibility; mocking it tests the mock, not behavior.
- **Pixel-level UI snapshot tests** — will break on every Tailwind change and catch nothing real.
- **Google OAuth flow** — Firebase Auth SDK handles it; testing it means testing Google's infrastructure.
- **Admin/console operations** — whitelist management happens out-of-band via the Firebase Console; no in-app test surface exists.

---

## §3 Phased Rollout

Status vocabulary (parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`

| # | Phase name | Goal | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Unit layer — pure logic | Bootstrap Vitest; prove `buildSubmissionTree`, gate predicates (`canPublish`/`canPost`/`canFollowUp`), whitelist normalization, and listener cleanup contract are correct | R3, R6, R7 | Vitest unit tests | complete | context/changes/testing-unit-layer/ |
| 2 | Firestore rules layer | Automate security rules verification: whitelist enforcement, reflection gate (including whitespace bypass), ownership rules, non-member rejection on all collection paths | R1, R2, R4, R5 | Firebase emulator + `@firebase/rules-unit-testing` | not started | — |
| 3 | CI quality gate | Run unit + rules tests in GitHub Actions on every push; make typecheck a required PR check | All | GitHub Actions CI | not started | — |

---

## §4 Stack

- **Language / runtime:** TypeScript 5.9, Node (build only), browser SPA
- **Framework:** React 19 + React Router 7.16, Vite 8
- **Backend / data:** Firebase 12 — Firestore (data + security rules), Firebase Auth (Google Sign-In)
- **Styling:** Tailwind CSS 4
- **Test infra (current):** none — no Vitest, Jest, or Playwright in `package.json`; 0 test files in project
- **Test infra (planned):**
  - Phase 1: Vitest (natural fit — same Vite config, ESM, TypeScript out of the box)
  - Phase 2: Firebase Local Emulator Suite + `@firebase/rules-unit-testing`
  - Phase 3: GitHub Actions (CI already wired for deploy; add test step)
- **Stack grounding tools (current session):**
  - Docs: Context7 MCP — available; checked: 2026-06-16 (use for Vitest config, `@firebase/rules-unit-testing` API, React Router patterns)
  - Search: not available in current session
  - Runtime/browser: not available in current session
  - Provider/platform: not available (GitHub Actions wired but no MCP)

---

## §5 Review cadence

Re-run `/10x-test-plan --refresh` when:
- A new top-3 risk surfaces (new feature, incident, or architectural change)
- A tool's `checked:` date is > 3 months old
- The tech stack changes (e.g., Firestore replaced, Vitest version jump with breaking API change)
- §7 negative space no longer matches what the team believes

---

## §6 Cookbook (populated as rollout phases ship)

### Phase 1 patterns (TBD — see §3 Phase 1)

- `buildSubmissionTree` correctness: TBD — pure function unit test; inputs: flat submission arrays with `undefined`/`null`/real parent IDs; oracle: expected grouped map and child ordering
- Gate predicate correctness (trim-consistency): TBD — unit tests of `canPublish`/`canPost`/`canFollowUp` with whitespace-only inputs at the boundary
- Listener cleanup contract: TBD — unit test with mocked `onSnapshot` unsubscribe spy; assert called on unmount and on toggle-close

### Phase 2 patterns (TBD — see §3 Phase 2)

- Reflection gate (whitespace bypass): TBD — emulator rules test; write with `reflection: " ".repeat(50)` → expect denied; write with 50 non-whitespace chars → expect allowed
- Whitelist enforcement: TBD — emulator rules test; non-member authenticated token → expect denied on all collection reads/writes
- Ownership rules: TBD — emulator rules test; member tries to update another member's submission → expect denied
- Follow-up `parent_submission_id` integrity: TBD — emulator integration test; write a follow-up, read back, assert field value equals parent document ID

### Phase 3 patterns (TBD — see §3 Phase 3)

- CI gate: TBD — GitHub Actions workflow step; `npm test` must exit 0 before deploy step runs; `npm run typecheck` must exit 0 as required PR check

---

## §7 Assumptions and constraints

- The app is a static SPA deployed to Firebase Hosting; all server-side enforcement is via Firestore Security Rules. There is no Node middleware layer to test.
- The group is 5–15 trusted members. Rate-limit bypass and mass-account abuse are out of scope for MVP testing.
- Photo URLs are stored as-is (no server-side validation beyond non-empty); broken image rendering is accepted behavior per MVP scope.
- `VITE_ALLOWED_EMAILS` is a client-side UX gate only (exposed in the JS bundle by design); the authoritative whitelist enforcement is `isWhitelisted()` in Firestore rules.
