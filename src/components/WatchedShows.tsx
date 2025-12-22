import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2, Film, Sparkles } from "lucide-react";

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
    <div className="relative">
      {/* Subtle glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl blur-lg opacity-50" />
      
      <div className="relative glass-strong rounded-xl p-6 space-y-5 hover-lift">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
            <Film className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Your Watch History</h3>
            <p className="text-sm text-muted-foreground">Help us avoid recommending shows you've seen</p>
          </div>
        </div>
        
        {/* Input */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Input
              placeholder="Add a show you've watched..."
              value={newShow}
              onChange={(e) => setNewShow(e.target.value)}
              onKeyPress={handleKeyPress}
              className="bg-secondary/50 border-border/50 rounded-xl h-12 pl-4 pr-4 focus:border-accent focus:ring-accent/20"
              disabled={isAdding}
              maxLength={200}
            />
          </div>
          <Button 
            onClick={handleAddShow}
            variant="gradient"
            size="icon"
            disabled={isAdding || !newShow.trim()}
            className="h-12 w-12 rounded-xl shrink-0"
          >
            {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>
        
        {/* Shows list */}
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading your shows...</span>
          </div>
        ) : shows.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {shows.map((show, index) => (
              <Badge 
                key={show} 
                variant="secondary"
                className="group px-4 py-2 text-sm rounded-full bg-secondary/80 hover:bg-secondary border border-border/30 hover:border-primary/30 transition-all animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <span className="mr-2">{show}</span>
                <button
                  onClick={() => handleRemoveShow(show)}
                  className="w-5 h-5 rounded-full bg-muted/50 hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-all group-hover:scale-110"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No shows added yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add some to get better recommendations!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchedShows;
