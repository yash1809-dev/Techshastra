import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Link,
  Loader2,
  Crown,
  Building2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dignitary,
  DignitySection,
  fetchAllDignitaries,
  upsertDignitary,
  deleteDignitary,
  updateDignitaryOrder,
  uploadDignitaryPhoto,
} from "@/lib/services/dignitariesService";

const EMPTY: Omit<Dignitary, "created_at" | "updated_at"> = {
  id: "",
  section: "leadership",
  name: "",
  title: "",
  institute: "",
  message: "",
  photo_url: "",
  display_order: 0,
  is_active: true,
};

interface Props {
  currentAdminName?: string;
}

export default function AdminDignitariesTab({ currentAdminName }: Props) {
  const [all, setAll] = useState<Dignitary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<DignitySection>("leadership");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Dignitary | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoInputMode, setPhotoInputMode] = useState<"url" | "upload">("url");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await fetchAllDignitaries();
    setAll(data);
    setLoading(false);
  }

  const list = all.filter((d) => d.section === activeSection);

  function openAdd() {
    setForm({ ...EMPTY, section: activeSection, display_order: list.length });
    setIsEditing(false);
    setPhotoInputMode("url");
    setDialogOpen(true);
  }

  function openEdit(d: Dignitary) {
    setForm({ ...d });
    setIsEditing(true);
    setPhotoInputMode("url");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.title.trim()) {
      toast.error("Name and title are required.");
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertDignitary(form);
      if (isEditing) {
        setAll((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
        toast.success("Entry updated.");
      } else {
        setAll((prev) => [...prev, saved]);
        toast.success("Entry added.");
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteDignitary(deleteTarget.id);
      setAll((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success(`${deleteTarget.name} removed.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function move(idx: number, dir: "up" | "down") {
    const sectionList = [...list];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sectionList.length) return;
    [sectionList[idx], sectionList[swap]] = [sectionList[swap], sectionList[idx]];
    // Replace section items in `all`
    const others = all.filter((d) => d.section !== activeSection);
    const nextAll = [...others, ...sectionList];
    setAll(nextAll);
    try {
      await updateDignitaryOrder(sectionList);
      toast.success("Order saved.");
    } catch {
      toast.error("Failed to save order.");
      await load();
    }
  }

  async function toggleActive(d: Dignitary) {
    try {
      const updated = await upsertDignitary({ ...d, is_active: !d.is_active });
      setAll((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(updated.is_active ? "Shown on site." : "Hidden from site.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadDignitaryPhoto(file);
      setForm((prev) => ({ ...prev, photo_url: url }));
      toast.success("Photo uploaded.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading…
      </div>
    );
  }

  const leadershipCount = all.filter((d) => d.section === "leadership" && d.is_active).length;
  const directorsCount = all.filter((d) => d.section === "directors" && d.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Dignitaries Management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage the "Esteemed Leadership" and "Directors" sections on the homepage.
          </p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Entry
        </Button>
      </div>

      {/* Section Tabs */}
      <Tabs
        value={activeSection}
        onValueChange={(v) => setActiveSection(v as DignitySection)}
        className="w-full"
      >
        <TabsList className="glass bg-white/40 dark:bg-white/5 border border-white/30 dark:border-white/10 p-1 gap-1 rounded-xl h-auto">
          <TabsTrigger value="leadership" className="text-xs px-4 py-2 rounded-lg gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            Esteemed Leadership
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {leadershipCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="directors" className="text-xs px-4 py-2 rounded-lg gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Directors
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {directorsCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {(["leadership", "directors"] as DignitySection[]).map((section) => (
          <TabsContent key={section} value={section} className="mt-4">
            {list.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Crown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No entries. Click "Add Entry" to get started.</p>
              </div>
            ) : (
              <div
                className={
                  section === "leadership"
                    ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    : "grid gap-4 sm:grid-cols-3 lg:grid-cols-6"
                }
              >
                {list.map((d, idx) => (
                  <Card
                    key={d.id}
                    className={`glass border overflow-hidden transition-all ${
                      !d.is_active ? "opacity-50 border-dashed" : ""
                    }`}
                  >
                    {/* Photo */}
                    <div
                      className={`relative bg-muted overflow-hidden ${
                        section === "leadership" ? "h-52" : "h-32"
                      }`}
                    >
                      {d.photo_url ? (
                        <img
                          src={d.photo_url}
                          alt={d.name}
                          className="w-full h-full object-cover object-top"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://placehold.co/300x300?text=No+Photo";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Crown className="w-10 h-10 opacity-20 text-muted-foreground" />
                        </div>
                      )}
                      {!d.is_active && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                          <Badge variant="secondary">Hidden</Badge>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-3 space-y-2">
                      <div>
                        <p className="font-semibold text-xs leading-tight line-clamp-2">{d.name}</p>
                        <p className="text-primary text-[10px] font-bold uppercase tracking-widest mt-0.5 line-clamp-1">
                          {d.title}
                        </p>
                        {d.institute && (
                          <p className="text-muted-foreground text-[10px] mt-0.5 line-clamp-1">
                            {d.institute}
                          </p>
                        )}
                        {d.message && (
                          <p className="text-muted-foreground text-[10px] italic mt-0.5 line-clamp-1">
                            {d.message}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => move(idx, "up")}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => move(idx, "down")}
                          disabled={idx === list.length - 1}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => toggleActive(d)}
                          title={d.is_active ? "Hide" : "Show"}
                        >
                          {d.is_active ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-6 w-6 ml-auto"
                          onClick={() => setDeleteTarget(d)}
                          disabled={d.id.startsWith("default-")}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      {d.id.startsWith("default-") && (
                        <p className="text-[9px] text-amber-500 italic">
                          ⚠ Default fallback — save to DB to enable editing
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg glass border border-white/20">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Entry" : "Add New Entry"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Section selector */}
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select
                value={form.section}
                onValueChange={(v) => setForm((p) => ({ ...p, section: v as DignitySection }))}
              >
                <SelectTrigger className="glass">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leadership">Esteemed Leadership</SelectItem>
                  <SelectItem value="directors">Directors</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  placeholder="Dr. Example"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Title / Role *</Label>
                <Input
                  placeholder="Governor, Uttarakhand"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
            </div>

            {form.section === "directors" && (
              <div className="space-y-1.5">
                <Label>Institution</Label>
                <Input
                  placeholder="B.T.K.I.T. Dwarahat"
                  value={form.institute || ""}
                  onChange={(e) => setForm((p) => ({ ...p, institute: e.target.value }))}
                />
              </div>
            )}

            {form.section === "leadership" && (
              <div className="space-y-1.5">
                <Label>Message Link Text (optional)</Label>
                <Input
                  placeholder="Honourable Chancellor's Message"
                  value={form.message || ""}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                />
              </div>
            )}

            {/* Photo */}
            <div className="space-y-2">
              <Label>Photo</Label>
              <Tabs
                value={photoInputMode}
                onValueChange={(v) => setPhotoInputMode(v as "url" | "upload")}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="url" className="text-xs gap-1.5 px-3">
                    <Link className="w-3 h-3" /> URL
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="text-xs gap-1.5 px-3">
                    <Upload className="w-3 h-3" /> Upload
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="url" className="mt-2">
                  <Input
                    placeholder="https://example.com/photo.jpg  or  /public-path.jpg"
                    value={form.photo_url}
                    onChange={(e) => setForm((p) => ({ ...p, photo_url: e.target.value }))}
                  />
                </TabsContent>
                <TabsContent value="upload" className="mt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingPhoto}
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {uploadingPhoto ? "Uploading…" : "Choose Photo"}
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    {form.photo_url && (
                      <span className="text-xs text-green-500 font-medium">✓ Photo ready</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Requires a "dignitaries-photos" storage bucket in Supabase (public read).
                  </p>
                </TabsContent>
              </Tabs>

              {form.photo_url && (
                <img
                  src={form.photo_url}
                  alt="Preview"
                  className="mt-2 h-24 w-24 rounded-xl object-cover object-top border border-white/20"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="d-active" className="cursor-pointer">
                Show on website
              </Label>
              <input
                id="d-active"
                type="checkbox"
                className="accent-primary"
                checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass border border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Entry</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide <strong>{deleteTarget?.name}</strong> from the homepage. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
