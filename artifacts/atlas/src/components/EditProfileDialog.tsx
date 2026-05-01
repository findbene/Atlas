import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateUserProfile, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: {
    username?: string | null;
    displayName?: string | null;
    bio?: string | null;
  };
};

export function EditProfileDialog({ open, onOpenChange, initial }: Props) {
  const [username, setUsername] = useState(initial.username ?? "");
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useUpdateUserProfile();

  useEffect(() => {
    if (open) {
      setUsername(initial.username ?? "");
      setDisplayName(initial.displayName ?? "");
      setBio(initial.bio ?? "");
      setError(null);
    }
  }, [open, initial.username, initial.displayName, initial.bio]);

  async function onSave() {
    setError(null);
    try {
      await mutateAsync({
        data: {
          username: username.trim() || undefined,
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? "Could not save profile.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Customize how you appear on the leaderboard and certificates.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              maxLength={32}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What are you building toward?"
              rows={3}
              maxLength={280}
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/280
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
