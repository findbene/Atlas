import { Link, useLocation } from "wouter";
import { useAuth, UserButton } from "@clerk/react";
import { Button } from "./ui/button";
import { Flame, Trophy, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

export function Navbar() {
  const { isSignedIn } = useAuth();
  const [location] = useLocation();

  const isHome = location === "/";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                  <Link href="/certificates">Certificates</Link>
                  <Link href="/profile">Profile</Link>
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
            {!isSignedIn ? (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm">
                    Get Started
                  </Button>
                </Link>
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
                <UserButton afterSignOutUrl="/" />
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
