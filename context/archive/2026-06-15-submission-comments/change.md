---
id: submission-comments
title: "Submission Comments (S-04)"
status: archived
created: 2026-06-15
updated: 2026-06-15
archived_at: 2026-06-15T18:42:34Z
reviewed_at: 2026-06-15
implemented_at: 2026-06-15
roadmap_id: S-04
prd_refs: ["FR-011", "FR-012"]
prerequisites: ["reflection-gated-submission"]
---

## Summary

Add the ability for whitelisted members to post text comments on any submission and view all existing comments in real-time. Comments live in the `/submissions/{id}/comments` subcollection already defined in the Firestore data model (F-03). Each submission card in the feed gains a collapsible "Comments (N)" toggle button; expanding it shows the comment thread (oldest first) and a form at the bottom for posting new comments. Authors can delete their own comments. This is entirely a UI addition on top of fully deployed infrastructure (Firestore rules and data model are complete).
