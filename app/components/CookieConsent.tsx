import { useState } from "react";
import posthog from "posthog-js";

export default function CookieConsent() {
  const [consent, setConsent] = useState<string | null>(() => localStorage.getItem("ph_consent"));

  if (consent !== null) return null;

  function handleAccept() {
    localStorage.setItem("ph_consent", "accepted");
    posthog.opt_in_capturing();
    setConsent("accepted");
  }

  function handleDecline() {
    localStorage.setItem("ph_consent", "declined");
    posthog.opt_out_capturing();
    setConsent("declined");
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg-sidebar border-t border-border px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-text-secondary">
        This app uses analytics to improve your experience.
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleAccept}
          className="bg-accent text-white text-sm font-medium px-4 py-1.5 rounded-input hover:opacity-90 transition-opacity"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={handleDecline}
          className="border border-border text-text-secondary text-sm px-4 py-1.5 rounded-input hover:bg-bg-elevated transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
