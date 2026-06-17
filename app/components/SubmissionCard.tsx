import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "~/context/auth";
import { db } from "~/firebase";
import { useComments } from "~/hooks/useComments";
import { checkCanEdit, checkCanFollowUp, checkCanPost } from "~/lib/gatePredicates";
import type { Submission } from "~/types/submission";

const inputClass =
  "w-full bg-bg-base border border-border rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-accent";

const primaryBtnClass =
  "bg-accent text-white text-xs font-medium px-3 py-1.5 rounded-input disabled:opacity-40";

const ghostBtnClass =
  "text-xs text-text-faint hover:text-text-primary transition-colors";

function charCountClass(met: boolean) {
  return met ? "text-xs text-success" : "text-xs text-text-faint";
}

interface Props {
  submission: Submission;
  childSubmissions: Submission[];
}

export default function SubmissionCard({ submission, childSubmissions }: Props) {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const [commentOpen, setCommentOpen] = useState(false);
  const { comments, commentCount, commentsLoading, loadError } = useComments(submission.id, commentOpen);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [showFollowUps, setShowFollowUps] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [fuPhotoUrl, setFuPhotoUrl] = useState("");
  const [fuReflection, setFuReflection] = useState("");
  const [fuSubmitting, setFuSubmitting] = useState(false);
  const [fuError, setFuError] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editReflection, setEditReflection] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const canPost = checkCanPost(commentText, submitting);
  const canFollowUp = checkCanFollowUp(!!user, fuPhotoUrl, fuReflection, fuSubmitting);
  const canEdit = checkCanEdit(editReflection, editSubmitting);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await addDoc(collection(db, "submissions", submission.id, "comments"), {
        text: commentText.trim(),
        authorUid: user.uid,
        authorEmail: user.email ?? "",
        createdAt: serverTimestamp(),
      });
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

  async function handleDeleteComment(commentId: string) {
    try {
      await deleteDoc(doc(db, "submissions", submission.id, "comments", commentId));
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
    setIsDeleting(true);
    try {
      setDeleteError(null);
      await deleteDoc(doc(db, "submissions", submission.id));
    } catch (err) {
      console.error("Submission delete failed:", err);
      if (!mountedRef.current) return;
      setIsDeleting(false);
      setDeleteError("Failed to delete. Please try again.");
    }
  }

  async function handleEditReflection(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !user) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await updateDoc(doc(db, "submissions", submission.id), {
        reflection: editReflection.trim(),
      });
      if (!mountedRef.current) return;
      setEditOpen(false);
      setEditSubmitting(false);
    } catch (err) {
      console.error("Reflection edit failed:", err);
      if (!mountedRef.current) return;
      setEditError("Failed to save. Please try again.");
      setEditSubmitting(false);
    }
  }

  return (
    <div className="bg-bg-surface border border-border rounded-card overflow-hidden flex flex-col">
      {/* Full-width photo */}
      <img
        src={submission.photoUrl}
        alt={`Submission by ${submission.authorEmail}`}
        className="w-full aspect-video object-cover"
      />

      {/* Content area */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <p className="text-xs font-semibold tracking-widest uppercase text-text-faint truncate">
          {submission.authorEmail}
        </p>
        <p className="text-sm text-text-secondary leading-5">
          {submission.reflection}
        </p>

        {/* Action bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => { setCommentOpen((v) => !v); setFollowUpOpen(false); }}
            className={ghostBtnClass}
          >
            Comments ({commentCount})
          </button>
          {user && childSubmissions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFollowUps((v) => !v)}
              className={ghostBtnClass}
            >
              ↩ {childSubmissions.length} follow-up{childSubmissions.length !== 1 ? "s" : ""}
            </button>
          )}
          {user && (
            <button
              type="button"
              onClick={() => { setFollowUpOpen((v) => !v); setCommentOpen(false); }}
              className="text-xs text-accent-dim hover:text-accent transition-colors"
            >
              {followUpOpen ? "Cancel Follow-Up" : "Follow-Up"}
            </button>
          )}
          {user?.uid === submission.authorUid && (
            <button
              type="button"
              onClick={() => {
                setEditReflection(submission.reflection);
                setEditError(null);
                setEditOpen((v) => !v);
                setCommentOpen(false);
                setFollowUpOpen(false);
              }}
              className={ghostBtnClass}
            >
              {editOpen ? "Cancel Edit" : "Edit"}
            </button>
          )}
          {user?.uid === submission.authorUid && (
            <button
              type="button"
              onClick={handleDeleteSubmission}
              disabled={isDeleting}
              className="text-xs text-error hover:opacity-80 disabled:opacity-50 transition-colors"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>

        {deleteError && <p className="text-xs text-error">{deleteError}</p>}

        {/* Edit reflection form */}
        {editOpen && (
          <div className="pt-3 border-t border-border">
            <form onSubmit={handleEditReflection} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Edit Reflection
                </label>
                <textarea
                  value={editReflection}
                  onChange={(e) => setEditReflection(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
                <p className={charCountClass(editReflection.trim().length >= 50)}>
                  {editReflection.trim().length} / 50 characters
                </p>
              </div>
              {editError && <p className="text-xs text-error">{editError}</p>}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={!canEdit} className={primaryBtnClass}>
                  {editSubmitting ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditOpen(false); setEditReflection(""); setEditError(null); }}
                  className={ghostBtnClass}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Follow-up form */}
        {followUpOpen && (
          <div className="pt-3 border-t border-border">
            <div className="bg-bg-elevated rounded-input p-3 flex gap-3 mb-4">
              <img
                src={submission.photoUrl}
                alt=""
                className="w-10 h-10 object-cover rounded flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs text-text-faint mb-0.5">Responding to:</p>
                <p className="text-xs font-medium text-text-secondary truncate">
                  {submission.authorEmail}
                </p>
                <p className="text-xs text-text-faint line-clamp-2">
                  {submission.reflection.length > 80
                    ? submission.reflection.slice(0, 80) + "…"
                    : submission.reflection}
                </p>
              </div>
            </div>
            <form onSubmit={handleFollowUp} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Photo URL
                </label>
                <input
                  type="url"
                  value={fuPhotoUrl}
                  onChange={(e) => setFuPhotoUrl(e.target.value)}
                  placeholder="Paste a hosted HTTPS image URL"
                  className={inputClass}
                />
                {fuPhotoUrl.trim().startsWith("https://") && (
                  <img
                    src={fuPhotoUrl}
                    alt="Preview"
                    className="w-full max-h-36 object-cover rounded mt-2"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Reflection
                </label>
                <textarea
                  value={fuReflection}
                  onChange={(e) => setFuReflection(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
                <p className={charCountClass(fuReflection.trim().length >= 50)}>
                  {fuReflection.trim().length} / 50 characters
                </p>
              </div>
              {fuError && <p className="text-xs text-error">{fuError}</p>}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={!canFollowUp} className={primaryBtnClass}>
                  {fuSubmitting ? "Publishing…" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => { setFollowUpOpen(false); setFuPhotoUrl(""); setFuReflection(""); setFuError(null); }}
                  className={ghostBtnClass}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Comment section */}
        {commentOpen && (
          <div className="pt-3 border-t border-border">
            {commentsLoading ? (
              <p className="text-xs text-text-faint py-2">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-text-faint py-2 italic">
                No comments yet — be the first to respond.
              </p>
            ) : (
              <ul className="mb-4">
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    className="flex flex-col gap-0.5 py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-secondary">
                        {comment.authorEmail}
                      </span>
                      <span className="font-mono text-xs text-text-faint">
                        {comment.createdAt ? comment.createdAt.toDate().toLocaleString() : ""}
                      </span>
                      {comment.authorUid === user?.uid && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs text-text-faint hover:text-error ml-auto transition-colors"
                          aria-label="Delete comment"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-text-primary">{comment.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handlePost} className="flex flex-col gap-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                placeholder="Add a comment…"
                className={inputClass}
              />
              <p className={charCountClass(commentText.trim().length >= 10)}>
                {commentText.trim().length} / 10 characters
              </p>
              {(loadError ?? submitError) && (
                <p className="text-xs text-error">{loadError ?? submitError}</p>
              )}
              <button type="submit" disabled={!canPost} className={primaryBtnClass}>
                {submitting ? "Posting…" : "Post"}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Follow-ups accordion */}
      {showFollowUps && childSubmissions.length > 0 && (
        <div className="border-t border-border p-4 flex flex-col gap-3">
          {childSubmissions.map((child) => (
            <div
              key={child.id}
              className="border-l-2 border-border ml-2 pl-4 flex gap-3"
            >
              <img
                src={child.photoUrl}
                alt={`Follow-up by ${child.authorEmail}`}
                className="w-16 h-16 object-cover rounded flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-widest uppercase text-text-faint truncate">
                  {child.authorEmail}
                </p>
                <p className="text-sm text-text-secondary leading-5 mt-1">
                  {child.reflection}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
