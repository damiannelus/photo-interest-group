import type { Submission } from "~/types/submission";

export function buildSubmissionTree(
  submissions: Submission[]
): Map<string | null, Submission[]> {
  const map = new Map<string | null, Submission[]>();
  for (const s of submissions) {
    const key = s.parent_submission_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  // Root submissions (key === null) keep Firestore query order (desc by createdAt).
  // Child groups are sorted asc so follow-up chains read chronologically.
  for (const [key, group] of map) {
    if (key !== null) {
      group.sort(
        (a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)
      );
    }
  }
  return map;
}
