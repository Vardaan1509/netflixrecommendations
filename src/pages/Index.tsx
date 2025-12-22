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
import AnimatedBackground from "@/components/AnimatedBackground";
import { useWatchedShows } from "@/hooks/useWatchedShows";
import { Sparkles, RefreshCw, LogOut, Star, Play, Film, Tv, Clapperboard } from "lucide-react";
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
  id?: string;
  user_rating?: number | null;
  isRepeat?: boolean;
}

const Index = () => {
  const [step, setStep] = useState<"start" | "input" | "results">(() => {
    const saved = sessionStorage.getItem('questionnaire-step');
    return (saved as "start" | "input" | "results") || "start";
  });
  const [preferences, setPreferences] = useState<Preferences | null>(() => {
    const saved = sessionStorage.getItem('questionnaire-preferences');
    return saved ? JSON.parse(saved) : null;
  });
  const [region, setRegion] = useState(() => {
    return sessionStorage.getItem('questionnaire-region') || "United States";
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [welcomeIndex, setWelcomeIndex] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Persist questionnaire state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('questionnaire-step', step);
  }, [step]);

  useEffect(() => {
    sessionStorage.setItem('questionnaire-preferences', JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    sessionStorage.setItem('questionnaire-region', region);
  }, [region]);
  
  const welcomeMessages = [
    "Welcome",
    "Bienvenido",
    "Bienvenue",
    "Willkommen",
    "Benvenuto",
    "Bem-vindo",
    "欢迎",
    "ようこそ",
    "환영합니다",
    "स्वागत है",
    "مرحبا",
    "Добро пожаловать",
  ];
  
  const { shows, loading: showsLoading, addShow, removeShow } = useWatchedShows(session?.user?.id);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWelcomeIndex((prev) => (prev + 1) % welcomeMessages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [welcomeMessages.length]);

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
      let previousTitles: string[] = [];
      if (session?.user?.id) {
        const { data: prevRecs } = await supabase
          .from('recommendations')
          .select('title')
          .eq('user_id', session.user.id);
        
        if (prevRecs) {
          previousTitles = prevRecs.map(r => r.title.toLowerCase());
        }
      }

      const { data, error } = await supabase.functions.invoke('get-recommendations', {
        body: {
          preferences,
          watchedShows: shows,
          region
        },
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : undefined
      });

      if (error) throw error;

      if (session?.user?.id) {
        const recommendationsToSave = data.recommendations.map((rec: Recommendation) => ({
          user_id: session.user.id,
          title: rec.title,
          type: rec.type,
          genre: rec.genre,
          description: rec.description,
          match_reason: rec.matchReason,
          rating: rec.rating,
        }));

        const { data: savedRecs, error: saveError } = await supabase
          .from('recommendations')
          .insert(recommendationsToSave)
          .select();

        if (saveError) {
          console.error('Error saving recommendations:', saveError);
        } else if (savedRecs) {
          const recsWithIds = data.recommendations.map((rec: Recommendation, idx: number) => ({
            ...rec,
            id: savedRecs[idx]?.id,
            isRepeat: previousTitles.includes(rec.title.toLowerCase()),
          }));
          setRecommendations(recsWithIds);
        }
      } else {
        setRecommendations(data.recommendations);
      }

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

  const handleRateRecommendation = async (recommendationId: string, rating: number) => {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('recommendations')
        .update({ user_rating: rating })
        .eq('id', recommendationId);

      if (error) throw error;

      if (rating >= 4) {
        const recommendation = recommendations.find(r => r.id === recommendationId);
        if (recommendation) {
          console.log('Generating embedding for highly rated show:', recommendation.title);
          
          supabase.functions
            .invoke('generate-embedding', {
              body: {
                title: recommendation.title,
                description: recommendation.description,
                rating: rating
              }
            })
            .then(({ error: embeddingError }) => {
              if (embeddingError) {
                console.error('Error generating embedding:', embeddingError);
              } else {
                console.log('Embedding generated successfully for:', recommendation.title);
              }
            });
        }
      }

      toast({
        title: "Thanks for rating!",
        description: "Your feedback helps improve future recommendations.",
        duration: 2000,
      });
    } catch (error) {
      console.error('Error rating recommendation:', error);
      toast({
        title: "Error",
        description: "Failed to save rating. Please try again.",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleWatchedStatus = async (recommendationId: string, watched: boolean, liked?: boolean) => {
    if (!session?.user?.id) return;

    try {
      const updateData: Record<string, unknown> = { watched };
      
      if (liked === false) {
        updateData.user_rating = 1;
      }

      const { error } = await supabase
        .from('recommendations')
        .update(updateData)
        .eq('id', recommendationId);

      if (error) throw error;

      toast({
        title: "Got it!",
        description: watched 
          ? "Thanks for the feedback! We'll use this to improve your recommendations."
          : "We'll keep that in mind for future suggestions.",
        duration: 2000,
      });

      setRecommendations(prev => prev.map(rec => 
        rec.id === recommendationId 
          ? { ...rec, user_rating: (updateData.user_rating as number) ?? rec.user_rating }
          : rec
      ));
    } catch (error) {
      console.error('Error updating watched status:', error);
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleQuestionnaireComplete = (prefs: Preferences) => {
    setPreferences(prefs);
  };

  const floatingIcons = [
    { Icon: Film, delay: 0, x: "10%", y: "20%" },
    { Icon: Tv, delay: 2, x: "85%", y: "15%" },
    { Icon: Clapperboard, delay: 4, x: "15%", y: "70%" },
    { Icon: Star, delay: 1, x: "80%", y: "75%" },
    { Icon: Play, delay: 3, x: "50%", y: "85%" },
  ];

  return (
    <div className="min-h-screen bg-background relative">
      <AnimatedBackground variant={step === "start" ? "hero" : "page"} />
      
      {/* Header with Auth */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button 
            onClick={() => setStep('start')}
            className="group flex items-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold gradient-text hidden sm:inline">
              StreamPick AI
            </span>
          </button>
          
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <span className="text-sm text-muted-foreground hidden md:inline px-3 py-1.5 rounded-full bg-secondary/50">
                  {session.user.email}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSignOut}
                  className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </>
            ) : (
              <Button 
                variant="gradient" 
                size="sm" 
                onClick={() => navigate("/auth")}
                className="gap-2"
              >
                <Star className="h-4 w-4" />
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {step === "start" && (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
          {/* Hero background image with overlay */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url(${heroBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              animation: 'slow-pan 30s ease-in-out infinite alternate',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
          
          {/* Floating icons */}
          {floatingIcons.map(({ Icon, delay, x, y }, i) => (
            <div
              key={i}
              className="absolute text-primary/20 animate-float pointer-events-none"
              style={{
                left: x,
                top: y,
                animationDelay: `${delay}s`,
                animationDuration: `${6 + i}s`,
              }}
            >
              <Icon size={32 + i * 4} />
            </div>
          ))}
          
          <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
            {/* Main content */}
            <div className="space-y-8 animate-fade-in-up">
              {/* Welcome badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/30">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm font-medium">AI-Powered Recommendations</span>
              </div>
              
              {/* Main heading */}
              <div className="space-y-4">
                <h1 className="text-6xl md:text-8xl font-bold">
                  <span className="gradient-text-shimmer">{welcomeMessages[welcomeIndex]}</span>
                </h1>
                <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Stop scrolling endlessly. Get personalized recommendations based on your 
                  <span className="text-primary font-medium"> mood</span>, 
                  <span className="text-accent font-medium"> preferences</span>, and 
                  <span className="text-primary font-medium"> viewing history</span>.
                </p>
              </div>
              
              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button 
                  size="lg" 
                  variant="gradient"
                  className="text-lg px-10 py-7 rounded-2xl animate-pulse-glow hover:scale-105 transition-transform"
                  onClick={() => setStep("input")}
                >
                  <Play className="mr-2 h-5 w-5" />
                  Get Started
                </Button>
                
                {!session && (
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="text-lg px-8 py-7 rounded-2xl hover:bg-primary/10 hover:border-primary/50 transition-all"
                    onClick={() => navigate("/auth")}
                  >
                    Sign in for more features
                  </Button>
                )}
              </div>
              
              {/* Feature highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12 max-w-2xl mx-auto">
                {[
                  { icon: Star, label: "Rate Shows", desc: "Track your favorites" },
                  { icon: Film, label: "Smart AI", desc: "Learns your taste" },
                  { icon: Tv, label: "Save Lists", desc: "Never forget a show" },
                ].map(({ icon: FeatureIcon, label, desc }, i) => (
                  <div 
                    key={label}
                    className="group p-4 rounded-2xl glass hover:bg-card/80 transition-all duration-300 hover:scale-105 cursor-default"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <FeatureIcon className="w-8 h-8 text-primary mb-2 mx-auto group-hover:scale-110 transition-transform" />
                    <p className="font-semibold">{label}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-soft">
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
              <div className="w-1 h-2 bg-muted-foreground/50 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Input Section */}
      {step === "input" && (
        <div className="container mx-auto px-4 py-12 max-w-4xl space-y-8 pt-28 animate-fade-in">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/30 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm">Personalization Mode</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold gradient-text">
              Let's Find Your Perfect Watch
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Answer a few questions to get AI-powered recommendations tailored just for you
            </p>
            
            {!session && (
              <button 
                onClick={() => navigate("/auth")}
                className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full glass border border-primary/30 text-sm hover:bg-primary/10 transition-colors group"
              >
                <Star className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                <span>
                  <span className="text-primary font-medium">Sign in</span>
                  <span className="text-muted-foreground"> to save shows & rate recommendations</span>
                </span>
              </button>
            )}
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
                
                <div className="flex justify-center pt-8">
                  <Button 
                    size="lg"
                    variant="gradient"
                    onClick={handleGetRecommendations}
                    disabled={loading}
                    className="text-lg px-10 py-7 rounded-2xl hover:scale-105 transition-transform animate-pulse-glow"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                        Finding perfect matches...
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
        <div className="container mx-auto px-4 py-12 max-w-7xl space-y-8 pt-28 animate-fade-in">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-accent/30 mb-4">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm">Your Results</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold gradient-text">
              Your Personalized Picks
            </h2>
            <p className="text-muted-foreground text-lg">
              Based on your mood, preferences, and viewing history
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                sessionStorage.removeItem('questionnaire-history');
                sessionStorage.removeItem('questionnaire-current');
                sessionStorage.removeItem('questionnaire-answer');
                sessionStorage.removeItem('questionnaire-preferences');
                sessionStorage.removeItem('questionnaire-confidence');
                setStep("input");
                setPreferences(null);
              }}
              className="mt-4 gap-2 hover:bg-primary/10 hover:border-primary/50"
            >
              <RefreshCw className="h-4 w-4" />
              Start Over
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((rec, index) => (
              <div
                key={rec.id || index}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <RecommendationCard 
                  recommendation={rec}
                  onRate={session?.user?.id ? handleRateRecommendation : undefined}
                  onWatchedStatus={session?.user?.id ? handleWatchedStatus : undefined}
                  isRepeat={rec.isRepeat || false}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
