import type { Timestamp } from "firebase/firestore";

export interface Comment {
  id: string;
  text: string;
  authorUid: string;
  authorEmail: string;
  createdAt: Timestamp;
}
