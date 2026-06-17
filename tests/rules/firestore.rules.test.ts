import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collection,
  addDoc,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

const __dir = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(resolve(__dir, "../../firestore.rules"), "utf8");
const PROJECT_ID = "photo-rules-test";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES,
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ── Setup helpers ──────────────────────────────────────────────────────────

async function createMember(email: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "members", email), { email });
  });
}

async function createChallenge(id: string, createdBy: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "challenges", id), {
      title: "Weekly Challenge",
      status: "active",
      createdBy,
    });
  });
}

async function createSubmission(
  id: string,
  authorUid: string,
  reflection = "a".repeat(50)
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "submissions", id), {
      authorUid,
      reflection,
      photoUrl: "https://example.com/photo.jpg",
    });
  });
}

// ── R1: Reflection gate — whitespace bypass ────────────────────────────────

describe("R1: reflection gate rejects whitespace-only content", () => {
  const EMAIL = "alice@example.com";
  const UID = "uid-alice";

  beforeEach(async () => {
    await createMember(EMAIL);
  });

  it("create: denies a reflection of 50 spaces", async () => {
    const db = testEnv.authenticatedContext(UID, { email: EMAIL }).firestore();
    await assertFails(
      addDoc(collection(db, "submissions"), {
        authorUid: UID,
        reflection: " ".repeat(50),
        photoUrl: "https://example.com/photo.jpg",
      })
    );
  });

  it("create: allows a reflection of 50 non-whitespace characters", async () => {
    const db = testEnv.authenticatedContext(UID, { email: EMAIL }).firestore();
    await assertSucceeds(
      addDoc(collection(db, "submissions"), {
        authorUid: UID,
        reflection: "a".repeat(50),
        photoUrl: "https://example.com/photo.jpg",
      })
    );
  });

  it("update: denies updating reflection to 50 spaces", async () => {
    await createSubmission("sub-1", UID);
    const db = testEnv.authenticatedContext(UID, { email: EMAIL }).firestore();
    await assertFails(
      updateDoc(doc(db, "submissions", "sub-1"), {
        reflection: " ".repeat(50),
        authorUid: UID,
      })
    );
  });

  it("update: allows updating reflection to 50 non-whitespace characters", async () => {
    await createSubmission("sub-1", UID);
    const db = testEnv.authenticatedContext(UID, { email: EMAIL }).firestore();
    await assertSucceeds(
      updateDoc(doc(db, "submissions", "sub-1"), {
        reflection: "b".repeat(50),
        authorUid: UID,
      })
    );
  });
});

// ── R2 & R5: Whitelist enforcement ────────────────────────────────────────

