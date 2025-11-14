import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QuestionnaireProps {
  onComplete: (preferences: any) => void;
}

interface Question {
  id: string;
  question: string;
  type: "radio" | "checkbox";
  options: string[];
}

const Questionnaire = ({ onComplete }: QuestionnaireProps) => {
  const { toast } = useToast();
  const [conversationHistory, setConversationHistory] = useState<Array<{ question: Question; answer: any }>>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
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
      "Excited and productive today"
    ]
  });
  const [currentAnswer, setCurrentAnswer] = useState<string | string[]>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAnswerChange = (value: string | string[]) => {
    setCurrentAnswer(value);
  };

  const handleNext = async () => {
    if (!currentAnswer || (Array.isArray(currentAnswer) && currentAnswer.length === 0)) {
      return;
    }

    setIsLoading(true);
    const newHistory = [...conversationHistory, { question: currentQuestion, answer: currentAnswer }];
    setConversationHistory(newHistory);

    try {
      const { data, error } = await supabase.functions.invoke('get-next-question', {
        body: { conversationHistory: newHistory.map(h => ({ question: h.question.question, answer: h.answer })) }
      });

      if (error) throw error;

      if (data.ready) {
        // AI is confident, generate recommendations
        onComplete(data.preferences);
      } else if (data.needsClarification) {
        // Show clarification message
        toast({
          title: "Let's try again",
          description: data.message,
        });
        setCurrentQuestion(data.nextQuestion);
        setCurrentAnswer(data.nextQuestion.type === "checkbox" ? [] : "");
      } else {
        // Continue with next question
        setCurrentQuestion(data.nextQuestion);
        setCurrentAnswer(data.nextQuestion.type === "checkbox" ? [] : "");
      }
    } catch (error) {
      console.error('Error getting next question:', error);
      toast({
        title: "Error",
        description: "Failed to process your answer. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (conversationHistory.length === 0) return;
    
    const newHistory = [...conversationHistory];
    const lastEntry = newHistory.pop();
    setConversationHistory(newHistory);
    
    if (lastEntry) {
      setCurrentQuestion(lastEntry.question);
      setCurrentAnswer(lastEntry.answer);
    }
  };

  const canProceed = () => {
    if (Array.isArray(currentAnswer)) {
      return currentAnswer.length > 0;
    }
    return currentAnswer !== "";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {conversationHistory.length > 0 && (
          <div className="flex gap-1">
            {conversationHistory.map((_, idx) => (
              <div key={idx} className="h-1.5 w-8 rounded-full bg-primary/60" />
            ))}
            <div className="h-1.5 w-8 rounded-full bg-primary animate-pulse" />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="relative">
        {/* Decorative element */}
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-accent/5 rounded-full blur-3xl" />
        
        <div className="relative bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 p-8 space-y-8">
          <div className="space-y-3">
            <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Question {conversationHistory.length + 1}
            </div>
            <h3 className="text-2xl font-bold leading-tight">{currentQuestion.question}</h3>
          </div>
          
          {currentQuestion.type === "radio" ? (
            <div className="grid gap-3">
              {currentQuestion.options.map(option => {
                const isSelected = currentAnswer === option;
                return (
                  <button
                    key={option}
                    onClick={() => handleAnswerChange(option)}
                    className={`
                      relative p-4 rounded-xl text-left transition-all duration-200
                      border-2 hover-scale active-press
                      ${isSelected 
                        ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] animate-scale-in' 
                        : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card/80'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                        ${isSelected ? 'border-primary' : 'border-muted-foreground/30'}
                      `}>
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-scale-in" />
                        )}
                      </div>
                      <span className={`text-sm ${isSelected ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                        {option}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {currentQuestion.options.map(option => {
                const isChecked = Array.isArray(currentAnswer) && currentAnswer.includes(option);
                return (
                  <button
                    key={option}
                    onClick={() => {
                      if (Array.isArray(currentAnswer)) {
                        handleAnswerChange(
                          isChecked 
                            ? currentAnswer.filter(item => item !== option)
                            : [...currentAnswer, option]
                        );
                      }
                    }}
                    className={`
                      relative p-4 rounded-xl text-left transition-all duration-200
                      border-2 hover-scale active-press
                      ${isChecked 
                        ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] animate-scale-in' 
                        : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card/80'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                        ${isChecked ? 'border-primary bg-primary' : 'border-muted-foreground/30'}
                      `}>
                        {isChecked && (
                          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm ${isChecked ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                        {option}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={conversationHistory.length === 0 || isLoading}
              className="gap-2 hover-scale active-press"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            
            <Button
              variant="gradient"
              onClick={handleNext}
              disabled={!canProceed() || isLoading}
              className="min-w-32 hover-scale active-press"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                "Continue →"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
