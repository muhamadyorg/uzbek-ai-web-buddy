import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, PlayCircle, LogOut, Shield, User, Trophy, Target, Clock, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";

interface TestSession {
  id: string;
  score: number | null;
  total_questions: number;
  started_at: string;
  finished_at: string | null;
  is_completed: boolean;
}

const Dashboard = () => {
  const { user, isAdmin, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchSessions = async () => {
      const { data } = await supabase
        .from("test_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .order("started_at", { ascending: false })
        .limit(20);
      setSessions(data ?? []);
      setLoading(false);
    };
    fetchSessions();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const totalTests = sessions.length;
  const avgScore = totalTests > 0 ? Math.round(sessions.reduce((s, t) => s + (t.score ?? 0), 0) / totalTests) : 0;
  const passedCount = sessions.filter(s => (s.total_questions - (s.score ?? 0)) <= 2).length;
  const passRate = totalTests > 0 ? Math.round((passedCount / totalTests) * 100) : 0;
  const bestScore = totalTests > 0 ? Math.max(...sessions.map(s => s.score ?? 0)) : 0;

  const isExpired = profile?.expires_at ? isPast(new Date(profile.expires_at)) : false;
  const isActive = profile?.is_active && !isExpired;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Avtotest</h1>
              <p className="text-xs text-muted-foreground">{profile?.full_name || "Foydalanuvchi"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>
              <User className="w-4 h-4 mr-1" /> Profil
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="w-4 h-4 mr-1" /> Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" /> Chiqish
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        {/* Subscription status */}
        {!isActive && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">
              {isExpired ? "Obuna muddati tugagan. Admin bilan bog'laning." : "Hisobingiz bloklangan."}
            </p>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Jami testlar
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
                <Trophy className="w-3.5 h-3.5" /> Eng yuqori ball
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-foreground">{bestScore}<span className="text-lg text-muted-foreground">/20</span></p>
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

        {/* Start test */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">Testni boshlash</h3>
              <p className="text-sm text-muted-foreground">20 ta savol • 25 daqiqa • Maksimal 2 ta xato</p>
            </div>
            <Button size="lg" className="text-base px-8" onClick={() => navigate("/test")} disabled={!isActive}>
              <PlayCircle className="w-5 h-5 mr-2" /> Boshlash
            </Button>
          </CardContent>
        </Card>

        {/* Test history */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">So'nggi natijalar</h3>
          {loading ? (
            <p className="text-muted-foreground text-sm">Yuklanmoqda...</p>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Hali test topshirilmagan
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const wrong = s.total_questions - (s.score ?? 0);
                const passed = wrong <= 2;
                return (
                  <Card key={s.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          passed ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
                        )}>
                          {passed ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">
                            {s.score}/{s.total_questions} to'g'ri
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(s.started_at), "dd.MM.yyyy HH:mm")}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-xs font-bold px-3 py-1 rounded-full",
                        passed ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
                      )}>
                        {passed ? "O'tdi ✅" : "O'tmadi ❌"}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
