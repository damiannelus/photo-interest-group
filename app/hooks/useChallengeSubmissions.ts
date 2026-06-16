import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "~/firebase";
import type { Submission } from "~/types/submission";

export function useChallengeSubmissions(challengeId: string): {
  submissions: Submission[];
  subsLoading: boolean;
  subsError: string | null;
} {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsError, setSubsError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "submissions"),
      where("challengeId", "==", challengeId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setSubmissions(
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Submission
          )
        );
        setSubsError(null);
        setSubsLoading(false);
      },
      (_err) => {
        setSubsError("Failed to load submissions. Please refresh.");
        setSubsLoading(false);
      }
    );

    return unsub;
  }, [challengeId]);

  return { submissions, subsLoading, subsError };
}
