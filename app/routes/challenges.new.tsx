import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { usePostHog } from "posthog-js/react";
import { useAuth } from "~/context/auth";
import { db } from "~/firebase";

const inputClass =
  "w-full bg-bg-base border border-border rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-accent";

export default function NewChallengePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const posthog = usePostHog();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, "challenges"), {
        title: title.trim(),
        description: description.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        status: "active",
      });
      posthog?.capture("challenge_created", { has_description: description.trim().length > 0 });
      navigate("/");
    } catch (err) {
      console.error("Challenge creation failed:", err);
      setError("Failed to create challenge. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          New Challenge
        </h1>
        <Link
          to="/"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Back to challenges
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label
            htmlFor="title"
            className="block text-xs font-medium text-text-secondary mb-1"
          >
            Title <span className="text-error">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Golden Hour"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-xs font-medium text-text-secondary mb-1"
          >
            Description{" "}
            <span className="text-text-faint font-normal">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What should members photograph?"
            rows={4}
            className={`${inputClass} resize-y`}
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-input hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {submitting ? "Creating…" : "Create Challenge"}
          </button>
          <Link
            to="/"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
