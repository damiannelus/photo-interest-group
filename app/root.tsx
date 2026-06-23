import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

import type { Route } from "./+types/root";
import "./app.css";

import { AuthProvider } from "~/context/auth";

// Module-level init: runs once per page load, not inside a React effect.
// This ensures the config is always applied even after HMR swaps.
if (typeof window !== "undefined") {
  posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    autocapture: true,
    capture_pageview: "history_change",
    capture_pageleave: true,
    disable_session_recording: false,
    advanced_disable_feature_flags: true,
    opt_out_capturing_by_default: true,
    loaded: (ph) => {
      if (localStorage.getItem("ph_consent") === "accepted") {
        ph.opt_in_capturing();
      }
    },
    before_send: (event) => {
      return localStorage.getItem("ph_consent") === "accepted" ? event : null;
    },
  });
}

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/png", href: "/favicon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <PostHogProvider client={posthog}>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    </PostHogProvider>
  );
}

export function HydrateFallback() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <span className="text-text-secondary text-sm">Loading…</span>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="bg-bg-base text-text-primary pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
