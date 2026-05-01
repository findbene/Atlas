import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Code2, Database, Terminal, Zap } from "lucide-react";
import { useUser } from "@clerk/react";

export default function Home() {
  const { isSignedIn } = useUser();
  const primaryHref = isSignedIn ? "/dashboard" : "/sign-up";
  const primaryLabel = isSignedIn ? "Go to Dashboard" : "Start Building Free";
  const footerLabel = isSignedIn ? "Open Your Dashboard" : "Create Your Free Account";
  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Hero Section */}
      <section className="relative px-6 py-24 md:py-32 overflow-hidden flex-1 flex flex-col justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background -z-10" />
        <div className="container max-w-5xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance">
            Stop watching tutorials.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
              Start building systems.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            The project-first technical learning platform for ambitious engineers. Master Data Engineering, AI, and MLOps through hands-on execution in a professional browser-based IDE.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Button asChild size="lg" className="w-full sm:w-auto h-12 px-8 text-base"><Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link></Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base"><Link href="/domains">
                Explore Domains
              </Link></Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-muted/50 border-t border-border/50">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">A serious tool for serious engineers</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We built Atlas because watching someone else code doesn't make you an engineer. Executing real-world projects does.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-card border border-border p-6 rounded-xl space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Terminal className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold">Professional IDE</h3>
              <p className="text-muted-foreground">
                Write, run, and debug Python and SQL directly in the browser with Monaco editor. No local setup required.
              </p>
            </div>
            <div className="bg-card border border-border p-6 rounded-xl space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold">Real Data Architecture</h3>
              <p className="text-muted-foreground">
                Build ETL pipelines, data warehouses, and analytics models using industry-standard tools and patterns.
              </p>
            </div>
            <div className="bg-card border border-border p-6 rounded-xl space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Code2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold">Step-by-step Execution</h3>
              <p className="text-muted-foreground">
                Complex systems broken down into atomic, testable steps. Get immediate feedback on your code.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer CTA */}
      <section className="py-24 border-t border-border">
        <div className="container max-w-4xl mx-auto text-center space-y-8 px-6">
          <Zap className="h-12 w-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold">Ready to level up your engineering career?</h2>
          <p className="text-muted-foreground text-lg">Join thousands of engineers building real systems on Atlas.</p>
          <Button asChild size="lg" className="h-12 px-8 text-base mt-4"><Link href={primaryHref}>
              {footerLabel}
            </Link></Button>
        </div>
      </section>
    </div>
  );
}