import { signOut } from "firebase/auth";
import { useState } from "react";
import { useNavigate } from "react-router";
import { auth } from "~/firebase";

export default function RejectionScreen() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    try {
      await signOut(auth);
      navigate("/login");
    } catch {
      setError("Sign-out failed. Please try again.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4rem", gap: "1rem" }}>
      <p>Your account is not on the member list. Contact the group admin to request access.</p>
      <button onClick={handleSignOut}>Sign Out</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
