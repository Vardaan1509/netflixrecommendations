import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

interface WatchedShowsProps {
  shows: string[];
  onShowsChange: (shows: string[]) => void;
}

const WatchedShows = ({ shows, onShowsChange }: WatchedShowsProps) => {
  const [newShow, setNewShow] = useState("");

  const handleAddShow = () => {
    if (newShow.trim() && !shows.includes(newShow.trim())) {
      onShowsChange([...shows, newShow.trim()]);
      setNewShow("");
    }
  };

  const handleRemoveShow = (show: string) => {
    onShowsChange(shows.filter(s => s !== show));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddShow();
    }
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="text-xl">Your Watched Shows</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Add a show you've watched..."
            value={newShow}
            onChange={(e) => setNewShow(e.target.value)}
            onKeyPress={handleKeyPress}
            className="bg-background/50"
          />
          <Button 
            onClick={handleAddShow}
            variant="secondary"
            size="icon"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {shows.length > 0 ? (
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
