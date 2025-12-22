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
  onWatchedStatus?: (recommendationId: string, watched: boolean, liked?: boolean) => void;
  isRepeat?: boolean;
}

const RecommendationCard = ({ recommendation, onRate, onWatchedStatus, isRepeat = false }: RecommendationCardProps) => {
  const [localRating, setLocalRating] = useState(recommendation.user_rating);
  const [showWatchedQuestion, setShowWatchedQuestion] = useState(false);

  const handleRate = (rating: number) => {
    setLocalRating(rating);
    if (onRate && recommendation.id) {
      onRate(recommendation.id, rating);
      
      if (rating >= 4 && onWatchedStatus && isRepeat) {
        setShowWatchedQuestion(true);
      }
    }
  };

  const handleWatchedResponse = (watched: boolean, liked?: boolean) => {
    if (onWatchedStatus && recommendation.id) {
      onWatchedStatus(recommendation.id, watched, liked);
      setShowWatchedQuestion(false);
    }
  };

  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">
            {recommendation.title}
          </CardTitle>
          <div className="flex items-center gap-1 text-primary shrink-0">
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
        <p className="text-sm text-muted-foreground">{recommendation.description}</p>
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">Why this?</span> {recommendation.matchReason}
          </p>
        </div>
        
        {onRate && !showWatchedQuestion && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Rate:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRate(rating)}
                  className="h-7 w-7 p-0"
                >
                  <Star 
                    className={`h-4 w-4 ${
                      localRating && rating <= localRating 
                        ? 'fill-primary text-primary' 
                        : 'text-muted-foreground'
                    }`} 
                  />
                </Button>
              ))}
            </div>
            {localRating && (
              <span className="text-xs text-primary font-medium ml-1">
                {localRating}/5
              </span>
            )}
          </div>
        )}
        
        {showWatchedQuestion && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm text-primary font-medium">
              Have you watched {recommendation.title}?
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleWatchedResponse(false)} className="flex-1">
                Not yet
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleWatchedResponse(true, true)} className="flex-1">
                Loved it!
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleWatchedResponse(true, false)} className="flex-1">
                Didn't like
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecommendationCard;
