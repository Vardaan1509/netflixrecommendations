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
  const [conversationHistory, setConversationHistory] = useState<Array<{ question: string; answer: any }>>([]);
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
    const newHistory = [...conversationHistory, { question: currentQuestion.question, answer: currentAnswer }];
    setConversationHistory(newHistory);

    try {
      const { data, error } = await supabase.functions.invoke('get-next-question', {
        body: { conversationHistory: newHistory }
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
    setCurrentAnswer(lastEntry?.answer || "");
  };

  const canProceed = () => {
    if (Array.isArray(currentAnswer)) {
      return currentAnswer.length > 0;
    }
    return currentAnswer !== "";
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl">Let's find your perfect watch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{currentQuestion.question}</h3>
          
          {currentQuestion.type === "radio" ? (
            <RadioGroup 
              value={typeof currentAnswer === "string" ? currentAnswer : ""} 
              onValueChange={handleAnswerChange}
            >
              {currentQuestion.options.map(option => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`option-${option}`} />
                  <Label htmlFor={`option-${option}`} className="cursor-pointer">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {currentQuestion.options.map(option => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`option-${option}`}
                    checked={Array.isArray(currentAnswer) && currentAnswer.includes(option)}
                    onCheckedChange={(checked) => {
                      if (Array.isArray(currentAnswer)) {
                        handleAnswerChange(
                          checked 
                            ? [...currentAnswer, option]
                            : currentAnswer.filter(item => item !== option)
                        );
                      }
                    }}
                  />
                  <Label htmlFor={`option-${option}`} className="cursor-pointer">{option}</Label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={conversationHistory.length === 0 || isLoading}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <Button
            variant="gradient"
            onClick={handleNext}
            disabled={!canProceed() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
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
