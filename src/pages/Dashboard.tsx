import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, PlayCircle, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const { user, isAdmin, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalTests: 0, avgScore: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { data } = await supabase
        .from("test_sessions")
        .select("score, total_questions")
        .eq("user_id", user.id)
        .eq("is_completed", true);
      if (data && data.length > 0) {
        const avg = Math.round(data.reduce((s, t) => s + (t.score ?? 0), 0) / data.length);
        setStats({ totalTests: data.length, avgScore: avg });
      }
    };
    fetchStats();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Avtotest</h1>
              <p className="text-xs text-muted-foreground">{profile?.full_name || user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                <Shield className="w-4 h-4 mr-1" /> Admin
              </Button>
            )}
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" /> Chiqish
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Jami testlar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.totalTests}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">O'rtacha ball</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.avgScore}/20</p>
            </CardContent>
          </Card>
          <Card className="flex items-center justify-center p-6">
            <Button size="lg" className="text-lg px-8 py-6" onClick={() => navigate("/test")}>
              <PlayCircle className="w-6 h-6 mr-2" /> Testni boshlash
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
