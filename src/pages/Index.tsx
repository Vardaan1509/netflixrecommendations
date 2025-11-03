import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Questionnaire from "@/components/Questionnaire";
import WatchedShows from "@/components/WatchedShows";
import RegionSelector from "@/components/RegionSelector";
import RecommendationCard from "@/components/RecommendationCard";
import { useWatchedShows } from "@/hooks/useWatchedShows";
import { Sparkles, RefreshCw, LogOut } from "lucide-react";
import heroBg from "@/assets/netflix-bg.png";

interface Preferences {
  mood: string;
  genres: string[];
  watchTime: string;
  watchStyle: string;
  language: string;
  company: string;
  underrated: string;
}

interface Recommendation {
  title: string;
  type: string;
  genre: string;
  description: string;
  matchReason: string;
  rating: string;
}

const Index = () => {
  const [step, setStep] = useState<"start" | "input" | "results">("start");
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [region, setRegion] = useState("United States");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { shows, loading: showsLoading, addShow, removeShow } = useWatchedShows(session?.user?.id);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    toast({
      title: "Signed out",
      description: "You've been signed out successfully.",
    });
    navigate("/");
  };

  const handleGetRecommendations = async () => {
    if (!preferences) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-recommendations', {
        body: {
          preferences,
          watchedShows: shows,
          region
        }
      });

      if (error) throw error;

      setRecommendations(data.recommendations);
      setStep("results");
      toast({
        title: "Recommendations ready!",
        description: "Found perfect matches for you",
      });
    } catch (error) {
      console.error('Error getting recommendations:', error);
      toast({
        title: "Error",
        description: "Failed to get recommendations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionnaireComplete = (prefs: Preferences) => {
    setPreferences(prefs);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Auth */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Netflix Recommender</h1>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {session.user.email}
                </span>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {step === "start" && (
        <div 
          className="relative min-h-screen flex items-center justify-center overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url(${heroBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/50 to-background" />
          <div className="relative z-10 text-center px-4 max-w-4xl mx-auto space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-pulse">
                Smart Netflix Recommendations
              </h1>
              <p className="text-xl md:text-2xl text-foreground/80 max-w-2xl mx-auto">
                Stop scrolling endlessly. Get AI-powered recommendations based on your mood, preferences, and viewing history.
              </p>
            </div>
            <Button 
              size="lg" 
              variant="gradient"
              className="text-lg px-8 py-6"
              onClick={() => setStep("input")}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Get Started
            </Button>
          </div>
        </div>
      )}

      {/* Input Section */}
      {step === "input" && (
        <div className="container mx-auto px-4 py-12 max-w-4xl space-y-8 pt-24">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-3xl md:text-4xl font-bold">Let's Find Your Perfect Watch</h2>
            <p className="text-muted-foreground">Answer a few questions to get personalized recommendations</p>
          </div>

          <div className="space-y-6">
            <RegionSelector region={region} onRegionChange={setRegion} />
            
            {!preferences ? (
              <Questionnaire onComplete={handleQuestionnaireComplete} />
            ) : (
              <>
                <WatchedShows 
                  shows={shows} 
                  loading={showsLoading}
                  onAddShow={addShow}
                  onRemoveShow={removeShow}
                />
                
                <div className="flex justify-center pt-4">
                  <Button 
                    size="lg"
                    variant="gradient"
                    onClick={handleGetRecommendations}
                    disabled={loading}
                    className="text-lg px-8"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                        Finding matches...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Get My Recommendations
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Results Section */}
      {step === "results" && (
        <div className="container mx-auto px-4 py-12 max-w-6xl space-y-8 pt-24">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Your Personalized Recommendations</h2>
            <p className="text-muted-foreground">Based on your preferences and viewing history</p>
            <Button 
              variant="outline" 
              onClick={() => {
                setStep("input");
                setPreferences(null);
              }}
            >
              Start Over
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((rec, index) => (
              <RecommendationCard key={index} recommendation={rec} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
