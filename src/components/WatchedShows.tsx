import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";

interface WatchedShowsProps {
  shows: string[];
  loading?: boolean;
  onAddShow: (show: string) => Promise<boolean>;
  onRemoveShow: (show: string) => Promise<boolean>;
}

const WatchedShows = ({ shows, loading, onAddShow, onRemoveShow }: WatchedShowsProps) => {
  const [newShow, setNewShow] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddShow = async () => {
    if (!newShow.trim()) return;
    
    setIsAdding(true);
    const success = await onAddShow(newShow.trim());
    if (success) {
      setNewShow("");
    }
    setIsAdding(false);
  };

  const handleRemoveShow = async (show: string) => {
    await onRemoveShow(show);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddShow();
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">Your Watched Shows</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Add a show you've watched..."
            value={newShow}
            onChange={(e) => setNewShow(e.target.value)}
            onKeyPress={handleKeyPress}
            className="bg-secondary border-border"
            disabled={isAdding}
            maxLength={200}
          />
          <Button 
            onClick={handleAddShow}
            variant="secondary"
            size="icon"
            disabled={isAdding}
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : shows.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {shows.map((show) => (
              <Badge 
                key={show} 
                variant="secondary"
                className="px-3 py-1.5 text-sm flex items-center gap-1"
              >
                {show}
                <button
                  onClick={() => handleRemoveShow(show)}
                  className="ml-1 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No shows added yet. Add some to get better recommendations!
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default WatchedShows;
