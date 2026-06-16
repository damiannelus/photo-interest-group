export function parseAllowedEmails(envString: string): string[] {
  return envString
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const allowedEmails: string[] = parseAllowedEmails(
  import.meta.env.VITE_ALLOWED_EMAILS ?? ""
);
