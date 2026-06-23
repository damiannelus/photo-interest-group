import { Navigate, Outlet } from "react-router";
import CookieConsent from "~/components/CookieConsent";
import RejectionScreen from "~/components/RejectionScreen";
import Sidebar from "~/components/Sidebar";
import { useAuth } from "~/context/auth";
import { allowedEmails } from "~/lib/allowedEmails";

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <span className="text-text-secondary text-sm">Loading…</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedEmails.includes(user.email?.toLowerCase() ?? "")) return <RejectionScreen />;

  return (
    <div className="flex min-h-screen bg-bg-base">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      <CookieConsent />
    </div>
  );
}
