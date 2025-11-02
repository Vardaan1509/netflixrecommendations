import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface QuestionnaireProps {
  onComplete: (preferences: {
    mood: string;
    genres: string[];
    watchTime: string;
    watchStyle: string;
  }) => void;
}

const Questionnaire = ({ onComplete }: QuestionnaireProps) => {
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [watchTime, setWatchTime] = useState("");
  const [watchStyle, setWatchStyle] = useState("");

  const genreOptions = [
    "Action", "Comedy", "Drama", "Thriller", "Sci-Fi",
    "Romance", "Horror", "Documentary", "Fantasy", "Crime"
  ];

  const handleGenreToggle = (genre: string) => {
    setGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleComplete = () => {
    if (mood && genres.length > 0 && watchTime && watchStyle) {
      onComplete({ mood, genres, watchTime, watchStyle });
    }
  };

  const canProceed = () => {
    if (step === 1) return mood !== "";
    if (step === 2) return genres.length > 0;
    if (step === 3) return watchTime !== "";
    if (step === 4) return watchStyle !== "";
    return false;
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center justify-between">
          <span>Question {step} of 4</span>
          <span className="text-sm text-muted-foreground">{Math.round((step / 4) * 100)}%</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">How is your day going so far?</h3>
            <RadioGroup value={mood} onValueChange={setMood}>
              {[
                "Great, everything is going well!",
                "Pretty good, can't complain.",
                "It's okay, nothing special.",
                "A bit stressful, to be honest.",
                "Not so great, having a rough day.",
                "Could be better, thanks for asking.",
                "I'm feeling tired or overwhelmed.",
                "Excited and productive today"
              ].map(option => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`mood-${option}`} />
                  <Label htmlFor={`mood-${option}`} className="cursor-pointer">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Which genres interest you? (Select multiple)</h3>
            <div className="grid grid-cols-2 gap-3">
              {genreOptions.map(genre => (
                <div key={genre} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`genre-${genre}`}
                    checked={genres.includes(genre)}
                    onCheckedChange={() => handleGenreToggle(genre)}
                  />
                  <Label htmlFor={`genre-${genre}`} className="cursor-pointer">{genre}</Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">How much time do you have?</h3>
            <RadioGroup value={watchTime} onValueChange={setWatchTime}>
              {["Quick watch (< 30 min)", "Standard episode (30-60 min)", "Movie length (90+ min)", "Binge session (multiple hours)"].map(option => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`time-${option}`} />
                  <Label htmlFor={`time-${option}`} className="cursor-pointer">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">What's your watching style?</h3>
            <RadioGroup value={watchStyle} onValueChange={setWatchStyle}>
              {["Background viewing", "Focused watching", "Something to discuss", "Solo entertainment", "Nostalgic re-watching", "Watching with friends or family"].map(option => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`style-${option}`} />
                  <Label htmlFor={`style-${option}`} className="cursor-pointer">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button
            variant="ghost"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          {step < 4 ? (
            <Button
              variant="gradient"
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="gradient"
              onClick={handleComplete}
              disabled={!canProceed()}
            >
              Get Recommendations
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Questionnaire;
