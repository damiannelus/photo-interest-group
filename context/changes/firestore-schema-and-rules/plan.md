# Firestore Schema + Security Rules Implementation Plan

## Overview

Define the Firestore data model for the Photo Interest Group app (challenges, submissions, comments), write and deploy security rules that enforce the member-only whitelist and the 50-character reflection gate at the database level, and seed one challenge document for downstream slice testing. This is the server-side enforcement layer; Firestore rules are the only thing standing between user data and the open internet in a static SPA.

## Current State Analysis

- Firebase project `photo-interest-group` is live; Firebase Hosting is deployed (F-01 complete).
- `firebase.ts` exports `app` (and will export `auth` + `db` once F-02 Phase 1 runs — F-02 and F-03 are parallel; see Critical Implementation Details).
- No Firestore SDK usage anywhere in the app.
- No `firestore.rules` file exists.
- `firebase.json` currently declares only `"hosting"` — no `"firestore"` key.
- The PRD requires: challenges (FR-004, FR-005), submissions with 50-char reflection gate (FR-006, FR-007, FR-008) and follow-up chain (FR-009, FR-010), comments (FR-011, FR-012).
- The NFR mandates: no data accessible to unauthenticated users or non-whitelisted members, not via UI or direct Firestore calls.

## Desired End State

- `firestore.rules` is committed to the repo and deployed via `firebase deploy --only firestore:rules`.
- Security rules enforce:
  - Only authenticated users whose email exists as a doc in `/members/{email}` can read or write any collection.
  - `submissions` create rule rejects writes where `reflection.size() < 50`.
  - `members` collection is read-only via rules (write-disabled; managed via Firebase Console).
- `/members` collection is seeded with member emails via Firebase Console.
- One seed challenge document exists in `/challenges` for S-01 and S-02 testing.
- `firebase.json` declares the `firestore.rules` path so `firebase deploy --only firestore:rules` works from the repo.

### Key Discoveries

- **Email-as-doc-ID for `members`**: `members/{email}` (not `members/{uid}`) allows pre-seeding before any member has signed in. Rules check `exists(/databases/$(database)/documents/members/$(request.auth.token.email))` — one existence check, no data read.
- **Comments as subcollection**: `submissions/{submissionId}/comments/{commentId}` co-locates comments with their parent, allows security rules to inherit context, and simplifies Firestore queries in S-04.
- **50-char gate in rules**: `request.resource.data.reflection.size() >= 50` on `submissions` create enforces the PRD guardrail server-side. This is in F-03 (not S-02) so downstream slices inherit it without touching rules.
- **`parent_submission_id` as nullable string**: Null for root submissions, the parent doc ID string for follow-ups. Stored flat on the `submissions` document; queryable with `where("parent_submission_id", "==", someId)`.
- **F-02 parallel dependency**: F-03 imports `db` from `~/firebase`. F-02 Phase 1 adds the `db` export to `firebase.ts`. If F-03 is implemented before F-02 Phase 1, add `export const db = getFirestore(app)` to `firebase.ts` as part of this plan's Phase 1.

## What We're NOT Doing

