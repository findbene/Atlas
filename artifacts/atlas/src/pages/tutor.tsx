import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiTutorPanel } from "@/components/AiTutorPanel";

export default function TutorPage() {
  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 h-[calc(100dvh-4rem)] flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/conversations">
            <ArrowLeft className="h-4 w-4 mr-1" /> All conversations
          </Link>
        </Button>
        <h1 className="text-xl font-bold ml-2">General Tutor Chat</h1>
      </div>
      <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden">
        <AiTutorPanel
          projectId={null}
          emptyStateTitle="Ask Atlas anything about Data Engineering."
          emptyStateSubtitle="Career advice, concept reviews, debugging help — anything."
          className="bg-card/50"
        />
      </div>
    </div>
  );
}
