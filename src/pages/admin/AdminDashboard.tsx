import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileQuestion, Trophy, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface RecentTest {
  id: string;
  user_id: string;
  score: number | null;
  total_questions: number;
  started_at: string;
  user_name?: string;
}

const AdminDashboard = () => {
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalTests, setTotalTests] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [passRate, setPassRate] = useState(0);
  const [recentTests, setRecentTests] = useState<RecentTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Users count
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });

      // Questions count
      const { count: questionsCount } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true });

      // Tests
      const { data: sessions } = await supabase
        .from("test_sessions")
        .select("*")
        .eq("is_completed", true)
        .order("started_at", { ascending: false })
        .limit(100);

      const completedSessions = sessions ?? [];
      const testsCount = completedSessions.length;
      const avg = testsCount > 0
        ? Math.round(completedSessions.reduce((s, t) => s + (t.score ?? 0), 0) / testsCount)
        : 0;
      const passed = completedSessions.filter(s => (s.total_questions - (s.score ?? 0)) <= 2).length;
      const rate = testsCount > 0 ? Math.round((passed / testsCount) * 100) : 0;

      setTotalUsers(usersCount ?? 0);
      setTotalQuestions(questionsCount ?? 0);
      setTotalTests(testsCount);
      setAvgScore(avg);
      setPassRate(rate);

      // Recent tests with user names
      const recent = completedSessions.slice(0, 10);
      const userIds = [...new Set(recent.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds.length > 0 ? userIds : ["none"]);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) ?? []);
      setRecentTests(recent.map(s => ({ ...s, user_name: nameMap.get(s.user_id) || "Nomsiz" })));

      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <p className="text-muted-foreground">Yuklanmoqda...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Foydalanuvchilar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-foreground">{totalUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileQuestion className="w-3.5 h-3.5" /> Savollar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-foreground">{totalQuestions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Jami testlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-foreground">{totalTests}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> O'rtacha ball
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-foreground">{avgScore}<span className="text-lg text-muted-foreground">/20</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Muvaffaqiyat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-foreground">{passRate}<span className="text-lg text-muted-foreground">%</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Recent tests */}
      <div>
        <h3 className="text-lg font-bold text-foreground mb-3">So'nggi testlar</h3>
        {recentTests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Hali test topshirilmagan
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentTests.map((t) => {
              const wrong = t.total_questions - (t.score ?? 0);
              const passed = wrong <= 2;
              return (
                <Card key={t.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                        passed ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
                      )}>
                        {passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{t.user_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.score}/{t.total_questions} to'g'ri • {format(new Date(t.started_at), "dd.MM.yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn(
                      "text-xs",
                      passed ? "bg-green-500/10 text-green-500 border-green-500/30" : "bg-destructive/10 text-destructive border-destructive/30"
                    )} variant="outline">
                      {passed ? "O'tdi" : "O'tmadi"}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
