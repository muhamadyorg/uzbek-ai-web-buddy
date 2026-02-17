import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Calendar, Shield, Save } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const Profile = () => {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);

  // Password change
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">Yuklanmoqda...</p></div>;
  if (!user) { navigate("/login"); return null; }

  const isExpired = profile?.expires_at ? isPast(new Date(profile.expires_at)) : false;
  const isActive = profile?.is_active && !isExpired;

  const handleSaveName = async () => {
    if (!fullName.trim()) { toast.error("Ism kiritilmagan"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("user_id", user.id);
    if (error) toast.error("Xatolik yuz berdi");
    else toast.success("Ism saqlandi");
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) { toast.error("Barcha maydonlarni to'ldiring"); return; }
    if (newPassword.length < 4) { toast.error("Parol kamida 4 belgidan iborat bo'lishi kerak"); return; }
    setChangingPw(true);

    // Verify old password by re-signing in
    const email = user.email ?? "";
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: oldPassword });
    if (signInErr) {
      toast.error("Joriy parol noto'g'ri");
      setChangingPw(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error("Parolni o'zgartirib bo'lmadi");
    else {
      toast.success("Parol muvaffaqiyatli o'zgartirildi");
      setOldPassword("");
      setNewPassword("");
    }
    setChangingPw(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Profil</h1>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-lg space-y-6">
        {/* User info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4" /> Shaxsiy ma'lumotlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>To'liq ism</Label>
              <div className="flex gap-2">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ismingiz" />
                <Button onClick={handleSaveName} disabled={saving} size="icon" variant="outline">
                  <Save className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <Badge variant="secondary">Admin</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" /> Obuna holati
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Holati</span>
              <Badge className={cn(isActive ? "bg-green-600" : "bg-destructive")}>
                {isActive ? "Faol" : isExpired ? "Muddati tugagan" : "Bloklangan"}
              </Badge>
            </div>
            {profile?.expires_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tugash sanasi</span>
                <span className={cn("text-sm font-medium", isExpired ? "text-destructive" : "text-foreground")}>
                  {format(new Date(profile.expires_at), "dd.MM.yyyy")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parolni o'zgartirish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Joriy parol</Label>
              <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••" />
            </div>
            <div className="space-y-2">
              <Label>Yangi parol</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••" />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPw} className="w-full">
              {changingPw ? "O'zgartirilmoqda..." : "Parolni o'zgartirish"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
