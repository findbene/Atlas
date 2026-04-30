import { useState } from "react";
import { useListBillingPlans, useCreateCheckout } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Zap, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Pricing() {
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const { data: plans, isLoading } = useListBillingPlans();
  const checkoutMutation = useCreateCheckout();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    if (!isSignedIn) {
      navigate("/sign-up");
      return;
    }
    setLoadingPlanId(planId);
    try {
      const result = await checkoutMutation.mutateAsync({
        data: { planId, billingPeriod: billing },
      });
      if (result.url) window.location.href = result.url;
    } catch {
      setLoadingPlanId(null);
    }
  };

  const proPlan = plans?.find((p) => p.tier === "pro");
  const freePlan = plans?.find((p) => p.tier === "free");

  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground text-lg">
            Start free. Upgrade when you're ready to go deep.
          </p>

          <div className="inline-flex mt-8 rounded-lg border border-border p-1 bg-card">
            <button
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setBilling("monthly")}
            >
              Monthly
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${billing === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setBilling("annual")}
            >
              Annual
              <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                Save 43%
              </span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-6">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-96 rounded-2xl bg-card border border-border animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {freePlan && (
              <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground mb-1">
                    {freePlan.name}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {freePlan.description}
                  </p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">$0</span>
                    <span className="text-muted-foreground ml-1">/ month</span>
                  </div>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {freePlan.features?.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link to={isSignedIn ? "/dashboard" : "/sign-up"}>
                  <Button variant="outline" className="w-full">
                    {isSignedIn ? "Go to Dashboard" : "Get Started Free"}
                  </Button>
                </Link>
              </div>
            )}

            {proPlan && (
              <div className="rounded-2xl border-2 border-primary bg-card p-8 flex flex-col relative">
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Most Popular
                </Badge>

                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground mb-1">
                    {proPlan.name}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {proPlan.description}
                  </p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">
                      ${billing === "annual"
                        ? Math.round((proPlan.annualPrice ?? 199) / 12)
                        : (proPlan.monthlyPrice ?? 29)}
                    </span>
                    <span className="text-muted-foreground ml-1">/ month</span>
                    {billing === "annual" && (
                      <span className="ml-2 text-sm text-muted-foreground line-through">
                        ${proPlan.monthlyPrice ?? 29}/mo
                      </span>
                    )}
                  </div>
                  {billing === "annual" && (
                    <p className="text-sm text-green-400 mt-1">
                      Billed ${proPlan.annualPrice ?? 199}/year
                    </p>
                  )}
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {proPlan.features?.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  onClick={() => handleUpgrade(proPlan.id)}
                  disabled={loadingPlanId === proPlan.id}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {loadingPlanId === proPlan.id
                    ? "Redirecting..."
                    : isSignedIn
                      ? "Upgrade to Pro"
                      : "Get Started"}
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          All plans include a 14-day money-back guarantee. No questions asked.
        </p>
      </div>
    </div>
  );
}
