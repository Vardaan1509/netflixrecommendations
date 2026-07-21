import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Film, Tv } from "lucide-react";

interface Recommendation {
  id?: string;
  title: string;
  type: string;
  genre: string;
  description: string;
  matchReason: string;
  rating: string;
  user_rating?: number | null;
}

interface Props {
  recommendation: Recommendation;
  onRate?: (id: string, rating: number) => void;
}

const RecommendationCard = ({ recommendation, onRate }: Props) => {
  const [localRating, setLocalRating] = useState(recommendation.user_rating ?? null);

  const rate = (rating: number) => {
    setLocalRating(rating);
    if (recommendation.id) onRate?.(recommendation.id, rating);
  };

  const TypeIcon = recommendation.type === "Series" ? Tv : Film;

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur p-5 space-y-3 hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="font-medium text-[15px] truncate">{recommendation.title}</h3>
        </div>
        <div className="flex items-center gap-1 text-foreground/80 shrink-0">
          <Star className="h-3.5 w-3.5 fill-current" />
          <span className="text-xs font-medium tabular-nums">{recommendation.rating}</span>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <Badge variant="secondary" className="text-[10px] h-5 font-normal">
          {recommendation.type}
        </Badge>
        <Badge variant="outline" className="text-[10px] h-5 font-normal border-border/70">
          {recommendation.genre}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        {recommendation.description}
      </p>

      <p className="text-xs text-muted-foreground/80 border-l-2 border-primary/40 pl-3 py-0.5">
        <span className="font-medium text-foreground/70">Why:</span> {recommendation.matchReason}
      </p>

      {onRate && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-border/60">
          <span className="text-xs text-muted-foreground">Rate</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                size="sm"
                variant="ghost"
                onClick={() => rate(n)}
                className="h-6 w-6 p-0 hover:bg-transparent"
                aria-label={`Rate ${n} stars`}
              >
                <Star
                  className={`h-3.5 w-3.5 transition-colors ${
                    localRating && n <= localRating
                      ? "fill-foreground/80 text-foreground/80"
                      : "text-muted-foreground/40 hover:text-foreground/60"
                  }`}
                />
              </Button>
            ))}
          </div>
          {localRating && (
            <span className="text-xs text-muted-foreground ml-1 tabular-nums">{localRating}/5</span>
          )}
        </div>
      )}
    </div>
  );
};

export default RecommendationCard;
