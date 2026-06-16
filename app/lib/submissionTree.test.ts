import { describe, it, expect } from "vitest";
import { buildSubmissionTree } from "./submissionTree";
import type { Submission } from "~/types/submission";

const ts = (ms: number) => ({ toMillis: () => ms }) as any;

function sub(
  id: string,
  parentId: string | null | undefined,
  ms: number
): Submission {
  return {
    id,
    challengeId: "c1",
    photoUrl: "https://example.com/photo.jpg",
    reflection: "a".repeat(50),
    authorUid: "u1",
    authorEmail: "user@example.com",
    createdAt: ts(ms),
    parent_submission_id: parentId as string | null,
  };
}

describe("buildSubmissionTree", () => {
  it("puts undefined parent_submission_id into the null bucket", () => {
    const s = sub("a", undefined, 1);
    const map = buildSubmissionTree([s]);
    expect(map.get(null)).toContainEqual(s);
    expect(map.get(undefined as any)).toBeUndefined();
  });

  it("puts null parent_submission_id into the null bucket", () => {
    const s = sub("a", null, 1);
    const map = buildSubmissionTree([s]);
    expect(map.get(null)).toContainEqual(s);
  });

  it("routes a real parent ID to its own bucket", () => {
    const child = sub("b", "root-1", 2);
    const map = buildSubmissionTree([child]);
    expect(map.get("root-1")).toContainEqual(child);
    expect(map.get(null)).toBeUndefined();
  });

  it("drops no submissions from a mixed array", () => {
    const subs = [
      sub("a", null, 1),
      sub("b", undefined, 2),
      sub("c", "a", 3),
    ];
    const map = buildSubmissionTree(subs);
    const allValues = [...map.values()].flat();
    expect(allValues).toHaveLength(3);
  });

  it("sorts children ascending by createdAt", () => {
    const subs = [
      sub("c2", "root", 200),
      sub("c1", "root", 100),
    ];
    const map = buildSubmissionTree(subs);
    const children = map.get("root")!;
    expect(children[0].id).toBe("c1");
    expect(children[1].id).toBe("c2");
  });

  it("preserves root group order from the input (no sort)", () => {
    const subs = [
      sub("r2", null, 200),
      sub("r1", null, 100),
    ];
    const map = buildSubmissionTree(subs);
    const roots = map.get(null)!;
    expect(roots[0].id).toBe("r2");
    expect(roots[1].id).toBe("r1");
  });
});
