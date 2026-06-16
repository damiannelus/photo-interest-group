import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "~/firebase";
import type { Challenge } from "~/types/challenge";

export function useActiveChallenges(): {
  challenges: Challenge[];
  loading: boolean;
  error: string | null;
} {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "challenges"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setChallenges(
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Challenge)
        );
        setError(null);
        setLoading(false);
      },
      (_err) => {
        setError("Failed to load challenges. Please refresh.");
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  return { challenges, loading, error };
}
