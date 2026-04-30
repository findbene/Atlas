import { useState, type FormEvent } from "react";
import { useJoinWaitlist } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

interface WaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domainSlug: string;
  domainName: string;
}

export function WaitlistDialog({ open, onOpenChange, domainSlug, domainName }: WaitlistDialogProps) {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState<{ alreadyOnWaitlist: boolean; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const join = useJoinWaitlist();

  const isPending = join.isPending;

  function reset() {
    setEmail("");
    setSuccess(null);
    setErrorMessage(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage("Please enter your email.");
      return;
    }
    try {
      const result = await join.mutateAsync({
        data: { email: trimmed, domainInterest: domainSlug },
      });
      setSuccess({
        alreadyOnWaitlist: result.alreadyOnWaitlist,
        message: result.message,
      });
    } catch (err: any) {
      const fieldErr = err?.body?.details?.fieldErrors?.email?.[0];
      setErrorMessage(fieldErr ?? err?.body?.error ?? "Couldn't join the waitlist. Try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-center mb-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
              </div>
              <DialogTitle className="text-center">
                {success.alreadyOnWaitlist ? "You're already in" : "You're on the list"}
              </DialogTitle>
              <DialogDescription className="text-center">{success.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button onClick={() => handleOpenChange(false)}>Close</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Join the {domainName} waitlist</DialogTitle>
              <DialogDescription>
                Be the first to know when this curriculum opens. We'll only email you about{" "}
                {domainName} — no spam, ever.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="waitlist-email">Email</Label>
              <Input
                id="waitlist-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                autoFocus
              />
              {errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining…
                  </>
                ) : (
                  "Join waitlist"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
