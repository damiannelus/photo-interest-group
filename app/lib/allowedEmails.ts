export const allowedEmails: string[] = (import.meta.env.VITE_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);
