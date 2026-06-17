import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import RejectionScreen from "~/components/RejectionScreen";
import { useAuth } from "~/context/auth";
import { auth } from "~/firebase";
import { allowedEmails } from "~/lib/allowedEmails";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rejected, setRejected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      if (allowedEmails.includes(user.email?.toLowerCase() ?? "")) {
        navigate("/");
      } else {
        setRejected(true);
      }
    }
  }, [user, loading, navigate]);

  if (rejected) return <RejectionScreen />;
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <span className="text-text-secondary text-sm">Loading…</span>
      </div>
    );
  }

  async function handleSignIn() {
    setError(null);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const email = result.user.email?.toLowerCase() ?? "";
      if (!allowedEmails.includes(email)) {
        await signOut(auth);
        setRejected(true);
      }
    } catch {
      setError("Sign-in failed. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="bg-bg-surface border border-border rounded-card p-10 w-full max-w-sm flex flex-col items-center gap-6">
        <h1 className="text-lg font-semibold text-text-primary tracking-tight">
          Photo Interest Group
        </h1>
        <button
          onClick={handleSignIn}
          className="bg-accent text-white text-sm font-medium px-5 py-2.5 rounded-input hover:opacity-90 transition-opacity w-full"
        >
          Sign in with Google
        </button>
        {error && <p className="text-sm text-error text-center">{error}</p>}
      </div>
    </div>
  );
}
