import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Users,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  Leader,
  fetchAllLeaders,
  upsertLeader,
  deleteLeader,
  updateLeaderOrder,
  uploadLeaderPhoto,
} from "@/lib/services/leadersService";

const EMPTY_LEADER: Omit<Leader, "id" | "created_at" | "updated_at"> = {
  name: "",
  role: "",
  bio: "",
  photo_url: "",
  display_order: 0,
  is_active: true,
};

interface AdminLeadersTabProps {
  currentAdminName?: string;
}

export default function AdminLeadersTab({ currentAdminName }: AdminLeadersTabProps) {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState<Partial<Leader> & typeof EMPTY_LEADER>(
    EMPTY_LEADER
  );
  const [isEditing, setIsEditing] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Leader | null>(null);

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoTab, setPhotoTab] = useState<"url" | "upload">("url");

  useEffect(() => {
    loadLeaders();
  }, []);

  async function loadLeaders() {
    setLoading(true);
    const data = await fetchAllLeaders();
    setLeaders(data);
    setLoading(false);
  }

  function openAdd() {
    setEditingLeader({ ...EMPTY_LEADER, display_order: leaders.length });
    setIsEditing(false);
    setPhotoTab("url");
    setDialogOpen(true);
  }

  function openEdit(leader: Leader) {
    setEditingLeader({ ...leader });
    setIsEditing(true);
    setPhotoTab("url");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editingLeader.name.trim() || !editingLeader.role.trim()) {
      toast.error("Name and role are required.");
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertLeader(editingLeader as Leader);
      if (isEditing) {
        setLeaders((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
        toast.success("Leader updated successfully.");
      } else {
        setLeaders((prev) => [...prev, saved]);
        toast.success("Leader added successfully.");
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteLeader(deleteTarget.id);
      setLeaders((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      toast.success(`${deleteTarget.name} removed.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error(msg);
    } finally {
      setDeleteTarget(null);
    }
  }

  async function move(idx: number, dir: "up" | "down") {
    const next = [...leaders];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setLeaders(next);
    try {
      await updateLeaderOrder(next);
      toast.success("Order updated.");
    } catch {
      toast.error("Failed to save new order.");
      await loadLeaders(); // revert
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadLeaderPhoto(file);
      setEditingLeader((prev) => ({ ...prev, photo_url: url }));
      toast.success("Photo uploaded.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function toggleActive(leader: Leader) {
    try {
      const updated = await upsertLeader({ ...leader, is_active: !leader.is_active });
      setLeaders((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      toast.success(updated.is_active ? "Leader shown on site." : "Leader hidden from site.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle visibility";
      toast.error(msg);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading leaders…</span>
      </div>
    );
  }

  const activeCount = leaders.filter((l) => l.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Leaders & Directors
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage the "Mentorship &amp; Leadership" section shown on the About page.{" "}
            <span className="text-primary font-medium">{activeCount} visible</span> ·{" "}
            {leaders.length} total
          </p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Leader
        </Button>
      </div>

      {/* Leader cards */}
      {leaders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No leaders found. Click "Add Leader" to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leaders.map((leader, idx) => (
            <Card
              key={leader.id}
              className={`glass border overflow-hidden transition-all ${
                !leader.is_active ? "opacity-50 border-dashed" : ""
              }`}
            >
              {/* Photo */}
              <div className="relative h-52 bg-muted overflow-hidden">
                {leader.photo_url ? (
                  <img
                    src={leader.photo_url}
                    alt={leader.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://placehold.co/400x300?text=No+Photo";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Users className="w-12 h-12 opacity-20" />
                  </div>
                )}
                {!leader.is_active && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <Badge variant="secondary">Hidden</Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-4 space-y-3">
                {/* Info */}
                <div>
                  <p className="font-semibold text-sm leading-tight">{leader.name}</p>
                  <p className="text-primary text-[10px] font-bold uppercase tracking-widest mt-0.5">
                    {leader.role}
                  </p>
                  {leader.bio && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">
                      {leader.bio}
                    </p>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => move(idx, "up")}
                    disabled={idx === 0}
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => move(idx, "down")}
                    disabled={idx === leaders.length - 1}
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => toggleActive(leader)}
                    title={leader.is_active ? "Hide from site" : "Show on site"}
                  >
                    {leader.is_active ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </Button>

                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => openEdit(leader)}
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-7 w-7 ml-auto"
                    onClick={() => setDeleteTarget(leader)}
                    title="Remove"
                    disabled={leader.id.startsWith("default-")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {leader.id.startsWith("default-") && (
                  <p className="text-[10px] text-amber-500 italic">
                    ⚠ This is a default fallback entry. Save to DB first to enable editing.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg glass border border-white/20">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Leader" : "Add New Leader"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="leader-name">Full Name *</Label>
                <Input
                  id="leader-name"
                  placeholder="Dr. Example Name"
                  value={editingLeader.name}
                  onChange={(e) =>
                    setEditingLeader((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="leader-role">Role / Title *</Label>
                <Input
                  id="leader-role"
                  placeholder="Chief Mentor & Patron"
                  value={editingLeader.role}
                  onChange={(e) =>
                    setEditingLeader((prev) => ({ ...prev, role: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="leader-bio">Short Bio</Label>
              <Textarea
                id="leader-bio"
                placeholder="A brief description of this leader's role and contribution…"
                rows={3}
                value={editingLeader.bio}
                onChange={(e) =>
                  setEditingLeader((prev) => ({ ...prev, bio: e.target.value }))
                }
              />
            </div>

            {/* Photo section */}
            <div className="space-y-2">
              <Label>Photo</Label>
              <Tabs value={photoTab} onValueChange={(v) => setPhotoTab(v as "url" | "upload")}>
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
                    placeholder="https://example.com/photo.jpg"
                    value={editingLeader.photo_url}
                    onChange={(e) =>
                      setEditingLeader((prev) => ({ ...prev, photo_url: e.target.value }))
                    }
                  />
                </TabsContent>

                <TabsContent value="upload" className="mt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => fileInputRef.current?.click()}
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
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    {editingLeader.photo_url && (
                      <span className="text-xs text-green-500 font-medium">✓ Photo ready</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Requires a "leaders-photos" storage bucket in Supabase (public read).
                  </p>
                </TabsContent>
              </Tabs>

              {/* Preview */}
              {editingLeader.photo_url && (
                <div className="mt-2">
                  <img
                    src={editingLeader.photo_url}
                    alt="Preview"
                    className="h-24 w-24 rounded-xl object-cover border border-white/20"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="leader-active" className="cursor-pointer">
                Show on website
              </Label>
              <input
                id="leader-active"
                type="checkbox"
                className="accent-primary"
                checked={editingLeader.is_active}
                onChange={(e) =>
                  setEditingLeader((prev) => ({ ...prev, is_active: e.target.checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Leader"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass border border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Leader</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide <strong>{deleteTarget?.name}</strong> from the website. Are you
              sure?
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
