import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Edit, Image } from "lucide-react";
import { toast } from "sonner";

interface QuestionOption {
  id?: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

interface Question {
  id: string;
  question_text: string;
  image_url: string | null;
  created_at: string;
  options: QuestionOption[];
}

const Questions = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [qText, setQText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<QuestionOption[]>([
    { option_text: "", is_correct: false, sort_order: 0 },
    { option_text: "", is_correct: false, sort_order: 1 },
    { option_text: "", is_correct: false, sort_order: 2 },
    { option_text: "", is_correct: false, sort_order: 3 },
  ]);

  const fetchQuestions = async () => {
    const { data: qs } = await supabase.from("questions").select("*").order("created_at", { ascending: false });
    if (!qs) { setLoading(false); return; }

    const qIds = qs.map((q) => q.id);
    const { data: opts } = await supabase
      .from("question_options")
      .select("*")
      .in("question_id", qIds.length > 0 ? qIds : ["none"])
      .order("sort_order");

    const mapped: Question[] = qs.map((q) => ({
      ...q,
      options: opts?.filter((o) => o.question_id === q.id) ?? [],
    }));

    setQuestions(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, []);

  const resetForm = () => {
    setQText("");
    setImageFile(null);
    setImageUrl(null);
    setOptions([
      { option_text: "", is_correct: false, sort_order: 0 },
      { option_text: "", is_correct: false, sort_order: 1 },
      { option_text: "", is_correct: false, sort_order: 2 },
      { option_text: "", is_correct: false, sort_order: 3 },
    ]);
    setEditingId(null);
  };

  const openNew = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (q: Question) => {
    setEditingId(q.id);
    setQText(q.question_text);
    setImageUrl(q.image_url);
    setOptions(
      q.options.length > 0
        ? q.options.map((o) => ({ ...o }))
        : [
            { option_text: "", is_correct: false, sort_order: 0 },
            { option_text: "", is_correct: false, sort_order: 1 },
            { option_text: "", is_correct: false, sort_order: 2 },
            { option_text: "", is_correct: false, sort_order: 3 },
          ]
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!qText.trim()) { toast.error("Savol matnini kiriting"); return; }
    if (!options.some((o) => o.is_correct)) { toast.error("Kamida bitta to'g'ri javobni belgilang"); return; }
    if (options.some((o) => !o.option_text.trim())) { toast.error("Barcha variantlarni to'ldiring"); return; }

    let finalImageUrl = imageUrl;

    // Upload image if new file selected
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("question-images")
        .upload(fileName, imageFile);
      if (uploadError) { toast.error("Rasm yuklanmadi"); return; }
      const { data: urlData } = supabase.storage.from("question-images").getPublicUrl(fileName);
      finalImageUrl = urlData.publicUrl;
    }

    if (editingId) {
      // Update question
      await supabase.from("questions").update({ question_text: qText, image_url: finalImageUrl }).eq("id", editingId);
      // Delete old options and insert new
      await supabase.from("question_options").delete().eq("question_id", editingId);
      await supabase.from("question_options").insert(
        options.map((o, i) => ({ question_id: editingId, option_text: o.option_text, is_correct: o.is_correct, sort_order: i }))
      );
      toast.success("Savol yangilandi");
    } else {
      // Create question
      const { data: newQ } = await supabase
        .from("questions")
        .insert({ question_text: qText, image_url: finalImageUrl, created_by: user?.id })
        .select("id")
        .single();
      if (newQ) {
        await supabase.from("question_options").insert(
          options.map((o, i) => ({ question_id: newQ.id, option_text: o.option_text, is_correct: o.is_correct, sort_order: i }))
        );
      }
      toast.success("Savol qo'shildi");
    }

    setDialogOpen(false);
    resetForm();
    fetchQuestions();
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from("questions").delete().eq("id", id);
    toast.success("Savol o'chirildi");
    fetchQuestions();
  };

  const updateOption = (idx: number, field: keyof QuestionOption, value: string | boolean) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o)));
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { option_text: "", is_correct: false, sort_order: prev.length }]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  if (loading) return <p>Yuklanmoqda...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Savollar</h2>
          <p className="text-muted-foreground">Jami: {questions.length} ta savol</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Savol qo'shish
        </Button>
      </div>

      <div className="space-y-3">
        {questions.map((q, idx) => (
          <Card key={q.id}>
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <p className="font-medium">{idx + 1}. {q.question_text}</p>
                {q.image_url && (
                  <img src={q.image_url} alt="" className="h-20 rounded border object-cover" />
                )}
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <span
                      key={o.id}
                      className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        o.is_correct ? "bg-green-100 text-green-700 font-medium" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {o.option_text}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => openEdit(q)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteQuestion(q.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Savolni tahrirlash" : "Yangi savol"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Savol matni</Label>
              <Textarea value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Savolni kiriting..." />
            </div>
            <div className="space-y-2">
              <Label>Rasm (ixtiyoriy)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              {imageUrl && !imageFile && (
                <img src={imageUrl} alt="" className="h-24 rounded border object-cover" />
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Variantlar</Label>
                <Button size="sm" variant="outline" onClick={addOption}>
                  <Plus className="w-3 h-3 mr-1" /> Variant
                </Button>
              </div>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox
                    checked={opt.is_correct}
                    onCheckedChange={(v) => updateOption(i, "is_correct", !!v)}
                  />
                  <Input
                    value={opt.option_text}
                    onChange={(e) => updateOption(i, "option_text", e.target.value)}
                    placeholder={`Variant ${String.fromCharCode(65 + i)}`}
                    className="flex-1"
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeOption(i)} disabled={options.length <= 2}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">✅ To'g'ri javobni checkbox bilan belgilang</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSave}>{editingId ? "Saqlash" : "Qo'shish"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Questions;
