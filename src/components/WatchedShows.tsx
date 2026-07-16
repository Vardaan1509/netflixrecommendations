import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  shows: string[];
  loading?: boolean;
  onAddShow: (show: string) => Promise<boolean>;
  onRemoveShow: (show: string) => Promise<boolean>;
}

const WatchedShows = ({ shows, loading, onAddShow, onRemoveShow }: Props) => {
  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!draft.trim()) return;
    setIsAdding(true);
    const ok = await onAddShow(draft.trim());
    if (ok) setDraft("");
    setIsAdding(false);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur p-6 space-y-4">
      <h3 className="text-lg font-medium">Your watched shows</h3>

      <div className="flex gap-2">
        <Input
          placeholder="Add a show you've watched…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={isAdding}
          maxLength={200}
          className="bg-background/60"
        />
        <Button onClick={handleAdd} variant="secondary" size="icon" disabled={isAdding}>
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : shows.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {shows.map((show) => (
            <Badge
              key={show}
              variant="secondary"
              className="px-3 py-1.5 text-sm gap-1 font-normal"
            >
              {show}
              <button
                onClick={() => onRemoveShow(show)}
                className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${show}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          Add a few titles to sharpen your recommendations.
        </p>
      )}
    </div>
  );
};

export default WatchedShows;
