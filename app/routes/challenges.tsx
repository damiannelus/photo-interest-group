import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "~/firebase";
import { useAuth } from "~/context/auth";
import type { Challenge } from "~/types/challenge";
import type { Submission } from "~/types/submission";

// ---------------------------------------------------------------------------
// ChallengeCard — manages its own submissions listener
// ---------------------------------------------------------------------------

interface ChallengeCardProps {
  challenge: Challenge;
}

function ChallengeCard({ challenge }: ChallengeCardProps) {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsError, setSubsError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit =
    photoUrl.trim().length > 0 &&
    reflection.trim().length >= 50 &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user) return;

    try {
      if (new URL(photoUrl.trim()).protocol !== "https:") {
        setSubmitError("Only HTTPS image URLs are allowed.");
        return;
      }
    } catch {
      setSubmitError("Please enter a valid URL.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await addDoc(collection(db, "submissions"), {
        challengeId: challenge.id,
        photoUrl: photoUrl.trim(),
        reflection: reflection.trim(),
        authorUid: user.uid,
        authorEmail: user.email ?? "",
        createdAt: serverTimestamp(),
      });
      if (!mountedRef.current) return;
      setPhotoUrl("");
      setReflection("");
      setFormOpen(false);
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitError("Failed to publish. Please try again.");
      setSubmitting(false);
    }
  }

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
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className={
            formOpen
              ? "text-sm text-gray-500 dark:text-gray-400 hover:underline"
              : "bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded"
          }
        >
          {formOpen ? "Cancel" : "Submit Photo"}
        </button>
      </div>

      {/* Inline submission form */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-100 dark:border-gray-800 mt-4 pt-4 space-y-4"
        >
          {/* Photo URL field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Photo URL
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Paste a hosted image URL"
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {photoUrl.trim().length > 0 && (
              <img
                src={photoUrl}
                alt="Preview"
                className="w-full max-h-48 object-cover rounded mt-2"
              />
            )}
          </div>

          {/* Reflection field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reflection
            </label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p
              className={
                reflection.length >= 50
                  ? "text-sm text-green-600 dark:text-green-400"
                  : "text-sm text-gray-400 dark:text-gray-500"
              }
            >
              {reflection.length} / 50 characters
            </p>
          </div>

          {/* Submit error */}
          {submitError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded"
            >
              {submitting ? "Publishing…" : "Publish"}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

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
      where("status", "==", "active"),
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
        <Link
          to="/challenges/new"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded"
        >
          + New Challenge
        </Link>
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
          <Link
            to="/challenges/new"
            className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded"
          >
            + New Challenge
          </Link>
        </div>
      ) : (
        challenges.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} />
        ))
      )}
    </div>
  );
}
