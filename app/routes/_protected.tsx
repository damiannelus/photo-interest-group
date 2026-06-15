import { Navigate, Outlet } from "react-router";
import RejectionScreen from "~/components/RejectionScreen";
import { useAuth } from "~/context/auth";
import { allowedEmails } from "~/lib/allowedEmails";

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedEmails.includes(user.email?.toLowerCase() ?? "")) return <RejectionScreen />;

  return <Outlet />;
}
