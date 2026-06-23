import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import SubmissionList from "~/components/SubmissionList";
import { useAuth } from "~/context/auth";
import { db } from "~/firebase";
import { useChallengeSubmissions } from "~/hooks/useChallengeSubmissions";
import { checkCanSubmit } from "~/lib/gatePredicates";
import { buildSubmissionTree } from "~/lib/submissionTree";
import type { Challenge } from "~/types/challenge";

const inputClass =
  "w-full bg-bg-base border border-border rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-accent";

const primaryBtnClass =
  "bg-accent text-white text-sm font-medium px-4 py-2 rounded-input hover:opacity-90 disabled:opacity-40";

interface Props {
  challenge: Challenge;
}

export default function ChallengeCard({ challenge }: Props) {
  const { user } = useAuth();
  const posthog = usePostHog();
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const { submissions, subsLoading, subsError } = useChallengeSubmissions(challenge.id);
  const subTree = useMemo(() => buildSubmissionTree(submissions), [submissions]);
  const rootSubmissions = useMemo(
    () => submissions.filter((s) => (s.parent_submission_id ?? null) === null),
    [submissions]
  );

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
      posthog?.capture("submission_published", {
        challenge_id: challenge.id,
        reflection_length: reflection.trim().length,
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
    <div className="bg-bg-surface border border-border rounded-card p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-text-primary tracking-tight">
          {challenge.title}
        </h2>
        <button
          type="button"
          onClick={() => {
            const opening = !formOpen;
            setFormOpen(opening);
            if (opening) posthog?.capture("submission_form_opened", { challenge_id: challenge.id });
          }}
          className={
            formOpen
              ? "text-sm text-text-secondary hover:text-text-primary transition-colors"
              : primaryBtnClass
          }
        >
          {formOpen ? "Cancel" : "Submit Photo"}
        </button>
      </div>

      {/* Inline submission form */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-border pt-4 flex flex-col gap-4"
        >
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Photo URL
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Paste a hosted image URL"
              required
              className={inputClass}
            />
            {photoUrl.trim().startsWith("https://") && (
              <img
                src={photoUrl}
                alt="Preview"
                className="w-full max-h-48 object-cover rounded mt-2"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Reflection
            </label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={4}
              className={inputClass}
            />
            <p
              className={
                reflection.trim().length >= 50
                  ? "text-xs text-success"
                  : "text-xs text-text-faint"
              }
            >
              {reflection.trim().length} / 50 characters
            </p>
          </div>
          {submitError && <p className="text-xs text-error">{submitError}</p>}
          <div className="flex items-center gap-4">
            <button type="submit" disabled={!canSubmit} className={primaryBtnClass}>
              {submitting ? "Publishing…" : "Publish"}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {challenge.description && (
        <p className="text-sm text-text-secondary">{challenge.description}</p>
      )}

      {/* Submissions */}
      <div>
        {subsLoading ? (
          <p className="text-xs text-text-faint">Loading submissions…</p>
        ) : subsError ? (
          <p className="text-xs text-error">{subsError}</p>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-widest uppercase text-text-faint mb-3">
              {rootSubmissions.length} submission{rootSubmissions.length !== 1 ? "s" : ""}
            </p>
            {rootSubmissions.length === 0 ? (
              <p className="text-sm text-text-faint italic">
                No submissions yet — be the first!
              </p>
            ) : (
              <SubmissionList rootSubmissions={rootSubmissions} byParent={subTree} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
