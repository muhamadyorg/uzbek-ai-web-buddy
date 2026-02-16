import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionWithOptions {
  id: string;
  question_text: string;
  image_url: string | null;
  options: { id: string; option_text: string; is_correct: boolean }[];
}

const TOTAL_QUESTIONS = 20;
const TIME_LIMIT = 25 * 60; // 25 minutes in seconds

const Test = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<{ correct: number; total: number } | null>(null);

  // Fetch random questions
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!user) return;

      // Get all questions with options
      const { data: allQuestions } = await supabase
        .from("questions")
        .select("id, question_text, image_url");

      if (!allQuestions || allQuestions.length === 0) {
        setLoading(false);
        return;
      }

      // Shuffle and pick 20
      const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS);

      // Fetch options for selected questions
      const qIds = shuffled.map((q) => q.id);
      const { data: options } = await supabase
        .from("question_options")
        .select("id, question_id, option_text, is_correct, sort_order")
        .in("question_id", qIds)
        .order("sort_order");

      const questionsWithOpts: QuestionWithOptions[] = shuffled.map((q) => ({
        ...q,
        options: (options?.filter((o) => o.question_id === q.id) ?? []).sort(
          () => Math.random() - 0.5
        ),
      }));

      setQuestions(questionsWithOpts);

      // Create session
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

  const selectAnswer = (questionId: string, optionId: string) => {
    if (isFinished) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const finishTest = useCallback(async () => {
    if (isFinished || !sessionId) return;
    setIsFinished(true);

    let correct = 0;
    const answerInserts = questions.map((q) => {
      const selectedId = answers[q.id] ?? null;
      const selectedOpt = q.options.find((o) => o.id === selectedId);
      const isCorrect = selectedOpt?.is_correct ?? false;
      if (isCorrect) correct++;
      return {
        session_id: sessionId,
        question_id: q.id,
        selected_option_id: selectedId,
        is_correct: isCorrect,
      };
    });

    await supabase.from("test_answers").insert(answerInserts);
    await supabase
      .from("test_sessions")
      .update({ is_completed: true, score: correct, finished_at: new Date().toISOString() })
      .eq("id", sessionId);

    setResults({ correct, total: questions.length });
  }, [isFinished, sessionId, questions, answers]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Yuklanmoqda...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Hozircha savollar mavjud emas</p>
        <Button onClick={() => navigate("/")}>Ortga</Button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-3xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Avtotest</h1>
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold",
            timeLeft < 300 ? "bg-destructive/10 text-destructive" : "bg-muted"
          )}>
            <Clock className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Savol {currentIndex + 1} / {questions.length}</span>
            <span>{Object.keys(answers).length} ta javob berildi</span>
          </div>
          <Progress value={((currentIndex + 1) / questions.length) * 100} />
        </div>

        {/* Question */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg leading-relaxed">
              {currentIndex + 1}. {currentQ.question_text}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentQ.image_url && (
              <img
                src={currentQ.image_url}
                alt="Savol rasmi"
                className="w-full max-h-64 object-contain rounded-lg border"
              />
            )}
            <div className="space-y-2">
              {currentQ.options.map((opt, i) => {
                const isSelected = answers[currentQ.id] === opt.id;
                const letter = String.fromCharCode(65 + i);

                let optClass = "border-2 border-border bg-card hover:border-primary/50 cursor-pointer";
                if (isFinished) {
                  if (opt.is_correct) {
                    optClass = "border-2 border-green-500 bg-green-50 text-green-800";
                  } else if (isSelected && !opt.is_correct) {
                    optClass = "border-2 border-red-500 bg-red-50 text-red-800";
                  }
                } else if (isSelected) {
                  optClass = "border-2 border-primary bg-primary/5";
                }

                return (
                  <button
                    key={opt.id}
                    onClick={() => selectAnswer(currentQ.id, opt.id)}
                    disabled={isFinished}
                    className={cn("w-full text-left p-4 rounded-xl transition-all flex items-start gap-3", optClass)}
                  >
                    <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                      {letter}
                    </span>
                    <span className="pt-1">{opt.option_text}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Oldingi
          </Button>

          {!isFinished && (
            <Button variant="destructive" onClick={finishTest}>
              <CheckCircle className="w-4 h-4 mr-1" /> Testni yakunlash
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setCurrentIndex((p) => Math.min(questions.length - 1, p + 1))}
            disabled={currentIndex === questions.length - 1}
          >
            Keyingi <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Question grid */}
        <div className="flex flex-wrap gap-2 justify-center">
          {questions.map((q, i) => {
            let cls = "bg-muted text-muted-foreground";
            if (isFinished) {
              const sel = answers[q.id];
              const selOpt = q.options.find((o) => o.id === sel);
              if (selOpt?.is_correct) cls = "bg-green-500 text-white";
              else if (sel) cls = "bg-red-500 text-white";
              else cls = "bg-muted-foreground/30 text-muted-foreground";
            } else if (answers[q.id]) {
              cls = "bg-primary text-primary-foreground";
            }
            if (i === currentIndex && !isFinished) cls += " ring-2 ring-ring ring-offset-2";

            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={cn("w-10 h-10 rounded-lg text-sm font-bold transition-all", cls)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {results && (
          <Card className="border-2 border-primary">
            <CardContent className="p-6 text-center space-y-4">
              <h2 className="text-2xl font-bold">Test yakunlandi!</h2>
              <div className="text-5xl font-black">
                <span className="text-green-600">{results.correct}</span>
                <span className="text-muted-foreground">/{results.total}</span>
              </div>
              <p className="text-muted-foreground">
                {results.correct >= 16
                  ? "🎉 Tabriklaymiz! Siz yaxshi natija ko'rsatdingiz!"
                  : "😔 Afsuski, yetarli ball to'play olmadingiz. Qayta urinib ko'ring!"}
              </p>
              <Button onClick={() => navigate("/")} className="mt-4">
                Bosh sahifaga qaytish
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Test;
