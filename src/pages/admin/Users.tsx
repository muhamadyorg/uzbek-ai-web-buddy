import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, UserCheck, UserX, RefreshCw, Edit, Shield, ShieldOff, Key, Search } from "lucide-react";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  email?: string;
  isAdmin?: boolean;
}

const Users = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit user dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const adminUserIds = new Set(
      roles?.filter(r => r.role === "admin").map(r => r.user_id) ?? []
    );

    // Fetch emails for all users via edge function
    const enriched: UserProfile[] = [];
    for (const p of profiles ?? []) {
      let email = "";
      try {
        const { data } = await supabase.functions.invoke("admin-update-user", {
          body: { action: "get_user_info", user_id: p.user_id },
        });
        email = data?.email ?? "";
      } catch { /* ignore */ }

      enriched.push({
        ...p,
        email,
        isAdmin: adminUserIds.has(p.user_id),
      });
    }

    setUsers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = users.filter(u =>
    !searchQuery ||
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleActive = async (profile: UserProfile) => {
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: { action: "update_profile", user_id: profile.user_id, is_active: !profile.is_active },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Xatolik");
    } else {
      toast.success(profile.is_active ? "Foydalanuvchi bloklandi" : "Foydalanuvchi faollashtirildi");
      fetchUsers();
    }
  };

  const extendExpiry = async (profile: UserProfile) => {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: { action: "update_profile", user_id: profile.user_id, expires_at: newExpiry.toISOString(), is_active: true },
    });
    if (error || data?.error) toast.error(data?.error || "Xatolik");
    else { toast.success("Muddat 30 kunga uzaytirildi"); fetchUsers(); }
  };

  const toggleAdmin = async (profile: UserProfile) => {
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: { action: "toggle_role", user_id: profile.user_id, role: "admin" },
    });
    if (error || data?.error) toast.error(data?.error || "Xatolik");
    else {
      toast.success(profile.isAdmin ? "Admin roli olib tashlandi" : "Admin roli berildi");
      fetchUsers();
    }
  };

  const createUser = async () => {
    if (!newEmail || !newPassword || !newName) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    setCreating(true);
    const email = newEmail.includes("@") ? newEmail : `${newEmail}@avtotest.uz`;
    const { data, error: fnError } = await supabase.functions.invoke("create-user", {
      body: { email, password: newPassword, full_name: newName },
    });
    const error = fnError || (data?.error ? { message: data.error } : null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Foydalanuvchi yaratildi");
      setCreateOpen(false);
      setNewEmail(""); setNewPassword(""); setNewName("");
      setTimeout(fetchUsers, 1000);
    }
    setCreating(false);
  };

  const openEdit = (u: UserProfile) => {
    setEditUser(u);
    setEditName(u.full_name);
    setEditEmail(u.email?.replace("@avtotest.uz", "") ?? "");
    setEditPassword("");
    setEditExpiresAt(u.expires_at ? format(new Date(u.expires_at), "yyyy-MM-dd") : "");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);

    // Update profile (name, expiry)
    const profileUpdates: Record<string, unknown> = {};
    if (editName.trim() && editName !== editUser.full_name) profileUpdates.full_name = editName.trim();
    if (editExpiresAt) profileUpdates.expires_at = new Date(editExpiresAt).toISOString();

    if (Object.keys(profileUpdates).length > 0) {
      const { data, error } = await supabase.functions.invoke("admin-update-user", {
        body: { action: "update_profile", user_id: editUser.user_id, ...profileUpdates },
      });
      if (error || data?.error) { toast.error(data?.error || "Profil yangilanmadi"); setSaving(false); return; }
    }

    // Update credentials (email/password)
    const credUpdates: Record<string, string> = {};
    const newEmailFull = editEmail.includes("@") ? editEmail : `${editEmail}@avtotest.uz`;
    if (editEmail && newEmailFull !== editUser.email) credUpdates.email = newEmailFull;
    if (editPassword) credUpdates.password = editPassword;

    if (Object.keys(credUpdates).length > 0) {
      const { data, error } = await supabase.functions.invoke("admin-update-user", {
        body: { action: "update_credentials", user_id: editUser.user_id, ...credUpdates },
      });
      if (error || data?.error) { toast.error(data?.error || "Kreditsiallar yangilanmadi"); setSaving(false); return; }
    }

    toast.success("Foydalanuvchi yangilandi");
    setEditOpen(false);
    setSaving(false);
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: { action: "delete_user", user_id: deleteUser.user_id },
    });
    if (error || data?.error) toast.error(data?.error || "Xatolik");
    else { toast.success("Foydalanuvchi o'chirildi"); setDeleteOpen(false); fetchUsers(); }
    setDeleting(false);
  };

  if (loading) return <p className="text-muted-foreground">Yuklanmoqda...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Foydalanuvchilar</h2>
          <p className="text-muted-foreground">Jami: {users.length} ta</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Foydalanuvchi qo'shish
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Qidirish (ism yoki login)..."
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {filteredUsers.map((u) => {
          const expired = u.expires_at ? isPast(new Date(u.expires_at)) : false;
          const loginName = u.email?.replace("@avtotest.uz", "") ?? "";
          return (
            <Card key={u.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground truncate">{u.full_name || "Nomsiz"}</p>
                    {u.isAdmin && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        <Shield className="w-3 h-3 mr-0.5" /> Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Login: <span className="font-mono">{loginName}</span></p>
                  <div className="flex flex-wrap gap-2 items-center">
                    {u.is_active && !expired ? (
                      <Badge variant="default" className="bg-green-600 text-xs">Faol</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">{expired ? "Muddati tugagan" : "Bloklangan"}</Badge>
                    )}
                    {u.expires_at && (
                      <span className="text-xs text-muted-foreground">
                        Tugaydi: {format(new Date(u.expires_at), "dd.MM.yyyy")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" title="Tahrirlash" onClick={() => openEdit(u)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Muddatni uzaytirish (+30 kun)" onClick={() => extendExpiry(u)}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title={u.isAdmin ? "Admin rolini olib tashlash" : "Admin qilish"} onClick={() => toggleAdmin(u)}>
                    {u.isAdmin ? <ShieldOff className="w-4 h-4 text-warning" /> : <Shield className="w-4 h-4 text-primary" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => toggleActive(u)}>
                    {u.is_active ? <UserX className="w-4 h-4 text-destructive" /> : <UserCheck className="w-4 h-4 text-green-600" />}
                  </Button>
                  <Button size="icon" variant="ghost" title="O'chirish" onClick={() => { setDeleteUser(u); setDeleteOpen(true); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
              <Label>Login</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="login" />
              <p className="text-xs text-muted-foreground">@ belgisisiz kiriting</p>
            </div>
            <div className="space-y-2">
              <Label>Parol</Label>
              <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Parol" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Bekor qilish</Button>
            <Button onClick={createUser} disabled={creating}>{creating ? "Yaratilmoqda..." : "Yaratish"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Foydalanuvchini tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ism</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Login</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              <p className="text-xs text-muted-foreground">@ belgisisiz kiriting</p>
            </div>
            <div className="space-y-2">
              <Label>Yangi parol <span className="text-muted-foreground">(bo'sh qoldirsa o'zgarmaydi)</span></Label>
              <Input type="text" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Yangi parol" />
            </div>
            <div className="space-y-2">
              <Label>Obuna tugash sanasi</Label>
              <Input type="date" value={editExpiresAt} onChange={(e) => setEditExpiresAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? "Saqlanmoqda..." : "Saqlash"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Foydalanuvchini o'chirish</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{deleteUser?.full_name}</strong> foydalanuvchisini o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Bekor qilish</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "O'chirilmoqda..." : "O'chirish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
