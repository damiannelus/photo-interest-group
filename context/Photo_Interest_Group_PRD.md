# Product Requirements Document (PRD): Photo Interest Group (MVP)

## 1. Project Goal
To create a closed, private space for a select group of photographer friends that promotes substantive discussion and skill development through photo submissions with mandatory self-reflection and a "Follow-Up Challenge" mechanism.

## 2. Core Rules (Domain Logic)
* **Self-Reflection as a Gatekeeper:** Each `Submission` (photo) must include a `Reflection` note. The "Publish" button remains disabled until this field is populated.
* **Chain of Inspiration (Follow-Up):** Each `Submission` can be initiated as a "Follow-Up" to an existing photo, inheriting the context of the source exercise and building a logical tree of threads.
* **Access:** Shared-access authentication via Firebase Auth (Google Provider). Access is restricted to a curated list of trusted email addresses enforced by Firestore Security Rules.

## 3. Data Architecture (Firestore Schema)

| Collection | Key Fields |
| :--- | :--- |
| `challenges` | `id`, `title`, `description`, `created_at` |
| `submissions` | `id`, `challenge_id`, `photo_url`, `reflection` (text), `parent_submission_id` (optional), `user_id`, `created_at` |
| `comments` | `id`, `submission_id`, `user_id`, `text`, `created_at` |

## 4. MVP Scope (Week 1)
* **Authentication:** Firebase Auth (Google).
* **Main View:** Feed/List of challenges and their corresponding photo submissions.
* **Core Action:** A form for submitting photos that mandates the "Autoreflection" field.
* **Follow-Up Mechanism:** A "Reply/Follow-Up" button on existing submissions that opens the submission form with pre-filled context.
* **Feedback:** A lightweight comment system attached to each submission.

## 5. Acceptance Criteria (E2E Tests)
* **Validation:** A user CANNOT submit a photo without completing the "Autoreflection" field.
* **Relational Integrity:** Clicking "Follow-Up" creates a new `submission` in the database with the correct `parent_submission_id`.
* **CI/CD:** Every commit to the `main` branch triggers automated tests (validating form logic) and deploys the application to Firebase Hosting.
