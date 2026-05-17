import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, UserButton, useClerk } from "@clerk/react";
import { Button } from "./ui/button";
import { Flame, Trophy, Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { ThemeToggle } from "./ThemeToggle";

function useTutorUnread(isSignedIn: boolean | undefined): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isSignedIn) {
      setCount(0);
      return;
    }
    let cancelled = false;
    async function fetchOnce() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/ai/chat/unread`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled) setCount(data.count ?? 0);
      } catch {
        /* best-effort */
      }
    }
    void fetchOnce();
    // Poll every 60s. Cheap COUNT-only query, indexed on (user_id, created_at).
    const interval = setInterval(fetchOnce, 60_000);
    // Also refresh when the tab becomes visible again so the badge updates
    // immediately when the user comes back from another tab.
    function onVis() { if (document.visibilityState === "visible") void fetchOnce(); }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isSignedIn]);
  return count;
}

export function Navbar() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const unread = useTutorUnread(isSignedIn);

  async function handleSignOut() {
    await signOut({ redirectUrl: "/" });
  }

  const isHome = location === "/";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 glass">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">
              ATLAS
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/domains"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Domains
            </Link>
            <Link
              href="/pricing"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Pricing
            </Link>
            {isSignedIn && (
              <>
                <Link
                  href="/dashboard"
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  Dashboard
                </Link>
                <Link
                  href="/leaderboard"
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  Leaderboard
                </Link>
                <Link
                  href="/conversations"
                  className="relative transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  Tutor
                  {unread > 0 && (
                    <span
                      className="ml-1.5 inline-flex items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white px-1.5 min-w-[1.125rem] h-[1.125rem] leading-none"
                      aria-label={`${unread} unread tutor message${unread === 1 ? "" : "s"}`}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              </>
            )}
          </nav>
        </div>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <div className="px-7 flex flex-col space-y-4 py-4">
              <Link href="/" className="font-bold">ATLAS</Link>
              <Link href="/domains">Domains</Link>
              <Link href="/pricing">Pricing</Link>
              {isSignedIn && (
                <>
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/leaderboard">Leaderboard</Link>
                  <Link href="/conversations" className="flex items-center gap-2">
                    Tutor
                    {unread > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white px-1.5 min-w-[1.125rem] h-[1.125rem] leading-none">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Link>
                  <Link href="/certificates">Certificates</Link>
                  <Link href="/profile">Profile</Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-left text-red-400 hover:text-red-300"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </>
              )}
              {!isSignedIn && (
                <>
                  <Link href="/sign-in">Sign in</Link>
                  <Link href="/sign-up">Get Started</Link>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Optional Search */}
          </div>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            {!isSignedIn ? (
              <>
                <Button asChild variant="ghost" size="sm"><Link href="/sign-in">
                    Sign in
                  </Link></Button>
                <Button asChild size="sm"><Link href="/sign-up">
                    Get Started
                  </Link></Button>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span>0</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span>Lvl 1</span>
                  </div>
                </div>
                <UserButton />
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
