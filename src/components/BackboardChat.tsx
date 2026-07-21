import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  ThumbsUp,
  ThumbsDown,
  Eye,
  EyeOff,
  Star,
  Film,
  Tv,
} from "lucide-react";
import { useBackboard, BackboardRecommendation } from "@/hooks/useBackboard";
import { Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import Orb from "@/components/Orb";
import { moderateInput } from "@/lib/moderation";

interface BackboardChatProps {
  session: Session;
  watchedShows: string[];
  region: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendations?: BackboardRecommendation[];
  timestamp: Date;
}

/**
 * Reveal text word-by-word to simulate streaming.
 * Backboard's API doesn't stream, so we animate the reveal client-side.
 */
function useStreamedText(fullText: string, active: boolean, wordDelay = 30) {
  const [count, setCount] = useState(active ? 0 : Number.POSITIVE_INFINITY);

  const tokens = useMemo(() => fullText.split(/(\s+)/).filter(Boolean), [fullText]);

  useEffect(() => {
    if (!active) {
      setCount(Number.POSITIVE_INFINITY);
      return;
    }
    setCount(0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setCount(i);
      if (i < tokens.length) timer = setTimeout(tick, wordDelay);
    };
    timer = setTimeout(tick, wordDelay);
    return () => clearTimeout(timer);
  }, [tokens, active, wordDelay]);

  const visible = tokens.slice(0, count);
  const done = count >= tokens.length;
  return { visible, done };
}

const StreamedText = ({ text, animate }: { text: string; animate: boolean }) => {
  const { visible, done } = useStreamedText(text, animate);
  if (!animate) return <p className="text-[15px] leading-relaxed text-foreground/90">{text}</p>;
  return (
    <p className="text-[15px] leading-relaxed text-foreground/90">
      {visible.map((tok, i) => (
        <span key={i} className="stream-word">
          {tok}
        </span>
      ))}
      {!done && <span className="stream-caret" aria-hidden />}
    </p>
  );
};

const QUICK_SUGGESTIONS = [
  "Something dark and psychological like Black Mirror",
  "A feel-good comedy for tonight",
  "Similar to shows I've loved before",
  "Something short I can finish in one sitting",
];

const BackboardChat = ({ session, watchedShows, region }: BackboardChatProps) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { loading, error, getRecommendations, sendFeedback } = useBackboard(session);

  // Auto-scroll to bottom whenever a new message appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Client-side guardrail — server enforces the same rules too.
    const check = moderateInput(trimmed);
    if (!check.ok) {
      toast({
        title: "That one's off-limits",
        description: check.message ?? "Please rephrase your request.",
        variant: "destructive",
        duration: 2500,
      });
      return;
    }

    setInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const recs = await getRecommendations({ message: trimmed, watchedShows, region });

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        recs.length > 0
          ? `Here are ${recs.length} picks based on what I remember about your taste.`
          : "I couldn't parse specific recommendations this time — mind trying that again with a bit more detail?",
      recommendations: recs.length > 0 ? recs : undefined,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
  };

  const handleRate = async (rec: BackboardRecommendation, rating: number) => {
    const ok = await sendFeedback({
      feedbackType: "rating",
      title: rec.title,
      rating,
      reason: rating >= 4 ? `Liked the ${rec.genre} style` : undefined,
    });
    if (ok) {
      toast({
        title: rating >= 4 ? "Saved to memory" : "Noted",
        description: `Your ${rating >= 4 ? "love" : "dislike"} for "${rec.title}" is stored.`,
        duration: 2500,
      });
    }
  };

  const handleWatched = async (rec: BackboardRecommendation) => {
    const ok = await sendFeedback({ feedbackType: "watched", title: rec.title });
    if (ok) {
      toast({ title: "Noted", description: `"${rec.title}" marked as watched.`, duration: 2500 });
    }
  };

  const handleHide = async (rec: BackboardRecommendation) => {
    const ok = await sendFeedback({ feedbackType: "not_interested", title: rec.title });
    if (ok) {
      toast({ title: "Got it", description: `Won't suggest "${rec.title}" again.`, duration: 2500 });
    }
  };

  const isEmpty = messages.length === 0 && !loading;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="relative">
      {/* Empty state — big centered orb, greeting, primary input */}
      {isEmpty ? (
        <div className="flex flex-col items-center py-8">
          <Orb size={104} halo />
          <h2 className="mt-8 font-display text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-center">
            Ready when you are.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
            Tell me what you're in the mood for. I remember your taste across sessions.
          </p>

          <div className="w-full max-w-xl mt-8">
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={() => submit(input)}
              loading={loading}
              autoFocus
            />
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {QUICK_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-full border border-border/70 bg-card/50 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Conversation state — messages scroll, input pinned below */
        <div className="rounded-2xl border border-border/70 bg-card/40 backdrop-blur-xl overflow-hidden">
          <div
            ref={scrollRef}
            className="h-[560px] overflow-y-auto px-5 py-6 space-y-6 scroll-smooth"
          >
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-secondary/70 border border-border/60 px-4 py-2.5">
                      <p className="text-[15px] leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 items-start">
                    <Orb size={28} className="shrink-0 mt-1" />
                    <div className="flex-1 min-w-0 space-y-4">
                      <StreamedText text={msg.content} animate={msg.id === lastAssistantId} />

                      {msg.recommendations && msg.recommendations.length > 0 && (
                        <div className="grid gap-3">
                          {msg.recommendations.map((rec, i) => (
                            <div
                              key={i}
                              className="rec-in rounded-xl border border-border/60 bg-background/40 p-4 space-y-3 hover:border-border transition-colors"
                              style={{ animationDelay: `${300 + i * 90}ms` }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  {rec.type === "Series" ? (
                                    <Tv className="h-4 w-4 text-muted-foreground shrink-0" />
                                  ) : (
                                    <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                                  )}
                                  <h4 className="font-medium text-[15px] truncate">{rec.title}</h4>
                                </div>
                                <div className="flex items-center gap-1 text-foreground/80 shrink-0">
                                  <Star className="h-3.5 w-3.5 fill-current" />
                                  <span className="text-xs font-medium tabular-nums">
                                    {rec.rating}
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-1.5 flex-wrap">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] h-5 font-normal bg-secondary/70"
                                >
                                  {rec.type}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-5 font-normal border-border/70"
                                >
                                  {rec.genre}
                                </Badge>
                              </div>

                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {rec.description}
                              </p>

                              {rec.matchReason && (
                                <p className="text-xs text-muted-foreground/80 border-l-2 border-primary/40 pl-3 py-0.5">
                                  <span className="font-medium text-foreground/70">Why:</span>{" "}
                                  {rec.matchReason}
                                </p>
                              )}

                              <div className="flex items-center gap-0.5 pt-1 -mx-1.5">
                                <FeedbackButton icon={ThumbsUp} label="Love it" onClick={() => handleRate(rec, 5)} />
                                <FeedbackButton icon={ThumbsDown} label="Not for me" onClick={() => handleRate(rec, 1)} />
                                <FeedbackButton icon={Eye} label="Watched" onClick={() => handleWatched(rec)} />
                                <FeedbackButton icon={EyeOff} label="Hide" onClick={() => handleHide(rec)} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 items-center">
                <Orb size={28} className="shrink-0" />
                <TypingDots />
              </div>
            )}

            {error && !loading && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 p-3 bg-background/30">
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={() => submit(input)}
              loading={loading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── small internal components ──────────────────────────────────── */

const ChatInput = ({
  value,
  onChange,
  onSubmit,
  loading,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  autoFocus?: boolean;
}) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit();
    }}
    className="relative flex items-center rounded-xl border border-border/70 bg-background/60 focus-within:border-primary/50 focus-within:bg-background/80 transition-colors"
  >
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Tell me what you're in the mood for…"
      disabled={loading}
      autoFocus={autoFocus}
      className="flex-1 bg-transparent px-4 py-3 text-[15px] placeholder:text-muted-foreground/60 outline-none disabled:opacity-50"
    />
    <button
      type="submit"
      disabled={!value.trim() || loading}
      aria-label="Send"
      className="mr-1.5 h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
    >
      <Send className="h-4 w-4" />
    </button>
  </form>
);

const TypingDots = () => (
  <div className="flex items-center gap-1 h-6">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse"
        style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
      />
    ))}
  </div>
);

const FeedbackButton = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ThumbsUp;
  label: string;
  onClick: () => void;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={onClick}
    className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/70"
  >
    <Icon className="h-3 w-3" />
    {label}
  </Button>
);

export default BackboardChat;
