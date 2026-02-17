import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import ImageLightbox from "@/components/ImageLightbox";

interface QuestionWithOptions {
  id: string;
  question_text: string;
  image_url: string | null;
  options: { id: string; option_text: string; is_correct: boolean }[];
}

const TOTAL_QUESTIONS = 20;
const TIME_LIMIT = 25 * 60;
const MAX_WRONG = 2;

const Test = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confirmedAnswers, setConfirmedAnswers] = useState<Record<string, { optionId: string; isCorrect: boolean }>>({});
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<{ correct: number; wrong: number; total: number; passed: boolean } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [wrongCount, setWrongCount] = useState(0);

  // Fetch random questions
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!user) return;
      const { data: allQuestions } = await supabase
        .from("questions")
        .select("id, question_text, image_url");

      if (!allQuestions || allQuestions.length === 0) {
        setLoading(false);
        return;
      }

      const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS);
      const qIds = shuffled.map((q) => q.id);
      const { data: options } = await supabase
        .from("question_options")
        .select("id, question_id, option_text, is_correct, sort_order")
        .in("question_id", qIds)
        .order("sort_order");

      const questionsWithOpts: QuestionWithOptions[] = shuffled.map((q) => ({
        ...q,
        options: (options?.filter((o) => o.question_id === q.id) ?? []).sort(() => Math.random() - 0.5),
      }));

      setQuestions(questionsWithOpts);

      const { data: session } = await supabase
        .from("test_sessions")
        .insert({ user_id: user.id, total_questions: questionsWithOpts.length })
        .select("id")
        .single();

      if (session) setSessionId(session.id);
      setLoading(false);
    };
    fetchQuestions();
  }, [user]);

  // Timer
  useEffect(() => {
    if (isFinished || loading) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isFinished, loading]);

  // F key for lightbox
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        const currentQ = questions[currentIndex];
        if (currentQ?.image_url && !lightboxSrc) {
          setLightboxSrc(currentQ.image_url);
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [questions, currentIndex, lightboxSrc]);

  const confirmAnswer = () => {
    if (!selectedOption || isFinished) return;
    const currentQ = questions[currentIndex];
    if (confirmedAnswers[currentQ.id]) return;

    const opt = currentQ.options.find((o) => o.id === selectedOption);
    const isCorrect = opt?.is_correct ?? false;

    setConfirmedAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { optionId: selectedOption, isCorrect },
    }));

    if (!isCorrect) {
      const newWrongCount = wrongCount + 1;
      setWrongCount(newWrongCount);
      if (newWrongCount > MAX_WRONG) {
        finishTest(newWrongCount);
        return;
      }
    }

    setSelectedOption(null);
  };

  const finishTest = useCallback(async (finalWrongCount?: number) => {
    if (isFinished || !sessionId) return;
    setIsFinished(true);

    let correct = 0;
    let wrong = finalWrongCount ?? wrongCount;

    const answerInserts = questions.map((q) => {
      const confirmed = confirmedAnswers[q.id];
      const selectedId = confirmed?.optionId ?? null;
      const isCorrect = confirmed?.isCorrect ?? false;
      if (isCorrect) correct++;
      return {
        session_id: sessionId,
        question_id: q.id,
        selected_option_id: selectedId,
        is_correct: isCorrect,
      };
    });

    // Recalculate wrong from confirmed answers
    if (finalWrongCount === undefined) {
      wrong = Object.values(confirmedAnswers).filter((a) => !a.isCorrect).length;
    }

    const passed = wrong <= MAX_WRONG;

    await supabase.from("test_answers").insert(answerInserts);
    await supabase
      .from("test_sessions")
      .update({ is_completed: true, score: correct, finished_at: new Date().toISOString() })
      .eq("id", sessionId);

    setResults({ correct, wrong, total: questions.length, passed });
  }, [isFinished, sessionId, questions, confirmedAnswers, wrongCount]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const goToNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((p) => p + 1);
      setSelectedOption(null);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((p) => p - 1);
      setSelectedOption(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-lg">Yuklanmoqda...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4 bg-background">
        <p className="text-muted-foreground">Hozircha savollar mavjud emas</p>
        <Button onClick={() => navigate("/")}>Ortga</Button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isAnswered = !!confirmedAnswers[currentQ.id];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">Avtotest</h1>
          <div className="flex items-center gap-4">
            {/* Wrong counter */}
            <div className="flex items-center gap-1.5 text-sm">
              <XCircle className="w-4 h-4 text-destructive" />
              <span className={cn("font-bold", wrongCount > MAX_WRONG ? "text-destructive" : "text-muted-foreground")}>
                {wrongCount}/{MAX_WRONG}
              </span>
            </div>
            {/* Timer */}
            <div className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg font-mono text-lg font-bold transition-colors",
              timeLeft < 300
                ? "bg-destructive/20 text-destructive"
                : timeLeft < 600
                ? "bg-warning/20 text-warning"
                : "bg-muted text-foreground"
            )}>
              <Clock className="w-5 h-5" />
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="container mx-auto px-4 pt-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Savol {currentIndex + 1} / {questions.length}</span>
          <span>{Object.keys(confirmedAnswers).length} ta javob berildi</span>
        </div>
        <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-1.5" />
      </div>

      {/* Main content: question left, image right */}
      <main className="flex-1 container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* LEFT: Question + Options */}
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-lg font-semibold text-foreground leading-relaxed mb-4">
                {currentIndex + 1}. {currentQ.question_text}
              </h2>

              <div className="space-y-2.5">
                {currentQ.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const confirmed = confirmedAnswers[currentQ.id];
                  const isThisSelected = selectedOption === opt.id;
                  const isThisConfirmed = confirmed?.optionId === opt.id;

                  let optClass = "border border-border bg-card hover:border-primary/50 cursor-pointer";

                  if (isAnswered) {
                    if (opt.is_correct) {
                      optClass = "border-2 border-green-500 bg-green-500/10 text-green-400";
                    } else if (isThisConfirmed && !opt.is_correct) {
                      optClass = "border-2 border-red-500 bg-red-500/10 text-red-400";
                    } else {
                      optClass = "border border-border/50 bg-card/50 opacity-50";
                    }
                  } else if (isThisSelected) {
                    optClass = "border-2 border-primary bg-primary/10 ring-1 ring-primary/30";
                  }

                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        if (!isAnswered && !isFinished) setSelectedOption(opt.id);
                      }}
                      disabled={isAnswered || isFinished}
                      className={cn(
                        "w-full text-left p-3.5 rounded-xl transition-all flex items-center gap-3",
                        optClass
                      )}
                    >
                      <span className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                        isAnswered && opt.is_correct
                          ? "bg-green-500 text-white"
                          : isAnswered && isThisConfirmed && !opt.is_correct
                          ? "bg-red-500 text-white"
                          : isThisSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {isAnswered && opt.is_correct ? "✓" : isAnswered && isThisConfirmed && !opt.is_correct ? "✗" : letter}
                      </span>
                      <span className="text-sm">{opt.option_text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Confirm button */}
              {!isAnswered && !isFinished && (
                <Button
                  className="w-full mt-4"
                  size="lg"
                  disabled={!selectedOption}
                  onClick={confirmAnswer}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Tasdiqlash
                </Button>
              )}

              {/* Answer feedback */}
              {isAnswered && (
                <div className={cn(
                  "mt-4 p-3 rounded-lg text-sm font-medium flex items-center gap-2",
                  confirmedAnswers[currentQ.id].isCorrect
                    ? "bg-green-500/10 text-green-400 border border-green-500/30"
                    : "bg-red-500/10 text-red-400 border border-red-500/30"
                )}>
                  {confirmedAnswers[currentQ.id].isCorrect ? (
                    <><CheckCircle className="w-4 h-4" /> To'g'ri javob!</>
                  ) : (
                    <><XCircle className="w-4 h-4" /> Noto'g'ri javob</>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Image */}
          <div className="flex items-start justify-center">
            {currentQ.image_url ? (
              <div className="sticky top-20">
                <img
                  src={currentQ.image_url}
                  alt="Savol rasmi"
                  className="max-h-[70vh] w-auto object-contain rounded-xl border border-border cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightboxSrc(currentQ.image_url)}
                />
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Kattalashtirish uchun bosing yoki <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">F</kbd> tugmasini bosing
                </p>
              </div>
            ) : (
              <div className="w-full h-64 bg-muted/30 rounded-xl border border-border/50 flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Rasm mavjud emas</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom navigation */}
      <footer className="border-t border-border bg-card/50 backdrop-blur-sm sticky bottom-0 z-30">
        <div className="container mx-auto px-4 py-3 space-y-3">
          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={goToPrev} disabled={currentIndex === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Oldingi
            </Button>

            {!isFinished && Object.keys(confirmedAnswers).length === questions.length && (
              <Button variant="destructive" size="sm" onClick={() => finishTest()}>
                Testni yakunlash
              </Button>
            )}

            {!isFinished && (
              <Button variant="outline" size="sm" onClick={goToNext} disabled={currentIndex === questions.length - 1}>
                Keyingi <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>

          {/* Question grid */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {questions.map((q, i) => {
              const confirmed = confirmedAnswers[q.id];
              let cls = "bg-muted text-muted-foreground";

              if (confirmed) {
                cls = confirmed.isCorrect
                  ? "bg-green-500 text-white"
                  : "bg-red-500 text-white";
              }

              if (i === currentIndex) cls += " ring-2 ring-primary ring-offset-2 ring-offset-background";

              return (
                <button
                  key={q.id}
                  onClick={() => { setCurrentIndex(i); setSelectedOption(null); }}
                  className={cn("w-9 h-9 rounded-lg text-xs font-bold transition-all", cls)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </footer>

      {/* Results overlay */}
      {results && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4 animate-fade-in">
          <div className={cn(
            "bg-card rounded-2xl border-2 p-8 text-center space-y-4 max-w-md w-full",
            results.passed ? "border-green-500" : "border-red-500"
          )}>
            {results.passed ? (
              <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
            ) : (
              <AlertTriangle className="w-16 h-16 mx-auto text-red-500" />
            )}
            <h2 className="text-2xl font-bold text-foreground">
              {results.passed ? "Tabriklaymiz! ✅" : "Muvaffaqiyatsiz ❌"}
            </h2>
            <div className="text-4xl font-black">
              <span className="text-green-500">{results.correct}</span>
              <span className="text-muted-foreground"> / {results.total}</span>
            </div>
            <p className="text-muted-foreground">
              {results.passed
                ? "Siz testdan muvaffaqiyatli o'tdingiz!"
                : `${results.wrong} ta xato javob berdingiz. 2 tadan ko'p xato qilish mumkin emas.`}
            </p>
            <Button onClick={() => navigate("/")} className="mt-4 w-full" size="lg">
              Bosh sahifaga qaytish
            </Button>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt="Savol rasmi" onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
};

export default Test;
