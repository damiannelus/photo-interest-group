import type { Timestamp } from "firebase/firestore";

export interface Challenge {
  id: string;
  title: string;
  description?: string;
  createdBy: string;
  createdAt: Timestamp;
  status: "active" | "closed";
}
