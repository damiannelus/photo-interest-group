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
  if (loading) return <div>Loading…</div>;

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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4rem", gap: "1rem" }}>
      <h1>Photo Interest Group</h1>
      <button onClick={handleSignIn}>Sign in with Google</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
