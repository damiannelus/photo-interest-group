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
    setRejected(false);
    if (!loading && user) {
      if (allowedEmails.includes(user.email?.toLowerCase() ?? "")) {
        navigate("/");
      } else {
        setRejected(true);
      }
    }
  }, [user, loading, navigate]);

  if (rejected) return <RejectionScreen />;

  async function handleSignIn() {
    setError(null);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const email = result.user.email?.toLowerCase() ?? "";
      if (allowedEmails.includes(email)) {
        navigate("/");
      } else {
        await signOut(auth);
        setRejected(true);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // user dismissed — no message needed
      } else if (code === "auth/popup-blocked") {
        setError("Your browser blocked the sign-in popup. Please allow popups for this site and try again.");
      } else {
        setError("Sign-in failed. Please try again.");
      }
    }
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4rem", gap: "1rem" }}>
      <h1>Photo Interest Group</h1>
      <button onClick={handleSignIn}>Sign in with Google</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
