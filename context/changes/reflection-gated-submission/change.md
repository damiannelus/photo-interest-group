---
id: reflection-gated-submission
title: "Reflection-Gated Photo Submission (North Star)"
status: implementing
created: 2026-06-15
updated: 2026-06-15
roadmap_id: S-02
prd_refs: ["FR-006", "FR-007", "FR-008", "US-01"]
prerequisites: ["challenge-submission-feed"]
---

## Summary

Add the submission form to each ChallengeCard in the feed. A "Submit Photo" button in the card header expands an inline form with a photo URL field and a reflection textarea. The Publish button is disabled until a valid URL and a ≥50-character reflection are both present. On publish, the submission is written to Firestore (which enforces the 50-char gate server-side) and appears in the card's live feed immediately via the existing onSnapshot listener.
