import { useEffect, useState } from "react";
import {
  collection,
  getCountFromServer,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "~/firebase";
import type { Comment } from "~/types/comment";

export function useComments(
  submissionId: string,
  commentOpen: boolean
): {
  comments: Comment[];
  commentCount: number;
  commentsLoading: boolean;
  loadError: string | null;
} {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Seed badge count on mount before the subscription opens
  useEffect(() => {
    let cancelled = false;
    getCountFromServer(collection(db, "submissions", submissionId, "comments"))
      .then((snap) => { if (!cancelled) setCommentCount(snap.data().count); })
      .catch(() => {
        // Non-critical; count stays 0 on error
      });
    return () => { cancelled = true; };
  }, [submissionId]);

  // Wire/unwire the real-time listener when the toggle changes
  useEffect(() => {
    if (!commentOpen) return;
    setCommentsLoading(true);
    const q = query(
      collection(db, "submissions", submissionId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment)
        );
        setCommentCount(snap.size);
        setCommentsLoading(false);
      },
      (_err) => {
        setCommentsLoading(false);
        setLoadError("Failed to load comments. Please refresh.");
      }
    );
    return unsub;
  }, [commentOpen, submissionId]);

  return { comments, commentCount, commentsLoading, loadError };
}
