import { signOut } from "firebase/auth";
import { useNavigate } from "react-router";
import { auth } from "~/firebase";

export default function RejectionScreen() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4rem", gap: "1rem" }}>
      <p>Your account is not on the member list. Contact the group admin to request access.</p>
      <button onClick={handleSignOut}>Sign Out</button>
    </div>
  );
}
