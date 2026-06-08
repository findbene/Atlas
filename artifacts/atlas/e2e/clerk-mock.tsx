/**
 * Phase 60D — test-only `@clerk/react` shim (E2E build ONLY, via the
 * vite.e2e.config alias). Reports a signed-in test learner so the real
 * Certificates page renders without real Clerk keys or network. This file is
 * NEVER bundled by the production `vite.config.ts` — production auth is
 * untouched. It does not weaken any production security boundary.
 */
import type { ReactNode } from "react";

const TEST_USER = {
  id: "user_e2e",
  fullName: "Test Learner",
  primaryEmailAddress: { emailAddress: "learner@example.com" },
};

export function useUser() {
  return { isLoaded: true, isSignedIn: true, user: TEST_USER };
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: "user_e2e",
    sessionId: "sess_e2e",
    getToken: async () => "e2e-token",
    signOut: async () => {},
  };
}

export function useClerk() {
  return { signOut: async () => {}, openSignIn: () => {}, openSignUp: () => {} };
}

export function ClerkProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
export function SignedIn({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
export function SignedOut(_props: { children?: ReactNode }) {
  return null;
}
export function Show({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
export function UserButton() {
  return null;
}
export function SignIn() {
  return null;
}
export function SignUp() {
  return null;
}