describe("R2 & R5: whitelist enforcement", () => {
  const MEMBER_EMAIL = "alice@example.com";
  const MEMBER_UID = "uid-alice";
  const NON_MEMBER_EMAIL = "hacker@example.com";
  const NON_MEMBER_UID = "uid-hacker";

  beforeEach(async () => {
    await createMember(MEMBER_EMAIL);
    await createChallenge("ch-1", MEMBER_UID);
    await createSubmission("sub-1", MEMBER_UID);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "submissions", "sub-1", "comments", "cmt-1"),
        { authorUid: MEMBER_UID, text: "Great shot!" }
      );
    });
  });

  describe("member can read all collections", () => {
    it("reads a challenge", async () => {
      const db = testEnv
        .authenticatedContext(MEMBER_UID, { email: MEMBER_EMAIL })
        .firestore();
      await assertSucceeds(getDoc(doc(db, "challenges", "ch-1")));
    });

    it("reads a submission", async () => {
      const db = testEnv
        .authenticatedContext(MEMBER_UID, { email: MEMBER_EMAIL })
        .firestore();
      await assertSucceeds(getDoc(doc(db, "submissions", "sub-1")));
    });

    it("reads a comment", async () => {
      const db = testEnv
        .authenticatedContext(MEMBER_UID, { email: MEMBER_EMAIL })
        .firestore();
      await assertSucceeds(
        getDoc(doc(db, "submissions", "sub-1", "comments", "cmt-1"))
      );
    });
  });

  describe("non-member is denied on all collection paths", () => {
    it("cannot read a challenge", async () => {
      const db = testEnv
        .authenticatedContext(NON_MEMBER_UID, { email: NON_MEMBER_EMAIL })
        .firestore();
      await assertFails(getDoc(doc(db, "challenges", "ch-1")));
    });

    it("cannot read a submission", async () => {
      const db = testEnv
        .authenticatedContext(NON_MEMBER_UID, { email: NON_MEMBER_EMAIL })
        .firestore();
      await assertFails(getDoc(doc(db, "submissions", "sub-1")));
    });

    it("cannot read a comment", async () => {
      const db = testEnv
        .authenticatedContext(NON_MEMBER_UID, { email: NON_MEMBER_EMAIL })
        .firestore();
      await assertFails(
        getDoc(doc(db, "submissions", "sub-1", "comments", "cmt-1"))
      );
    });

    it("cannot create a challenge", async () => {
      const db = testEnv
        .authenticatedContext(NON_MEMBER_UID, { email: NON_MEMBER_EMAIL })
        .firestore();
      await assertFails(
        addDoc(collection(db, "challenges"), {
          title: "Hacker Challenge",
          status: "active",
          createdBy: NON_MEMBER_UID,
        })
      );
    });

    it("cannot create a submission", async () => {
      const db = testEnv
        .authenticatedContext(NON_MEMBER_UID, { email: NON_MEMBER_EMAIL })
        .firestore();
      await assertFails(
        addDoc(collection(db, "submissions"), {
          authorUid: NON_MEMBER_UID,
          reflection: "a".repeat(50),
          photoUrl: "https://example.com/photo.jpg",
        })
      );
    });

    it("cannot create a comment", async () => {
      const db = testEnv
        .authenticatedContext(NON_MEMBER_UID, { email: NON_MEMBER_EMAIL })
        .firestore();
      await assertFails(
        addDoc(collection(db, "submissions", "sub-1", "comments"), {
          authorUid: NON_MEMBER_UID,
          text: "Infiltrated!",
        })
      );
    });
  });

  describe("unauthenticated user is denied on all collection paths", () => {
    it("cannot read a challenge", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, "challenges", "ch-1")));
    });

    it("cannot read a submission", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, "submissions", "sub-1")));
    });

    it("cannot read a comment", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        getDoc(doc(db, "submissions", "sub-1", "comments", "cmt-1"))
      );
    });
  });
});

// ── Ownership rules ────────────────────────────────────────────────────────

describe("Ownership rules", () => {
  const ALICE_EMAIL = "alice@example.com";
  const ALICE_UID = "uid-alice";
  const BOB_EMAIL = "bob@example.com";
  const BOB_UID = "uid-bob";

  beforeEach(async () => {
    await createMember(ALICE_EMAIL);
    await createMember(BOB_EMAIL);
    await createSubmission("sub-alice", ALICE_UID);
  });

  it("member cannot update another member's submission", async () => {
    const db = testEnv
      .authenticatedContext(BOB_UID, { email: BOB_EMAIL })
      .firestore();
    await assertFails(
      updateDoc(doc(db, "submissions", "sub-alice"), {
        reflection: "b".repeat(50),
        authorUid: ALICE_UID,
      })
    );
  });

  it("member cannot delete another member's submission", async () => {
    const db = testEnv
      .authenticatedContext(BOB_UID, { email: BOB_EMAIL })
      .firestore();
    await assertFails(deleteDoc(doc(db, "submissions", "sub-alice")));
  });

  it("member can delete their own submission", async () => {
    const db = testEnv
      .authenticatedContext(ALICE_UID, { email: ALICE_EMAIL })
      .firestore();
    await assertSucceeds(deleteDoc(doc(db, "submissions", "sub-alice")));
  });
});

// ── R4: Follow-up parent_submission_id integrity ──────────────────────────

describe("R4: follow-up parent_submission_id is persisted correctly", () => {
  const EMAIL = "alice@example.com";
  const UID = "uid-alice";
  const PARENT_ID = "sub-parent";

  beforeEach(async () => {
    await createMember(EMAIL);
    await createSubmission(PARENT_ID, UID);
  });

  it("writes a follow-up and reads back the correct parent_submission_id", async () => {
    const db = testEnv.authenticatedContext(UID, { email: EMAIL }).firestore();
    const ref = await addDoc(collection(db, "submissions"), {
      authorUid: UID,
      reflection: "a".repeat(50),
      photoUrl: "https://example.com/followup.jpg",
      parent_submission_id: PARENT_ID,
    });

    let data: Record<string, unknown> = {};
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), "submissions", ref.id));
      data = snap.data() as Record<string, unknown>;
    });

    expect(data.parent_submission_id).toBe(PARENT_ID);
  });
});
