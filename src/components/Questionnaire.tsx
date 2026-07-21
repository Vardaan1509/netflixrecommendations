import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: string;
  question: string;
  type: "radio" | "checkbox";
  options: string[];
}

type Answer = string | string[];

interface HistoryEntry {
  question: Question;
  answer: Answer;
}

interface QuestionnaireProps {
  onComplete: (preferences: unknown) => void;
}

const FIRST_QUESTION: Question = {
  id: "mood",
  question: "How is your day going so far?",
  type: "radio",
  options: [
    "Great, everything is going well!",
    "Pretty good, can't complain.",
    "It's okay, nothing special.",
    "A bit stressful, to be honest.",
    "Not so great, having a rough day.",
    "Could be better, thanks for asking.",
    "I'm feeling tired or overwhelmed.",
    "Excited and productive today",
  ],
};

/** All the questionnaire state lives here — persisted as one blob. */
const STATE_KEY = "questionnaire-state";

interface PersistedState {
  history: HistoryEntry[];
  current: Question;
  answer: Answer;
  confidence: number;
}

const loadState = (): PersistedState => {
  const saved = sessionStorage.getItem(STATE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      /* fall through */
    }
  }
  return { history: [], current: FIRST_QUESTION, answer: "", confidence: 10 };
};

const Questionnaire = ({ onComplete }: QuestionnaireProps) => {
  const { toast } = useToast();
  const [state, setState] = useState<PersistedState>(loadState);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state]);

  const { history, current, answer, confidence } = state;

  const canProceed = Array.isArray(answer) ? answer.length > 0 : answer !== "";

  const setAnswer = (a: Answer) => setState((s) => ({ ...s, answer: a }));

  const toggleCheckbox = (option: string) => {
    if (!Array.isArray(answer)) return;
    setAnswer(answer.includes(option) ? answer.filter((o) => o !== option) : [...answer, option]);
  };

  const handleNext = async () => {
    if (!canProceed) return;
    setIsLoading(true);

    const nextHistory = [...history, { question: current, answer }];

    try {
      const { data, error } = await supabase.functions.invoke("get-next-question", {
        body: {
          conversationHistory: nextHistory.map((h) => ({
            question: h.question.question,
            answer: h.answer,
          })),
        },
      });
      if (error) throw error;

      if (data.ready) {
        sessionStorage.removeItem(STATE_KEY);
        onComplete(data.preferences);
        return;
      }

      if (data.needsClarification) {
        toast({ title: "Let's try again", description: data.message });
      }

      setState({
        history: nextHistory,
        current: data.nextQuestion,
        answer: data.nextQuestion.type === "checkbox" ? [] : "",
        confidence: data.confidence ?? confidence,
      });
    } catch (err) {
      console.error("Error getting next question:", err);
      toast({
        title: "Couldn't process that",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setState((s) => ({
      ...s,
      history: s.history.slice(0, -1),
      current: last.question,
      answer: last.answer,
    }));
  };

  const questionNumber =
    history[history.length - 1]?.question.id === current.id ? history.length : history.length + 1;
  const confidenceLabel =
    confidence >= 90 ? "Almost ready" : confidence >= 60 ? "Getting there" : "Learning your taste";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xl p-8 space-y-8">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Question {questionNumber}</span>
            <span className="text-muted-foreground">{confidenceLabel}</span>
          </div>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] leading-tight">
          {current.question}
        </h3>

        <div className={current.type === "checkbox" ? "grid md:grid-cols-2 gap-2.5" : "grid gap-2.5"}>
          {current.options.map((option) => {
            const selected =
              current.type === "radio"
                ? answer === option
                : Array.isArray(answer) && answer.includes(option);
            return (
              <OptionButton
                key={option}
                label={option}
                selected={selected}
                variant={current.type}
                onClick={() =>
                  current.type === "radio" ? setAnswer(option) : toggleCheckbox(option)
                }
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={history.length === 0 || isLoading}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <Button
            variant="gradient"
            onClick={handleNext}
            disabled={!canProceed || isLoading}
            className="px-6 h-10 text-sm font-medium min-w-32"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

const OptionButton = ({
  label,
  selected,
  variant,
  onClick,
}: {
  label: string;
  selected: boolean;
  variant: "radio" | "checkbox";
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`relative rounded-xl border p-4 text-left transition-colors ${
      selected
        ? "border-primary/60 bg-primary/5"
        : "border-border/60 bg-background/40 hover:border-border hover:bg-background/60"
    }`}
  >
    <div className="flex items-center gap-3">
      <span
        className={`flex h-5 w-5 items-center justify-center border-2 shrink-0 transition-colors ${
          variant === "radio" ? "rounded-full" : "rounded"
        } ${selected ? "border-primary bg-primary/10" : "border-muted-foreground/30"}`}
      >
        {selected &&
          (variant === "radio" ? (
            <span className="h-2 w-2 rounded-full bg-primary" />
          ) : (
            <Check className="h-3 w-3 text-primary" strokeWidth={3} />
          ))}
      </span>
      <span
        className={`text-sm ${selected ? "text-foreground font-medium" : "text-foreground/80"}`}
      >
        {label}
      </span>
    </div>
  </button>
);

export default Questionnaire;
