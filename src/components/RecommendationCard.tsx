import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Film, Tv, Sparkles } from "lucide-react";
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
  const [isHovered, setIsHovered] = useState(false);

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
    <div 
      className="group relative h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect on hover */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-2xl blur-lg transition-opacity duration-500 ${isHovered ? 'opacity-30' : 'opacity-0'}`} />
      
      <div className="relative h-full glass-strong rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
        {/* Top gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary" />
        
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
                {recommendation.title}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/20 text-accent shrink-0">
              <Star className="h-4 w-4 fill-current" />
              <span className="text-sm font-bold">{recommendation.rating}</span>
            </div>
          </div>
          
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="secondary" 
              className="gap-1.5 px-3 py-1 rounded-full bg-secondary/80 hover:bg-secondary"
            >
              {recommendation.type === "Series" ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
              {recommendation.type}
            </Badge>
            <Badge 
              variant="outline" 
              className="px-3 py-1 rounded-full border-border/50 hover:border-primary/50 hover:bg-primary/5"
            >
              {recommendation.genre}
            </Badge>
          </div>
          
          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {recommendation.description}
          </p>
          
          {/* Match reason */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <span className="text-primary font-medium">Why this?</span> {recommendation.matchReason}
              </p>
            </div>
          </div>
          
          {/* Rating section */}
          {onRate && !showWatchedQuestion && (
            <div className="pt-4 border-t border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Rate this pick</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => handleRate(rating)}
                      className="p-1.5 rounded-lg hover:bg-accent/20 transition-all hover:scale-125"
                    >
                      <Star 
                        className={`h-5 w-5 transition-all ${
                          localRating && rating <= localRating 
                            ? 'fill-accent text-accent drop-shadow-[0_0_8px_hsl(var(--accent))]' 
                            : 'text-muted-foreground/40 hover:text-accent/60'
                        }`} 
                      />
                    </button>
                  ))}
                  {localRating && (
                    <span className="text-sm font-bold text-accent ml-2">
                      {localRating}/5
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Watched question */}
          {showWatchedQuestion && (
            <div className="space-y-3 pt-4 border-t border-border/30 animate-fade-in">
              <p className="text-sm text-primary font-medium">
                You rated {recommendation.title} highly! Have you watched it?
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleWatchedResponse(false)}
                  className="text-xs hover:bg-secondary/80"
                >
                  Not yet
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleWatchedResponse(true, true)}
                  className="text-xs hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/50"
                >
                  Loved it!
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleWatchedResponse(true, false)}
                  className="text-xs hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50"
                >
                  Didn't like
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecommendationCard;
