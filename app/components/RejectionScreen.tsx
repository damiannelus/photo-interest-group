import { signOut } from "firebase/auth";
import { useState } from "react";
import { useNavigate } from "react-router";
import { usePostHog } from "posthog-js/react";
import { auth } from "~/firebase";

export default function RejectionScreen() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    try {
      posthog?.capture("user_signed_out");
      posthog?.reset();
      await signOut(auth);
      navigate("/login");
    } catch {
      setError("Sign-out failed. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="bg-bg-surface border border-border rounded-card p-10 w-full max-w-sm flex flex-col items-center gap-6">
        <p className="text-sm text-text-secondary text-center">
          Your account is not on the member list. Contact the group admin to request access.
        </p>
        <button
          onClick={handleSignOut}
          className="border border-border text-text-secondary px-4 py-2 rounded-input hover:bg-bg-elevated text-sm transition-colors"
        >
          Sign Out
        </button>
        {error && <p className="text-sm text-error text-center">{error}</p>}
      </div>
    </div>
  );
}
