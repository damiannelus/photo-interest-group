import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "~/context/auth";
import { db } from "~/firebase";

export default function NewChallengePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
      navigate("/");
    } catch (err) {
      console.error("Challenge creation failed:", err);
      setError("Failed to create challenge. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          New Challenge
        </h1>
        <Link
          to="/"
          className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
        >
          Back to challenges
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title field */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Golden Hour"
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description field */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Description{" "}
            <span className="text-gray-400 dark:text-gray-500 font-normal">
              (optional)
            </span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What should members photograph?"
            rows={4}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded"
          >
            {submitting ? "Creating…" : "Create Challenge"}
          </button>
          <Link
            to="/"
            className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
