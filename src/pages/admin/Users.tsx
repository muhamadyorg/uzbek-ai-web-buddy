import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, UserCheck, UserX, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format, isPast } from "date-fns";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  email?: string;
}

const Users = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleActive = async (profile: UserProfile) => {
    await supabase
      .from("profiles")
      .update({ is_active: !profile.is_active })
      .eq("id", profile.id);
    toast.success(profile.is_active ? "Foydalanuvchi bloklandi" : "Foydalanuvchi faollashtirildi");
    fetchUsers();
  };

  const extendExpiry = async (profile: UserProfile) => {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);
    await supabase
      .from("profiles")
      .update({ expires_at: newExpiry.toISOString(), is_active: true })
      .eq("id", profile.id);
    toast.success("Muddat 30 kunga uzaytirildi");
    fetchUsers();
  };

  const createUser = async () => {
    if (!newEmail || !newPassword || !newName) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    setCreating(true);

    const { data, error: fnError } = await supabase.functions.invoke("create-user", {
      body: { email: newEmail, password: newPassword, full_name: newName },
    });

    const error = fnError || (data?.error ? { message: data.error } : null);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Foydalanuvchi yaratildi");
      setDialogOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setTimeout(fetchUsers, 1000);
    }
    setCreating(false);
  };

  if (loading) return <p>Yuklanmoqda...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Foydalanuvchilar</h2>
          <p className="text-muted-foreground">Jami: {users.length} ta</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Foydalanuvchi qo'shish
        </Button>
      </div>

      <div className="space-y-3">
        {users.map((u) => {
          const expired = u.expires_at ? isPast(new Date(u.expires_at)) : false;
          return (
            <Card key={u.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{u.full_name || "Nomsiz"}</p>
                  <div className="flex gap-2">
                    {u.is_active && !expired ? (
                      <Badge variant="default" className="bg-green-600">Faol</Badge>
                    ) : (
                      <Badge variant="destructive">{expired ? "Muddati tugagan" : "Bloklangan"}</Badge>
                    )}
                    {u.expires_at && (
                      <span className="text-xs text-muted-foreground">
                        Tugaydi: {format(new Date(u.expires_at), "dd.MM.yyyy")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" title="Muddatni uzaytirish" onClick={() => extendExpiry(u)}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => toggleActive(u)}>
                    {u.is_active ? <UserX className="w-4 h-4 text-destructive" /> : <UserCheck className="w-4 h-4 text-green-600" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yangi foydalanuvchi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ism</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="To'liq ism" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Parol</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Kamida 6 belgi" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
            <Button onClick={createUser} disabled={creating}>{creating ? "Yaratilmoqda..." : "Yaratish"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
