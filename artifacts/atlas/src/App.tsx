import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { ThemeProvider } from '@/components/ThemeProvider';
import { OnboardingTour } from '@/components/OnboardingTour';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Navbar } from "@/components/Navbar";

// Pages
import Home from "@/pages/home";
import Pricing from "@/pages/pricing";
import Domains from "@/pages/domains";
import DomainDetail from "@/pages/domain-detail";
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/course-detail";
import Dashboard from "@/pages/dashboard";
import ProjectWorkspace from "@/pages/project-workspace";
import Profile from "@/pages/profile";
import Leaderboard from "@/pages/leaderboard";
import Certificates from "@/pages/certificates";
import CertificatePrint from "@/pages/certificate-print";
import Conversations from "@/pages/conversations";
import TutorPage from "@/pages/tutor";
import Upgrade from "@/pages/upgrade";
import PythonMastery from "@/pages/python-mastery";
import SqlMastery from "@/pages/sql-mastery";
import PublicProfile from "@/pages/public-profile";
import Verify from "@/pages/verify";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PageTransition } from "@/components/PageTransition";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

// The generated API client already uses full paths like /api/...
// No base URL needed for web apps served from the same domain

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY env var');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
  },
  variables: {
    colorPrimary: "hsl(217, 91%, 60%)",
    colorForeground: "hsl(210, 20%, 98%)",
    colorMutedForeground: "hsl(215, 20.2%, 65.1%)",
    colorDanger: "hsl(0, 62.8%, 30.6%)",
    colorBackground: "hsl(225, 26%, 8%)",
    colorInput: "hsl(226, 22%, 19%)",
    colorInputForeground: "hsl(210, 20%, 98%)",
    colorNeutral: "hsl(226, 22%, 19%)",
    fontFamily: "'Inter', sans-serif",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card rounded-2xl w-[440px] max-w-full overflow-hidden border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    // ---- UserButton popover ----
    // The shadcn Clerk theme leaves the popover transparent on our background,
    // which makes the action labels and icons invisible. Pin explicit colors
    // that match our card so name/email/avatar AND the Manage account / Sign
    // out actions all stay readable.
    userButtonAvatarBox: "h-9 w-9 ring-2 ring-border hover:ring-primary/60 transition",
    userButtonPopoverCard:
      "!bg-card !border !border-border !shadow-xl !rounded-xl !text-foreground",
    userButtonPopoverMain: "!bg-card",
    userButtonPopoverActions: "!bg-card",
    userButtonPopoverActionButton:
      "!text-foreground hover:!bg-muted/60 !transition-colors",
    userButtonPopoverActionButtonText: "!text-foreground !font-medium",
    userButtonPopoverActionButtonIcon: "!text-primary",
    userButtonPopoverFooter: "!bg-card !border-t !border-border",
    userPreview: "!bg-card",
    userPreviewMainIdentifier: "!text-foreground !font-semibold",
    userPreviewSecondaryIdentifier: "!text-muted-foreground !text-xs",
    userPreviewAvatarContainer: "!ring-2 !ring-border",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener, session } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Wire up Clerk token to API client
  useEffect(() => {
    setAuthTokenGetter(async () => {
      if (!session) return null;
      return session.getToken();
    });
  }, [session]);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={basePath || "/"}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ThemeProvider>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          <Navbar />
          <OnboardingTour />
          <main className="flex-1 flex flex-col">
            <PageTransition>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/pricing" component={Pricing} />
              <Route path="/courses" component={Courses} />
              <Route path="/courses/:slug" component={CourseDetail} />
              <Route path="/projects"><Redirect to="/courses" /></Route>
              {/* Phase 10 — `/domains` kept as internal/legacy alias; learner nav points at `/courses`. */}
              <Route path="/domains" component={Domains} />
              <Route path="/domains/:slug" component={DomainDetail} />
              <Route path="/u/:username" component={PublicProfile} />
              <Route path="/verify/:certId" component={Verify} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />

              <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
              <Route path="/projects/:slug"><ProtectedRoute component={ProjectWorkspace} /></Route>
              <Route path="/python-mastery"><ProtectedRoute component={PythonMastery} /></Route>
              <Route path="/sql-mastery"><ProtectedRoute component={SqlMastery} /></Route>
              <Route path="/certificates"><ProtectedRoute component={Certificates} /></Route>
              <Route path="/certificates/:slug/print"><ProtectedRoute component={CertificatePrint} /></Route>
              <Route path="/conversations"><ProtectedRoute component={Conversations} /></Route>
              <Route path="/tutor"><ProtectedRoute component={TutorPage} /></Route>
              <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
              <Route path="/upgrade"><ProtectedRoute component={Upgrade} /></Route>
              <Route path="/leaderboard"><ProtectedRoute component={Leaderboard} /></Route>
              
              <Route component={NotFound} />
            </Switch>
            </PageTransition>
          </main>
        </div>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <TooltipProvider>
        <ClerkProviderWithRoutes />
        <Toaster />
        <InstallPrompt />
      </TooltipProvider>
    </WouterRouter>
  );
}

export default App;
