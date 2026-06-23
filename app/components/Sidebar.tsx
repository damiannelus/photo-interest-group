import { signOut } from "firebase/auth";
import { NavLink, useNavigate } from "react-router";
import { usePostHog } from "posthog-js/react";
import { useAuth } from "~/context/auth";
import { auth } from "~/firebase";

function GridIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const posthog = usePostHog();

  async function handleSignOut() {
    posthog?.capture("user_signed_out");
    posthog?.reset();
    await signOut(auth);
    navigate("/login");
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex items-center gap-3 px-3 py-2 rounded-input text-sm transition-colors",
      isActive
        ? "text-accent-dim bg-bg-elevated"
        : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated",
    ].join(" ");

  return (
    <nav className="w-12 lg:w-64 bg-bg-sidebar border-r border-border h-screen sticky top-0 flex flex-col flex-shrink-0">
      {/* Logo / app name */}
      <div className="flex items-center gap-3 px-3 py-5 border-b border-border">
        <div className="w-5 h-5 rounded bg-accent flex-shrink-0" />
        <span className="hidden lg:block text-sm font-semibold text-text-primary tracking-tight truncate">
          Photo Interest Group
        </span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1 p-2 flex-1">
        <NavLink to="/why" end className={navLinkClass}>
          <InfoIcon />
          <span className="hidden lg:block">The Why</span>
        </NavLink>
        <NavLink to="/" end className={navLinkClass}>
          <GridIcon />
          <span className="hidden lg:block">Feed</span>
        </NavLink>
        <NavLink to="/challenges/new" className={navLinkClass}>
          <PlusIcon />
          <span className="hidden lg:block">New Challenge</span>
        </NavLink>
      </div>

      {/* User + sign-out */}
      <div className="p-2 border-t border-border">
        <p className="hidden lg:block px-3 py-1 text-xs text-text-faint truncate">
          {user?.email}
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-input text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="hidden lg:block">Sign out</span>
        </button>
      </div>
    </nav>
  );
}
