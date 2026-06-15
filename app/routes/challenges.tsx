import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "~/firebase";
import type { Challenge } from "~/types/challenge";
import type { Submission } from "~/types/submission";

// ---------------------------------------------------------------------------
// ChallengeCard — manages its own submissions listener
// ---------------------------------------------------------------------------

interface ChallengeCardProps {
  challenge: Challenge;
}

function ChallengeCard({ challenge }: ChallengeCardProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsError, setSubsError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "submissions"),
      where("challengeId", "==", challenge.id),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setSubmissions(
          snap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Submission
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
  }, [challenge.id]);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6 bg-white dark:bg-gray-900">
      {/* Challenge header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {challenge.title}
        </h2>
        {/* TODO S-02: SubmitPhotoButton goes here */}
      </div>

      {challenge.description && (
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {challenge.description}
        </p>
      )}

      {/* Submissions section */}
      <div className="mt-4">
        {subsLoading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Loading submissions…
          </p>
        ) : subsError ? (
          <p className="text-sm text-red-600">{subsError}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              {submissions.length} submission
              {submissions.length !== 1 ? "s" : ""}
            </p>

            {submissions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No submissions yet — be the first!
                {/* TODO S-02: SubmitPhotoButton goes here */}
              </p>
            ) : (
              <ul>
                {submissions.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex gap-3 py-3 border-t border-gray-100 dark:border-gray-800"
                  >
                    <img
                      src={sub.photoUrl}
                      alt={`Submission by ${sub.authorEmail}`}
                      className="w-16 h-16 object-cover rounded flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {sub.authorEmail}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {sub.reflection}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChallengeFeed — top-level page
// ---------------------------------------------------------------------------

export default function ChallengeFeed() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "challenges"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setChallenges(
          snap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Challenge
          )
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

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Active Challenges
        </h1>
        {/* TODO S-05: CreateChallengeButton goes here */}
      </div>

      {/* Feed body */}
      {loading ? (
        <div className="text-gray-500 text-center py-12">
          Loading challenges…
        </div>
      ) : error ? (
        <div className="text-red-600 text-center py-12">{error}</div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No active challenges yet.
          </p>
          {/* TODO S-05: CreateChallengeButton goes here */}
        </div>
      ) : (
        challenges.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} />
        ))
      )}
    </div>
  );
}
