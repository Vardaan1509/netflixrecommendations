import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Film, Tv } from "lucide-react";

interface Recommendation {
  title: string;
  type: string;
  genre: string;
  description: string;
  matchReason: string;
  rating: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
}

const RecommendationCard = ({ recommendation }: RecommendationCardProps) => {
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
      </CardContent>
    </Card>
  );
};

export default RecommendationCard;
