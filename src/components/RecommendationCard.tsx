import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Film, Tv } from "lucide-react";
import { useState } from "react";

interface Recommendation {
  title: string;
  type: string;
  genre: string;
  description: string;
  matchReason: string;
  rating: string;
  id?: string;
  user_rating?: number | null;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onRate?: (recommendationId: string, rating: number) => void;
}

const RecommendationCard = ({ recommendation, onRate }: RecommendationCardProps) => {
  const [localRating, setLocalRating] = useState(recommendation.user_rating);

  const handleRate = (rating: number) => {
    setLocalRating(rating);
    if (onRate && recommendation.id) {
      onRate(recommendation.id, rating);
    }
  };

  return (
    <Card className="group hover:shadow-[var(--shadow-glow)] transition-all duration-300 bg-gradient-to-br from-card to-card/50 backdrop-blur border-border/50 hover:border-primary/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg group-hover:text-primary transition-colors">
            {recommendation.title}
          </CardTitle>
          <div className="flex items-center gap-1 text-accent shrink-0">
            <Star className="h-4 w-4 fill-current" />
            <span className="text-sm font-semibold">{recommendation.rating}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="gap-1">
            {recommendation.type === "Series" ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
            {recommendation.type}
          </Badge>
          <Badge variant="outline">{recommendation.genre}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground/90">{recommendation.description}</p>
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground italic">
            <span className="text-accent font-medium">Why this?</span> {recommendation.matchReason}
          </p>
        </div>
        {onRate && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">Rate this:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRate(rating)}
                  className="h-7 w-7 p-0 hover:scale-110 transition-transform"
                >
                  <Star 
                    className={`h-4 w-4 transition-colors ${
                      localRating && rating <= localRating 
                        ? 'fill-accent text-accent' 
                        : 'text-muted-foreground'
                    }`} 
                  />
                </Button>
              ))}
            </div>
            {localRating && (
              <span className="text-xs text-accent font-medium ml-1">
                {localRating}/5
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecommendationCard;
