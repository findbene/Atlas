import { useState } from "react";
import { useListBillingPlans, useCreateCheckout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Sparkles, Zap } from "lucide-react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";

export default function Upgrade() {
  const { isSignedIn } = useAuth();
  const { data: plans, isLoading } = useListBillingPlans();
  const checkoutMutation = useCreateCheckout();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  async function handleUpgrade(plan: any) {
    if (!isSignedIn) {
      window.location.href = "/sign-in";
      return;
    }
    if (plan.tier === "free") return;
    setLoadingPlanId(plan.id);
    const priceId = billing === "annual" ? plan.stripePriceIdAnnual : plan.stripePriceIdMonthly;
    const origin = window.location.origin;
    checkoutMutation.mutate({
      priceId,
      billingInterval: billing,
      successUrl: `${origin}/dashboard?upgraded=true`,
      cancelUrl: `${origin}/upgrade`,
    } as any, {
      onSuccess: (data: any) => {
        if (data.url) window.location.href = data.url;
        setLoadingPlanId(null);
      },
      onError: () => setLoadingPlanId(null),
    });
  }

  const proPlan = (plans as any[])?.find((p: any) => p.tier === "pro");
  const freePlan = (plans as any[])?.find((p: any) => p.tier === "free");

  return (
    <div className="container max-w-4xl mx-auto py-16 px-6">
      <div className="text-center mb-12">
        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 mb-4">
          <Sparkles className="h-3 w-3 mr-1" />
          Atlas Pro
        </Badge>
        <h1 className="text-4xl font-bold mb-3">Unlock Your Full Potential</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Get unlimited access to all projects, mastery courses, and AI tutoring to land your Data Engineering role.
        </p>
        <div className="flex items-center justify-center gap-2 mt-6 bg-muted/50 border border-border rounded-full w-fit mx-auto p-1">
          {(["monthly", "annual"] as const).map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billing === b ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              {b === "monthly" ? "Monthly" : "Annual"}{b === "annual" && <span className="ml-2 text-xs text-emerald-400 font-semibold">Save 40%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className="bg-card border border-border rounded-2xl p-7">
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-1">Free</h2>
            <p className="text-muted-foreground text-sm">{freePlan?.description ?? "Start your journey"}</p>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <Button variant="outline" className="w-full mb-6" asChild>
            <Link href="/dashboard">Get Started Free</Link>
          </Button>
          <div className="space-y-3">
            {(freePlan?.features ?? []).map((f: string) => (
              <div key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Pro Plan */}
        <div className="bg-card border-2 border-primary relative rounded-2xl p-7">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground px-4 py-0.5">
              <Zap className="h-3 w-3 mr-1" />
              Most Popular
            </Badge>
          </div>
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-1">Pro</h2>
            <p className="text-muted-foreground text-sm">{proPlan?.description ?? "Full access"}</p>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-bold">
              ${billing === "annual" ? Math.round((proPlan?.annualPrice ?? 199) / 12) : (proPlan?.monthlyPrice ?? 29)}
            </span>
            <span className="text-muted-foreground">/month</span>
            {billing === "annual" && (
              <p className="text-sm text-muted-foreground mt-1">Billed ${proPlan?.annualPrice ?? 199}/year</p>
            )}
          </div>
          <Button className="w-full mb-6" onClick={() => handleUpgrade(proPlan)} disabled={!!loadingPlanId || isLoading}>
            <Zap className="h-4 w-4 mr-2" />
            {loadingPlanId === "pro" ? "Redirecting..." : "Upgrade to Pro"}
          </Button>
          <div className="space-y-3">
            {(proPlan?.features ?? []).map((f: string) => (
              <div key={f} className="flex items-start gap-2.5 text-sm">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-8">
        Cancel anytime. No contracts. 7-day money-back guarantee.
      </p>
    </div>
  );
}
