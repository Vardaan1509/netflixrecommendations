import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import { ClipboardList, Loader2, LogOut, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBackboard } from "@/hooks/useBackboard";
import { useWatchedShows } from "@/hooks/useWatchedShows";

import BackboardChat from "@/components/BackboardChat";
import Questionnaire from "@/components/Questionnaire";
import RecommendationCard from "@/components/RecommendationCard";
import RegionSelector from "@/components/RegionSelector";
import WatchedShows from "@/components/WatchedShows";
import heroBg from "@/assets/netflix-bg.png";

type Step = "start" | "input" | "results";

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
  id?: string;
  title: string;
  type: string;
  genre: string;
  description: string;
  matchReason: string;
  rating: string;
  user_rating?: number | null;
}

const WELCOME_GREETINGS = [
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

const QUESTIONNAIRE_KEYS = [
  "questionnaire-step",
  "questionnaire-preferences",
  "questionnaire-history",
  "questionnaire-current",
  "questionnaire-answer",
  "questionnaire-confidence",
];

/** Persist a piece of state to sessionStorage under `key`. */
function usePersisted<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const saved = sessionStorage.getItem(key);
    return saved !== null ? (JSON.parse(saved) as T) : initial;
  });
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

const Index = () => {
  const [step, setStep] = usePersisted<Step>("questionnaire-step", "start");
  const [preferences, setPreferences] = usePersisted<Preferences | null>(
    "questionnaire-preferences",
    null
  );
  const [region, setRegion] = usePersisted<string>("questionnaire-region", "United States");

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [mode, setMode] = useState<"questionnaire" | "backboard">("backboard");

  const { toast } = useToast();
  const navigate = useNavigate();

  const { shows, loading: showsLoading, addShow, removeShow } = useWatchedShows(session?.user?.id);
  const backboard = useBackboard(session);

  // Auth session bootstrap + subscription
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Cycle the multilingual greeting
  useEffect(() => {
    const id = setInterval(() => {
      setGreetingIndex((i) => (i + 1) % WELCOME_GREETINGS.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    toast({ title: "Signed out" });
    navigate("/");
  };

  const handleGetRecommendations = async () => {
    if (!preferences) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-recommendations", {
        body: { preferences, watchedShows: shows, region },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      if (error) throw error;

      const recs: Recommendation[] = data.recommendations ?? [];

      // Persist for signed-in users so we can attach IDs for ratings
      if (session?.user?.id && recs.length > 0) {
        const rows = recs.map((rec) => ({
          user_id: session.user.id,
          title: rec.title,
          type: rec.type,
          genre: rec.genre,
          description: rec.description,
          match_reason: rec.matchReason,
          rating: rec.rating,
        }));
        const { data: saved } = await supabase.from("recommendations").insert(rows).select();
        setRecommendations(recs.map((rec, i) => ({ ...rec, id: saved?.[i]?.id })));
      } else {
        setRecommendations(recs);
      }

      setStep("results");
    } catch (err) {
      console.error("Error getting recommendations:", err);
      toast({
        title: "Couldn't get recommendations",
        description: "Something went wrong. Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (recommendationId: string, rating: number) => {
    if (!session?.user?.id) return;
    const rec = recommendations.find((r) => r.id === recommendationId);
    if (!rec) return;

    const { error } = await supabase
      .from("recommendations")
      .update({ user_rating: rating })
      .eq("id", recommendationId);
    if (error) {
      toast({ title: "Couldn't save rating", variant: "destructive" });
      return;
    }

    // High ratings power the embedding-based similarity layer
    if (rating >= 4) {
      supabase.functions
        .invoke("generate-embedding", {
          body: { title: rec.title, description: rec.description, rating },
        })
        .catch((e) => console.error("Embedding error:", e));
    }

    backboard.sendFeedback({ feedbackType: "rating", title: rec.title, rating });

    toast({ title: "Rating saved", duration: 2000 });
  };

  const startOver = () => {
    QUESTIONNAIRE_KEYS.forEach((k) => sessionStorage.removeItem(k));
    setPreferences(null);
    setStep("input");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/60">
        <div className="container mx-auto px-6 py-3.5 flex justify-between items-center">
          <button
            onClick={() => setStep("start")}
            className="group flex items-center gap-2 text-sm font-medium tracking-tight text-foreground/90 hover:text-foreground transition-colors"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/80 group-hover:bg-primary transition-colors" />
            smart.netflix
          </button>
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {session.user.email}
                </span>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-xs">
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  Sign out
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/auth")}
                className="h-8 text-xs border-border/80"
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      {step === "start" && (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: `url(${heroBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              animation: "slow-pan 20s ease-in-out infinite alternate",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/50 to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background)/0.9)_90%)]" />

          <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
            <h1
              key={greetingIndex}
              className="animate-greeting font-display text-6xl md:text-7xl lg:text-8xl font-semibold text-foreground tracking-[-0.035em] leading-[1.02]"
            >
              {WELCOME_GREETINGS[greetingIndex]}
            </h1>

            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Stop scrolling endlessly. Personalized Netflix picks based on your mood, preferences,
              and viewing history.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                variant="gradient"
                className="px-7 h-11 text-[15px] font-medium"
                onClick={() => setStep("input")}
              >
                Get Started
              </Button>
              {!session && (
                <Button
                  size="lg"
                  variant="ghost"
                  className="px-7 h-11 text-[15px] font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => navigate("/auth")}
                >
                  Sign in
                </Button>
              )}
            </div>

            <p className="mt-16 text-xs uppercase tracking-[0.18em] text-muted-foreground/60">
              Memory-powered chat &middot; Region-aware picks &middot; Learns from your ratings
            </p>
          </div>
        </section>
      )}

      {step === "input" && (
        <div className="container mx-auto px-4 py-12 max-w-4xl space-y-8 pt-24">
          <div className="text-center space-y-2 mb-8">
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-[-0.02em]">
              Let's find your perfect watch
            </h2>
            <p className="text-muted-foreground">
              Answer a few questions or chat with your memory-powered assistant
            </p>
          </div>

          {session && (
            <div className="flex justify-center">
              <div className="inline-flex rounded-full border border-border/70 bg-card/50 backdrop-blur p-0.5 gap-0.5">
                <ModeButton
                  active={mode === "backboard"}
                  onClick={() => setMode("backboard")}
                  icon={MessageSquare}
                  label="Assistant"
                />
                <ModeButton
                  active={mode === "questionnaire"}
                  onClick={() => setMode("questionnaire")}
                  icon={ClipboardList}
                  label="Questionnaire"
                />
              </div>
            </div>
          )}

          <div className="space-y-6">
            <RegionSelector region={region} onRegionChange={setRegion} />

            {session && mode === "backboard" ? (
              <BackboardChat session={session} watchedShows={shows} region={region} />
            ) : !preferences ? (
              <Questionnaire onComplete={setPreferences} />
            ) : (
              <>
                <WatchedShows
                  shows={shows}
                  loading={showsLoading}
                  onAddShow={addShow}
                  onRemoveShow={removeShow}
                />
                <div className="flex justify-center pt-2">
                  <Button
                    size="lg"
                    variant="gradient"
                    onClick={handleGetRecommendations}
                    disabled={loading}
                    className="px-7 h-11 text-[15px] font-medium min-w-48"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Finding matches
                      </>
                    ) : (
                      "Get recommendations"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {step === "results" && (
        <div className="container mx-auto px-4 py-12 max-w-6xl space-y-8 pt-24">
          <div className="text-center space-y-3">
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-[-0.02em]">
              Your recommendations
            </h2>
            <p className="text-muted-foreground text-sm">
              Based on your preferences and viewing history
            </p>
            <Button variant="outline" size="sm" onClick={startOver} className="h-8 text-xs">
              Start over
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((rec, i) => (
              <RecommendationCard
                key={rec.id ?? i}
                recommendation={rec}
                onRate={session?.user?.id ? handleRate : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── local components ────────────────────────────────────────────── */

const ModeButton = ({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MessageSquare;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
      active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
    }`}
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
  </button>
);

export default Index;
