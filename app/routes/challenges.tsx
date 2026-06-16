import { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "~/firebase";
import { useAuth } from "~/context/auth";
import type { Challenge } from "~/types/challenge";
import type { Comment } from "~/types/comment";
import type { Submission } from "~/types/submission";
import { buildSubmissionTree } from "~/lib/submissionTree";
import { checkCanPost, checkCanSubmit, checkCanFollowUp } from "~/lib/gatePredicates";
import { useComments } from "~/hooks/useComments";
import { useChallengeSubmissions } from "~/hooks/useChallengeSubmissions";
import { useActiveChallenges } from "~/hooks/useActiveChallenges";

// ---------------------------------------------------------------------------
// SubmissionCard — manages its own comment listener and form state
// ---------------------------------------------------------------------------

function SubmissionCard({ submission }: { submission: Submission }) {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const [commentOpen, setCommentOpen] = useState(false);
  const { comments, commentCount, commentsLoading, loadError } = useComments(submission.id, commentOpen);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [fuPhotoUrl, setFuPhotoUrl] = useState("");
  const [fuReflection, setFuReflection] = useState("");
  const [fuSubmitting, setFuSubmitting] = useState(false);
  const [fuError, setFuError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canPost = checkCanPost(commentText, submitting);
  const canFollowUp = checkCanFollowUp(!!user, fuPhotoUrl, fuReflection, fuSubmitting);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await addDoc(
        collection(db, "submissions", submission.id, "comments"),
        {
          text: commentText.trim(),
          authorUid: user.uid,
          authorEmail: user.email ?? "",
          createdAt: serverTimestamp(),
        }
      );
      if (!mountedRef.current) return;
      setCommentText("");
      setSubmitting(false);
    } catch (err) {
      console.error("Comment post failed:", err);
      if (!mountedRef.current) return;
      setSubmitError("Failed to post. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteDoc(
        doc(db, "submissions", submission.id, "comments", commentId)
      );
    } catch (err) {
      console.error("Comment delete failed:", err);
      if (!mountedRef.current) return;
      setSubmitError("Failed to delete comment.");
    }
  }

  async function handleFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!canFollowUp || !user) return;

    try {
      if (new URL(fuPhotoUrl.trim()).protocol !== "https:") {
        setFuError("Only HTTPS image URLs are allowed.");
        return;
      }
    } catch {
      setFuError("Please enter a valid URL.");
      return;
    }

    setFuSubmitting(true);
    setFuError(null);

    try {
      await addDoc(collection(db, "submissions"), {
        challengeId: submission.challengeId,
        photoUrl: fuPhotoUrl.trim(),
        reflection: fuReflection.trim(),
        authorUid: user.uid,
        authorEmail: user.email ?? "",
        createdAt: serverTimestamp(),
        parent_submission_id: submission.id,
      });
      if (!mountedRef.current) return;
      setFuPhotoUrl("");
      setFuReflection("");
      setFuSubmitting(false);
      setFollowUpOpen(false);
    } catch (err) {
      console.error("Follow-up submission failed:", err);
      if (!mountedRef.current) return;
      setFuError("Failed to publish. Please try again.");
      setFuSubmitting(false);
    }
  }

  async function handleDeleteSubmission() {
    if (!window.confirm("Delete this submission? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "submissions", submission.id));
    } catch (err) {
      console.error("Submission delete failed:", err);
      if (!mountedRef.current) return;
      setDeleteError("Failed to delete. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-2 py-3 border-t border-gray-100 dark:border-gray-800">
      {/* Submission display */}
      <div className="flex gap-3">
        <img
          src={submission.photoUrl}
          alt={`Submission by ${submission.authorEmail}`}
          className="w-16 h-16 object-cover rounded flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
            {submission.authorEmail}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
            {submission.reflection}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-1">
        <button
          type="button"
          onClick={() => { setCommentOpen((v) => !v); setFollowUpOpen(false); }}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-left"
        >
          Comments ({commentCount})
        </button>
        {user && (
          <button
            type="button"
            onClick={() => { setFollowUpOpen((v) => !v); setCommentOpen(false); }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-left"
          >
            {followUpOpen ? "Cancel Follow-Up" : "Follow-Up"}
          </button>
        )}
        {user?.uid === submission.authorUid && (
          <button
            type="button"
            onClick={handleDeleteSubmission}
            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-left"
          >
            Delete
          </button>
        )}
      </div>
      {deleteError && (
        <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
      )}

      {/* Follow-up form */}
      {followUpOpen && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          {/* Parent context block */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 flex gap-3 mb-4">
            <img
              src={submission.photoUrl}
              alt=""
              className="w-10 h-10 object-cover rounded flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                Responding to:
              </p>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                {submission.authorEmail}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                {submission.reflection.length > 80
                  ? submission.reflection.slice(0, 80) + "…"
                  : submission.reflection}
              </p>
            </div>
          </div>

          <form onSubmit={handleFollowUp} className="space-y-3">
            {/* Photo URL */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Photo URL
              </label>
              <input
                type="url"
                value={fuPhotoUrl}
                onChange={(e) => setFuPhotoUrl(e.target.value)}
                placeholder="Paste a hosted HTTPS image URL"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {fuPhotoUrl.trim().startsWith("https://") && (
                <img
                  src={fuPhotoUrl}
                  alt="Preview"
                  className="w-full max-h-36 object-cover rounded mt-2"
                />
              )}
            </div>

            {/* Reflection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reflection
              </label>
              <textarea
                value={fuReflection}
                onChange={(e) => setFuReflection(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p
                className={
                  fuReflection.trim().length >= 50
                    ? "text-xs text-green-600 dark:text-green-400"
                    : "text-xs text-gray-400 dark:text-gray-500"
                }
              >
                {fuReflection.trim().length} / 50 characters
              </p>
            </div>

            {fuError && (
              <p className="text-sm text-red-600 dark:text-red-400">{fuError}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!canFollowUp}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded"
              >
                {fuSubmitting ? "Publishing…" : "Publish"}
              </button>
              <button
                type="button"
                onClick={() => { setFollowUpOpen(false); setFuPhotoUrl(""); setFuReflection(""); setFuError(null); }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Comment section */}
      {commentOpen && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          {commentsLoading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
              Loading comments…
            </p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-2 italic">
              No comments yet — be the first to respond.
            </p>
          ) : (
            <ul className="mb-4">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="flex flex-col gap-0.5 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {comment.authorEmail}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {comment.createdAt
                        ? comment.createdAt.toDate().toLocaleString()
                        : ""}
                    </span>
                    {comment.authorUid === user?.uid && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 ml-auto"
                        aria-label="Delete comment"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-100">
                    {comment.text}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {/* Comment form */}
          <form onSubmit={handlePost} className="space-y-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={2}
              placeholder="Add a comment…"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p
              className={
                commentText.trim().length >= 10
                  ? "text-xs text-green-600 dark:text-green-400"
                  : "text-xs text-gray-400 dark:text-gray-500"
              }
            >
              {commentText.trim().length} / 10 characters
            </p>
            {(loadError ?? submitError) && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {loadError ?? submitError}
              </p>
            )}
            <button
              type="submit"
              disabled={!canPost}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded"
            >
              {submitting ? "Posting…" : "Post"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubmissionList — tree renderer helper
// ---------------------------------------------------------------------------

function SubmissionList({
  parentId,
  byParent,
  depth,
}: {
  parentId: string | null;
  byParent: Map<string | null, Submission[]>;
  depth: number;
}) {
  if (depth > 3) return null;
  const group = byParent.get(parentId);
  if (!group || group.length === 0) return null;
  return (
    <div className={depth > 0 ? "ml-4 pl-4 border-l-2 border-gray-100 dark:border-gray-800" : undefined}>
      {group.map((sub) => (
        <div key={sub.id}>
          <SubmissionCard submission={sub} />
          <SubmissionList
            parentId={sub.id}
            byParent={byParent}
            depth={depth + 1}
          />
        </div>
      ))}
    </div>
  );
}

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

  const { submissions, subsLoading, subsError } = useChallengeSubmissions(challenge.id);
  const subTree = useMemo(() => buildSubmissionTree(submissions), [submissions]);
  const rootCount = submissions.filter((s) => (s.parent_submission_id ?? null) === null).length;

  const [formOpen, setFormOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = checkCanSubmit(photoUrl, reflection, submitting);

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
        parent_submission_id: null,
      });
      if (!mountedRef.current) return;
      setPhotoUrl("");
      setReflection("");
      setFormOpen(false);
      setSubmitting(false);
    } catch (err) {
      console.error("Submission failed:", err);
      if (!mountedRef.current) return;
      setSubmitError("Failed to publish. Please try again.");
      setSubmitting(false);
    }
  }

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
            {photoUrl.trim().startsWith("https://") && (
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
                reflection.trim().length >= 50
                  ? "text-sm text-green-600 dark:text-green-400"
                  : "text-sm text-gray-400 dark:text-gray-500"
              }
            >
              {reflection.trim().length} / 50 characters
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
              {rootCount} submission
              {rootCount !== 1 ? "s" : ""}
            </p>

            {submissions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No submissions yet — be the first!
              </p>
            ) : (
              <SubmissionList
                parentId={null}
                byParent={subTree}
                depth={0}
              />
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
  const { challenges, loading, error } = useActiveChallenges();

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