- No Firestore SDK usage in React components (that's S-01 and later slices).
- No Firebase Storage (photo URLs are pasted strings — FR-006 decision).
- No Cloud Functions / server-side triggers.
- No invite-link or in-app whitelist management (FR-003 is nice-to-have, post-MVP).
- No Firestore indexes beyond the default (will add composite indexes when S-01 query patterns are known).
- No Firebase Emulator Suite setup — rules are tested against the live project for MVP.

## Implementation Approach

Two phases:

1. **Schema + rules file** — extend `firebase.json`, write `firestore.rules` with all collections and the whitelist + reflection gate, and prepare `db` export in `firebase.ts` (if F-02 hasn't done it yet).
2. **Deploy + seed** — deploy rules via CLI, seed `/members` documents and one challenge via Firebase Console, verify everything in Firestore Console.

## Critical Implementation Details

**F-02 parallel dependency on `firebase.ts`:** Both F-02 and F-03 need to add exports to `firebase.ts`. F-02 Phase 1 adds `auth` AND `db`. If F-02 runs first, F-03 Phase 1 should skip the `firebase.ts` change (just import `db` from the existing export). If F-03 runs first or in parallel, F-03 Phase 1 adds `db` (and optionally `auth`) to `firebase.ts`. The implementer should check whether `db` is already exported before adding it to avoid a duplicate-declaration error.

**`request.auth.token.email` availability:** For Google Sign-In users, `request.auth.token.email` is always populated. The `isWhitelisted()` function in the rules relies on this. If a non-Google auth provider is ever added (post-MVP), the rules will need revisiting.

**Deploying rules requires Blaze plan:** The project is already on Blaze (F-01 Phase 2). `firebase deploy --only firestore:rules` will work without hitting Spark limits.

**Rules simulator gotcha:** The Firebase Console Rules Playground uses simulated tokens. Always test with a real browser session (actual sign-in) to validate `token.email` claims, not just the simulator.

---

## Phase 1: Firestore Config + Rules File

### Overview

Wire `firebase.json` to declare the rules file, write `firestore.rules` with the complete security model, and ensure `app/firebase.ts` exports `db`.

### Changes Required

#### 1. Add Firestore config to firebase.json

**File**: `firebase.json`

**Intent**: Tell the Firebase CLI where the Firestore rules file lives so `firebase deploy --only firestore:rules` works.

**Contract**: Add a top-level `"firestore"` key alongside `"hosting"`:
```json
{
  "hosting": { ... },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

#### 2. Write firestore.rules

**File**: `firestore.rules` (new, repo root)

**Intent**: Enforce that only authenticated, whitelisted members can read or write any data. Enforce the 50-character reflection gate on submission creates. Lock the `members` collection against writes from client SDKs.

**Contract**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isWhitelisted() {
      return request.auth != null &&
             exists(/databases/$(database)/documents/members/$(request.auth.token.email));
    }

    match /challenges/{challengeId} {
      allow read: if isWhitelisted();
      allow create: if isWhitelisted();
      allow update, delete: if isWhitelisted() &&
                               request.auth.uid == resource.data.createdBy;
    }

    match /submissions/{submissionId} {
      allow read: if isWhitelisted();
      allow create: if isWhitelisted() &&
                       request.auth.uid == request.resource.data.authorUid &&
                       request.resource.data.reflection.size() >= 50;
      allow update, delete: if isWhitelisted() &&
                               request.auth.uid == resource.data.authorUid;

      match /comments/{commentId} {
        allow read: if isWhitelisted();
        allow create: if isWhitelisted() &&
                         request.auth.uid == request.resource.data.authorUid;
        allow delete: if isWhitelisted() &&
                         request.auth.uid == resource.data.authorUid;
      }
    }

    match /members/{email} {
      allow read: if request.auth != null && request.auth.token.email == email;
      allow write: if false;
    }
  }
}
```

The snippet is necessary here because the rule ordering, the `isWhitelisted()` function signature, and the reflection size check are all load-bearing — downstream slices (S-01 through S-04) depend on this exact structure.

#### 3. Export db singleton from firebase.ts

**File**: `app/firebase.ts`

**Intent**: Make the Firestore instance available to the app. Skip this change if F-02 Phase 1 has already added `export const db = getFirestore(app)`.

**Contract**: Import `getFirestore` from `"firebase/firestore"`. After the existing `export const app = initializeApp(firebaseConfig)` line, add `export const db = getFirestore(app)`. If `auth` is not yet exported (F-02 not yet run), also add `import { getAuth } from "firebase/auth"` and `export const auth = getAuth(app)` for completeness.

### Success Criteria

#### Automated Verification

- `npm run typecheck` exits 0
- `npm run build` exits 0
- `firebase deploy --only firestore:rules` exits 0 (run in a real terminal after the above)

#### Manual Verification

- Firebase Console → Firestore → Rules tab shows the deployed rules text matching `firestore.rules`
- Firebase Console → Rules Playground: simulate a read on `/challenges/test` as an unauthenticated user → should be denied
- Firebase Console → Rules Playground: simulate a create on `/submissions/test` with `reflection: "short"` (< 50 chars) as an authenticated user → should be denied

**Implementation Note**: Pause for manual confirmation of the rules deployment and playground tests before Phase 2.

---

## Phase 2: Deploy + Seed Data

### Overview

Deploy the rules to the live Firestore project, populate the `/members` collection with member emails, and add one seed challenge document. This phase is entirely manual (CLI deploy + Firebase Console UI).

### Changes Required

#### 1. Deploy Firestore rules

**Command** (run in a real terminal): `firebase deploy --only firestore:rules`

**Intent**: Push the committed `firestore.rules` to the live project so the security model is active.

#### 2. Seed /members collection

**Target**: Firebase Console → Firestore → Data tab

**Intent**: Populate `/members/{email}` documents so the `isWhitelisted()` function has data to check. One document per member. The document ID is the member's email address (lowercase). Document body can be minimal — just `{ "email": "<email>" }` — or empty; the rules only check existence.

**Contract**: For each member (including your own account), create a document at `/members/{their-email-address}`. Example: document ID `damiannelus@gmail.com`, body `{ "email": "damiannelus@gmail.com" }`.

#### 3. Seed one challenge document

**Target**: Firebase Console → Firestore → Data tab

**Intent**: Create one active challenge so S-01 (feed) and S-02 (submission) can be tested without S-05 (challenge creation UI) being complete.

**Contract**: Create a document in `/challenges` (let Firestore auto-generate the ID). Fields:

| Field | Value |
|---|---|
| `title` | `First Light` |
| `description` | `Share a photo that captures your relationship with early morning light — what draws you to it, or keeps you away.` |
| `createdBy` | Your Firebase Auth UID (find it in Firebase Console → Authentication → Users after your first sign-in) |
| `createdAt` | Use the timestamp picker in the Console |
| `status` | `active` |

### Success Criteria

#### Automated Verification

- `firebase deploy --only firestore:rules` exits 0 (CLI)

#### Manual Verification

- Firebase Console → Firestore → Rules tab shows updated rules timestamp matching today's deploy
- Sign in to the app (once F-02 is complete) as a whitelisted member → app loads with no permission-denied errors in the console
- Attempt a direct Firestore read from the browser console as a non-whitelisted user → `FirebaseError: Missing or insufficient permissions`
- Attempt a submission write with a short reflection (< 50 chars) from the browser console → `FirebaseError: Missing or insufficient permissions`
- Firebase Console → Firestore → Data shows `/members/{your-email}` and `/challenges/{seed-id}` documents

**Implementation Note**: This phase is all manual steps. No code commits needed after Phase 1's commit. Confirm all manual checks pass.

---

## Data Model Reference

```
/challenges/{challengeId}
  title:       string       — display title
  description: string       — challenge prompt
  createdBy:   string       — Firebase Auth UID of creator
  createdAt:   Timestamp
  status:      "active" | "closed"

/submissions/{submissionId}
  challengeId:           string     — ID of parent /challenges doc
  photoUrl:              string     — URL to hosted image (FR-006)
  reflection:            string     — min 50 chars, enforced in rules
  authorUid:             string     — Firebase Auth UID
  authorEmail:           string     — denormalized for display
  createdAt:             Timestamp
  parent_submission_id:  string | null   — null for root; parent doc ID for follow-ups (FR-010)

/submissions/{submissionId}/comments/{commentId}
  text:        string
  authorUid:   string
  authorEmail: string
  createdAt:   Timestamp

/members/{email}            — email is the document ID
  email:       string       — redundant but useful for queries / display
```

## Testing Strategy

### Manual Testing Steps

1. Deploy rules → verify in Console → simulate denied reads as unauthenticated (Rules Playground)
2. Sign in with a whitelisted member email → navigate the app → no permission-denied errors
3. Open browser DevTools console → attempt `getDoc(doc(db, "challenges", "fake"))` without being signed in → should throw permission denied
4. Attempt to submit with a 49-char reflection (pad with spaces to count) → should throw permission denied
5. Verify seed challenge appears correctly in Firestore Console with all fields

## Performance Considerations

The `isWhitelisted()` function does one `exists()` call per security rule evaluation. Firestore rule reads are not billed and do not count against read quotas, so this has no cost impact at 5–15 members.

## Migration Notes

No existing data. The `members` collection is the bootstrapping dependency — it must be seeded before anyone can use the app post-F-02. The first member seeded should be your own email so you can validate the full flow.

## References

- PRD: `context/foundation/prd.md` — FR-004 through FR-012, NFR data access
- Infrastructure research: `context/foundation/infrastructure.md` — risk register entry on Firestore Security Rules
- Roadmap F-03: `context/foundation/roadmap.md`
- Firebase Agent Skills: `.agents/skills/firebase-firestore/references/standard/security_rules.md`
- Sibling plan (F-02): `context/changes/auth-whitelist-gate/plan.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Firestore Config + Rules File

#### Automated

- [x] 1.1 `npm run typecheck` exits 0 — 9c8e6a1
- [x] 1.2 `npm run build` exits 0 — 9c8e6a1
- [x] 1.3 `firebase deploy --only firestore:rules` exits 0 — 9c8e6a1

#### Manual

- [x] 1.4 Firebase Console → Rules tab shows deployed rules matching firestore.rules — 9c8e6a1
- [x] 1.5 Rules Playground: unauthenticated read on /challenges denied — 9c8e6a1
- [x] 1.6 Rules Playground: submission create with short reflection denied — 9c8e6a1

### Phase 2: Deploy + Seed Data

#### Automated

- [x] 2.1 `firebase deploy --only firestore:rules` exits 0

#### Manual

- [x] 2.2 Whitelisted sign-in produces no permission-denied errors in console
- [x] 2.3 Direct Firestore read without auth throws permission denied
- [x] 2.4 Submission write with <50 char reflection throws permission denied
- [x] 2.5 /members/{your-email} document exists in Firestore Console
- [x] 2.6 Seed challenge document exists in /challenges with all required fields
