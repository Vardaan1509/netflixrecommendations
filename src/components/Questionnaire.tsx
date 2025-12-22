import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Question {questionNumber}</span>
            <span className="text-muted-foreground">
              {confidence >= 90 ? "Almost ready!" : confidence >= 60 ? "Getting there..." : "Learning your preferences"}
            </span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                confidence >= 90 ? 'bg-green-500' : 'bg-primary'
              }`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
        
        {/* Question */}
        <h3 className="text-xl font-semibold">{currentQuestion.question}</h3>
        
        {/* Options */}
        {currentQuestion.type === "radio" ? (
          <div className="space-y-2">
            {currentQuestion.options.map(option => {
              const isSelected = currentAnswer === option;
              return (
                <button
                  key={option}
                  onClick={() => handleAnswerChange(option)}
                  className={`w-full p-4 rounded-lg text-left transition-colors border ${
                    isSelected 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border bg-secondary/50 hover:bg-secondary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-primary' : 'border-muted-foreground'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-sm">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-2">
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
                  className={`p-4 rounded-lg text-left transition-colors border ${
                    isChecked 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border bg-secondary/50 hover:bg-secondary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isChecked ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}>
                      {isChecked && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={conversationHistory.length === 0 || isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Thinking...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Questionnaire;
