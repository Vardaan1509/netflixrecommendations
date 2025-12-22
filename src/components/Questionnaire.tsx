import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2, Sparkles } from "lucide-react";
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

const defaultQuestion: Question = {
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
};

const Questionnaire = ({ onComplete }: QuestionnaireProps) => {
  const { toast } = useToast();
  
  const [conversationHistory, setConversationHistory] = useState<Array<{ question: Question; answer: any }>>(() => {
    const saved = sessionStorage.getItem('questionnaire-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentQuestion, setCurrentQuestion] = useState<Question>(() => {
    const saved = sessionStorage.getItem('questionnaire-current');
    return saved ? JSON.parse(saved) : defaultQuestion;
  });
  const [currentAnswer, setCurrentAnswer] = useState<string | string[]>(() => {
    const saved = sessionStorage.getItem('questionnaire-answer');
    return saved ? JSON.parse(saved) : "";
  });
  const [confidence, setConfidence] = useState<number>(() => {
    const saved = sessionStorage.getItem('questionnaire-confidence');
    return saved ? JSON.parse(saved) : 10;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('questionnaire-history', JSON.stringify(conversationHistory));
  }, [conversationHistory]);

  useEffect(() => {
    sessionStorage.setItem('questionnaire-current', JSON.stringify(currentQuestion));
  }, [currentQuestion]);

  useEffect(() => {
    sessionStorage.setItem('questionnaire-answer', JSON.stringify(currentAnswer));
  }, [currentAnswer]);

  useEffect(() => {
    sessionStorage.setItem('questionnaire-confidence', JSON.stringify(confidence));
  }, [confidence]);

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

      if (data.confidence !== undefined) {
        setConfidence(data.confidence);
      }

      if (data.ready) {
        sessionStorage.removeItem('questionnaire-history');
        sessionStorage.removeItem('questionnaire-current');
        sessionStorage.removeItem('questionnaire-answer');
        sessionStorage.removeItem('questionnaire-confidence');
        onComplete(data.preferences);
      } else if (data.needsClarification) {
        toast({
          title: "Let's try again",
          description: data.message,
        });
        setCurrentQuestion(data.nextQuestion);
        setCurrentAnswer(data.nextQuestion.type === "checkbox" ? [] : "");
      } else {
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

  const lastAnsweredQuestion = conversationHistory[conversationHistory.length - 1]?.question;
  const isShowingSameAsLast = lastAnsweredQuestion?.id === currentQuestion.id;
  const questionNumber = isShowingSameAsLast 
    ? conversationHistory.length 
    : conversationHistory.length + 1;

  const getConfidenceLabel = () => {
    if (confidence >= 90) return { text: "Almost ready!", color: "text-green-400" };
    if (confidence >= 70) return { text: "Getting close...", color: "text-accent" };
    if (confidence >= 50) return { text: "Learning more...", color: "text-primary" };
    return { text: "Just getting started", color: "text-muted-foreground" };
  };

  const confidenceLabel = getConfidenceLabel();

  return (
    <div className="max-w-3xl mx-auto">
      {/* Main card */}
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-3xl blur-xl opacity-50" />
        
        <div className="relative glass-strong rounded-2xl p-8 space-y-8 hover-lift">
          {/* Progress section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {questionNumber}
                </div>
                <span className="text-sm text-muted-foreground">Question {questionNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${confidenceLabel.color}`} />
                <span className={`text-sm font-medium ${confidenceLabel.color}`}>
                  {confidenceLabel.text}
                </span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  confidence >= 90 
                    ? 'bg-gradient-to-r from-green-500 to-green-400' 
                    : 'bg-gradient-to-r from-primary to-accent'
                }`}
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>
          
          {/* Question */}
          <div className="space-y-2">
            <h3 className="text-2xl md:text-3xl font-bold leading-tight">
              {currentQuestion.question}
            </h3>
            {currentQuestion.type === "checkbox" && (
              <p className="text-sm text-muted-foreground">Select all that apply</p>
            )}
          </div>
          
          {/* Options */}
          {currentQuestion.type === "radio" ? (
            <div className="grid gap-3">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = currentAnswer === option;
                return (
                  <button
                    key={option}
                    onClick={() => handleAnswerChange(option)}
                    className={`
                      group relative p-4 rounded-xl text-left transition-all duration-300
                      border-2 hover:scale-[1.02] active:scale-[0.98]
                      ${isSelected 
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' 
                        : 'border-border/50 bg-card/30 hover:border-primary/50 hover:bg-card/50'
                      }
                    `}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                        ${isSelected 
                          ? 'border-primary bg-primary' 
                          : 'border-muted-foreground/30 group-hover:border-primary/50'
                        }
                      `}>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground animate-scale-in" />
                        )}
                      </div>
                      <span className={`text-base ${isSelected ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                        {option}
                      </span>
                    </div>
                    
                    {/* Selected indicator line */}
                    {isSelected && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {currentQuestion.options.map((option, idx) => {
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
                      group relative p-4 rounded-xl text-left transition-all duration-300
                      border-2 hover:scale-[1.02] active:scale-[0.98]
                      ${isChecked 
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' 
                        : 'border-border/50 bg-card/30 hover:border-primary/50 hover:bg-card/50'
                      }
                    `}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
                        ${isChecked 
                          ? 'border-primary bg-primary' 
                          : 'border-muted-foreground/30 group-hover:border-primary/50'
                        }
                      `}>
                        {isChecked && (
                          <svg className="w-4 h-4 text-primary-foreground animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-base ${isChecked ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                        {option}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-border/30">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={conversationHistory.length === 0 || isLoading}
              className="gap-2 hover:bg-secondary/50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            
            <Button
              variant="gradient"
              onClick={handleNext}
              disabled={!canProceed() || isLoading}
              className="min-w-36 gap-2 rounded-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue
                  <span className="text-lg">→</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
