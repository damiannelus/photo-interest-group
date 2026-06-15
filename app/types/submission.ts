import type { Timestamp } from "firebase/firestore";

export interface Submission {
  id: string;
  challengeId: string;
  photoUrl: string;
  reflection: string;
  authorUid: string;
  authorEmail: string;
  createdAt: Timestamp;
  parent_submission_id: string | null;
}
