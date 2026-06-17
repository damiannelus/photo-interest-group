# Photo Interest Group

A private web app for a small, trusted group of photographers to share work and grow together. The core mechanic: you cannot publish a photo without first writing a reflection — what you were trying to achieve, what worked, and what you'd do differently. Reflection is the gatekeeper, not an afterthought.

## What it does

- **Challenges** — members create and browse photo challenges with a title and description
- **Submissions** — members submit a photo (URL) along with a reflection of at least 50 characters; the Publish button stays disabled until the threshold is crossed
- **Follow-ups** — any submission can seed a follow-up, preserving a visible chain of creative responses
- **Comments** — text comments on any submission for substantive dialogue
- **Access control** — Google Sign-In only; a per-email whitelist gates entry; unrecognized accounts see a rejection screen

## Stack

| Layer | Choice |
|---|---|
| Framework | React Router v7 (full-stack, file-based routing) |
| Auth | Firebase Auth (Google OAuth) |
| Database | Firestore |
| Styling | Tailwind CSS v4 |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions (auto-deploy on merge to `main`) |
| Testing | Vitest + jsdom (app), Vitest + node (Firestore rules) |

## Getting started

```bash
npm install
npm run dev        # starts dev server at http://localhost:5173
```

## Scripts

```bash
npm run dev              # development server with HMR
npm run build            # production build
npm run typecheck        # react-router typegen + tsc
npm run test             # run all app tests
npm run test:rules       # run Firestore security rule tests
npm run test:rules:emulator  # run rule tests against the Firebase emulator
```

## Environment variables

Create a `.env` file at the project root:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

These are also configured as GitHub Actions secrets for CI.

## Access

The member whitelist is managed directly in Firestore (no in-app admin UI). To add a new member, add their Google account email to the whitelist collection out-of-band.
