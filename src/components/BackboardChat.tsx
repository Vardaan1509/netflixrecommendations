import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Brain,
    Send,
    Sparkles,
    ThumbsUp,
    ThumbsDown,
    Eye,
    EyeOff,
    Loader2,
    Star,
    Film,
    Tv,
    MessageSquare,
    RefreshCw,
} from "lucide-react";
import { useBackboard, BackboardRecommendation } from "@/hooks/useBackboard";
import { Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

interface BackboardChatProps {
    session: Session;
    watchedShows: string[];
    region: string;
}

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    recommendations?: BackboardRecommendation[];
    memoryNote?: string;
    timestamp: Date;
}

const BackboardChat = ({ session, watchedShows, region }: BackboardChatProps) => {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [initialized, setInitialized] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const {
        loading,
        error,
        getRecommendations,
        sendFeedback,
    } = useBackboard(session);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Show welcome message
    useEffect(() => {
        if (!initialized) {
            setMessages([
                {
                    role: "system",
                    content:
                        "Welcome to your memory-powered assistant! I remember your preferences across sessions. Tell me what you're in the mood for, and I'll find your perfect match.",
                    timestamp: new Date(),
                },
            ]);
            setInitialized(true);
        }
    }, [initialized]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const userMessage: ChatMessage = {
            role: "user",
            content: trimmed,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");

        const recs = await getRecommendations(trimmed, undefined, watchedShows, region);

        const assistantMessage: ChatMessage = {
            role: "assistant",
            content:
                recs.length > 0
                    ? `Here are ${recs.length} recommendations based on your request and what I remember about your taste:`
                    : "I couldn't parse specific recommendations, but here's what I found:",
            recommendations: recs.length > 0 ? recs : undefined,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
    };

    const handleQuickSuggestion = async (suggestion: string) => {
        setInput(suggestion);
        const userMessage: ChatMessage = {
            role: "user",
            content: suggestion,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);

        const recs = await getRecommendations(suggestion, undefined, watchedShows, region);

        const assistantMessage: ChatMessage = {
            role: "assistant",
            content:
                recs.length > 0
                    ? `Here are ${recs.length} recommendations based on your request and what I remember about your taste:`
                    : "I couldn't parse specific recommendations, but here's what I found:",
            recommendations: recs.length > 0 ? recs : undefined,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setInput("");
    };

    const handleRate = async (rec: BackboardRecommendation, rating: number) => {
        const success = await sendFeedback({
            feedbackType: "rating",
            title: rec.title,
            rating,
            reason: rating >= 4 ? `Liked the ${rec.genre} style` : undefined,
        });

        if (success) {
            toast({
                title: "Preference remembered! 🧠",
                description: `Your ${rating >= 4 ? "love" : "dislike"} for "${rec.title}" is now in my memory.`,
                duration: 3000,
            });
        }
    };

    const handleNotInterested = async (rec: BackboardRecommendation) => {
        const success = await sendFeedback({
            feedbackType: "not_interested",
            title: rec.title,
        });

        if (success) {
            toast({
                title: "Got it! 🧠",
                description: `I'll remember not to recommend "${rec.title}" again.`,
                duration: 3000,
            });
        }
    };

    const handleAlreadyWatched = async (rec: BackboardRecommendation) => {
        const success = await sendFeedback({
            feedbackType: "watched",
            title: rec.title,
        });

        if (success) {
            toast({
                title: "Noted! 🧠",
                description: `"${rec.title}" marked as watched in my memory.`,
                duration: 3000,
            });
        }
    };

    const quickSuggestions = [
        "Something dark and psychological like Black Mirror",
        "A feel-good comedy for tonight",
        "What's similar to shows I've loved before?",
        "Something short I can finish in one sitting",
    ];

    return (
        <div className="space-y-4">
            {/* Memory Badge */}
            <div className="flex items-center justify-center gap-2">
                <Badge
                    variant="outline"
                    className="gap-1.5 px-3 py-1 bg-purple-500/10 border-purple-500/30 text-purple-300"
                >
                    <Brain className="h-3.5 w-3.5" />
                    Backboard Memory Active
                </Badge>
                <Badge
                    variant="outline"
                    className="gap-1.5 px-3 py-1 bg-green-500/10 border-green-500/30 text-green-300"
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    Learns from your feedback
                </Badge>
            </div>

            {/* Chat Area */}
            <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                <CardContent className="p-0">
                    {/* Messages */}
                    <div
                        ref={scrollRef}
                        className="h-[500px] overflow-y-auto p-4 space-y-4 scroll-smooth"
                    >
                        {messages.map((msg, idx) => (
                            <div key={idx}>
                                {msg.role === "system" ? (
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                                            <Brain className="h-4 w-4 text-purple-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-muted-foreground italic">
                                                {msg.content}
                                            </p>

                                            {/* Quick Suggestions */}
                                            {idx === 0 && messages.length === 1 && (
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {quickSuggestions.map((suggestion, sIdx) => (
                                                        <Button
                                                            key={sIdx}
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-xs h-auto py-1.5 px-3 bg-card/50 hover:bg-primary/10 hover:border-primary/50"
                                                            onClick={() => handleQuickSuggestion(suggestion)}
                                                            disabled={loading}
                                                        >
                                                            {suggestion}
                                                        </Button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : msg.role === "user" ? (
                                    <div className="flex gap-3 items-start justify-end">
                                        <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                                            <p className="text-sm">{msg.content}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <Brain className="h-4 w-4 text-purple-400" />
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <p className="text-sm text-foreground/90">{msg.content}</p>

                                            {/* Recommendation Cards */}
                                            {msg.recommendations && msg.recommendations.length > 0 && (
                                                <div className="grid gap-3">
                                                    {msg.recommendations.map((rec, rIdx) => (
                                                        <div
                                                            key={rIdx}
                                                            className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-2 hover:border-primary/30 transition-colors"
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    {rec.type === "Series" ? (
                                                                        <Tv className="h-4 w-4 text-primary" />
                                                                    ) : (
                                                                        <Film className="h-4 w-4 text-primary" />
                                                                    )}
                                                                    <h4 className="font-semibold text-sm">
                                                                        {rec.title}
                                                                    </h4>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-accent shrink-0">
                                                                    <Star className="h-3.5 w-3.5 fill-current" />
                                                                    <span className="text-xs font-semibold">
                                                                        {rec.rating}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-1.5 flex-wrap">
                                                                <Badge variant="secondary" className="text-[10px] h-5">
                                                                    {rec.type}
                                                                </Badge>
                                                                <Badge variant="outline" className="text-[10px] h-5">
                                                                    {rec.genre}
                                                                </Badge>
                                                            </div>

                                                            <p className="text-xs text-foreground/80">
                                                                {rec.description}
                                                            </p>

                                                            {rec.matchReason && (
                                                                <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg px-3 py-1.5">
                                                                    <p className="text-xs text-purple-300/90">
                                                                        <Brain className="h-3 w-3 inline mr-1" />
                                                                        <span className="font-medium">Memory match:</span>{" "}
                                                                        {rec.matchReason}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Feedback Actions */}
                                                            <div className="flex items-center gap-1 pt-1 border-t border-border/30">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-xs gap-1 hover:text-green-400 hover:bg-green-500/10"
                                                                    onClick={() => handleRate(rec, 5)}
                                                                >
                                                                    <ThumbsUp className="h-3 w-3" />
                                                                    Love it
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-xs gap-1 hover:text-red-400 hover:bg-red-500/10"
                                                                    onClick={() => handleRate(rec, 1)}
                                                                >
                                                                    <ThumbsDown className="h-3 w-3" />
                                                                    Not for me
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-xs gap-1 hover:text-yellow-400 hover:bg-yellow-500/10"
                                                                    onClick={() => handleAlreadyWatched(rec)}
                                                                >
                                                                    <Eye className="h-3 w-3" />
                                                                    Watched
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-xs gap-1 hover:text-muted-foreground"
                                                                    onClick={() => handleNotInterested(rec)}
                                                                >
                                                                    <EyeOff className="h-3 w-3" />
                                                                    Hide
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Memory Note */}
                                            {msg.memoryNote && (
                                                <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg px-3 py-2">
                                                    <p className="text-xs text-purple-300/90">
                                                        <Brain className="h-3 w-3 inline mr-1" />
                                                        {msg.memoryNote}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {loading && (
                            <div className="flex gap-3 items-start">
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                                    <Brain className="h-4 w-4 text-purple-400 animate-pulse" />
                                </div>
                                <div className="flex items-center gap-2 py-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                        Searching memory and finding matches...
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="border-t border-border/50 p-3">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                            className="flex gap-2"
                        >
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Tell me what you're in the mood for..."
                                className="bg-background/50"
                                disabled={loading}
                            />
                            <Button
                                type="submit"
                                variant="gradient"
                                size="sm"
                                disabled={!input.trim() || loading}
                                className="px-4"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default BackboardChat;
