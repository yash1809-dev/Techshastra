/**
 * /members/:username/edit — full profile editor.
 * Sections: Bio/links, Skills, Education, Experience, Certifications.
 * Only accessible by the profile owner (ProtectedStudentRoute + own check).
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus, Trash2, Save, ArrowLeft, GraduationCap,
  Briefcase, Award, Code2, User, Check, Camera, Upload, RefreshCw,
} from "lucide-react";
import {
  getStudentByGithub, updateStudent,
  type StudentProfile, type EducationEntry,
  type ExperienceEntry, type CertificationEntry,
} from "@/lib/studentStore";
import { getStudentByUsername, updateStudentProfile } from "@/lib/services/studentService";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { uploadFile } from "@/lib/supabase/storage";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

// ─── SHARED INPUT STYLES ─────────────────────────────────────────────────────

const cls = {
  input: "w-full glass rounded-xl border-0 px-4 py-3 text-sm font-light focus:outline-none focus:ring-1 focus:ring-primary/30 bg-transparent placeholder:text-foreground/30",
  label: "block text-[10px] uppercase tracking-widest text-foreground/50 mb-1.5",
  row: "grid md:grid-cols-2 gap-4",
  card: "glass border-0 rounded-3xl",
  sectionHeader: "flex items-center gap-3 mb-6",
  sectionIcon: "w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0",
};

const genId = () => crypto.randomUUID();

// ─── EDUCATION ────────────────────────────────────────────────────────────────

const emptyEdu = (): EducationEntry => ({
  id: genId(), institution: "", degree: "", field: "",
  startYear: "", endYear: "", grade: "",
});

const EducationSection = ({
  entries,
  onChange,
}: {
  entries: EducationEntry[];
  onChange: (e: EducationEntry[]) => void;
}) => {
  const update = (id: string, patch: Partial<EducationEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const add = () => onChange([...entries, emptyEdu()]);

  return (
    <Card className={cls.card}>
      <CardHeader className="pb-0">
        <div className={cls.sectionHeader}>
          <div className={cls.sectionIcon}><GraduationCap size={16} className="text-primary" /></div>
          <h2 className="text-sm font-heading uppercase tracking-[0.2em] text-foreground/70">Education</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.div key={e.id}
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pb-6 border-b border-foreground/10 last:border-0 last:pb-0">
              <div className={cls.row}>
                <div>
                  <label className={cls.label}>Institution *</label>
                  <input value={e.institution} onChange={(ev) => update(e.id, { institution: ev.target.value })}
                    className={cls.input} placeholder="Uttarakhand Technical University" />
                </div>
                <div>
                  <label className={cls.label}>Degree *</label>
                  <input value={e.degree} onChange={(ev) => update(e.id, { degree: ev.target.value })}
                    className={cls.input} placeholder="B.Tech" />
                </div>
              </div>
              <div className={cls.row}>
                <div>
                  <label className={cls.label}>Field of Study</label>
                  <input value={e.field ?? ""} onChange={(ev) => update(e.id, { field: ev.target.value })}
                    className={cls.input} placeholder="Computer Science & Engineering" />
                </div>
                <div>
                  <label className={cls.label}>Grade / CGPA</label>
                  <input value={e.grade ?? ""} onChange={(ev) => update(e.id, { grade: ev.target.value })}
                    className={cls.input} placeholder="8.5 / 10" />
                </div>
              </div>
              <div className={cls.row}>
                <div>
                  <label className={cls.label}>Start Year *</label>
                  <input value={e.startYear} onChange={(ev) => update(e.id, { startYear: ev.target.value })}
                    className={cls.input} placeholder="2021" />
                </div>
                <div>
                  <label className={cls.label}>End Year (blank = Present)</label>
                  <input value={e.endYear ?? ""} onChange={(ev) => update(e.id, { endYear: ev.target.value })}
                    className={cls.input} placeholder="2025" />
                </div>
              </div>
              <button onClick={() => remove(e.id)}
                className="flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive transition-colors font-light">
                <Trash2 size={13} /> Remove
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <Button type="button" variant="outline" size="sm" onClick={add}
          className="rounded-full gap-2 text-xs font-light">
          <Plus size={13} /> Add Education
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── EXPERIENCE ───────────────────────────────────────────────────────────────

const emptyExp = (): ExperienceEntry => ({
  id: genId(), company: "", role: "", startDate: "", endDate: "", description: "",
});

const ExperienceSection = ({
  entries,
  onChange,
}: {
  entries: ExperienceEntry[];
  onChange: (e: ExperienceEntry[]) => void;
}) => {
  const update = (id: string, patch: Partial<ExperienceEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const add = () => onChange([...entries, emptyExp()]);

  return (
    <Card className={cls.card}>
      <CardHeader className="pb-0">
        <div className={cls.sectionHeader}>
          <div className={cls.sectionIcon}><Briefcase size={16} className="text-primary" /></div>
          <h2 className="text-sm font-heading uppercase tracking-[0.2em] text-foreground/70">Experience</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.div key={e.id}
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pb-6 border-b border-foreground/10 last:border-0 last:pb-0">
              <div className={cls.row}>
                <div>
                  <label className={cls.label}>Role / Title *</label>
                  <input value={e.role} onChange={(ev) => update(e.id, { role: ev.target.value })}
                    className={cls.input} placeholder="Frontend Developer" />
                </div>
                <div>
                  <label className={cls.label}>Company / Organisation *</label>
                  <input value={e.company} onChange={(ev) => update(e.id, { company: ev.target.value })}
                    className={cls.input} placeholder="Startup XYZ" />
                </div>
              </div>
              <div className={cls.row}>
                <div>
                  <label className={cls.label}>Start Date *</label>
                  <input value={e.startDate} onChange={(ev) => update(e.id, { startDate: ev.target.value })}
                    className={cls.input} placeholder="Jan 2024" />
                </div>
                <div>
                  <label className={cls.label}>End Date (blank = Present)</label>
                  <input value={e.endDate ?? ""} onChange={(ev) => update(e.id, { endDate: ev.target.value })}
                    className={cls.input} placeholder="Jun 2024" />
                </div>
              </div>
              <div>
                <label className={cls.label}>Description</label>
                <textarea value={e.description ?? ""} onChange={(ev) => update(e.id, { description: ev.target.value })}
                  rows={3} className={`${cls.input} resize-none`}
                  placeholder="What did you build or achieve?" />
              </div>
              <button onClick={() => remove(e.id)}
                className="flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive transition-colors font-light">
                <Trash2 size={13} /> Remove
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <Button type="button" variant="outline" size="sm" onClick={add}
          className="rounded-full gap-2 text-xs font-light">
          <Plus size={13} /> Add Experience
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── CERTIFICATIONS ───────────────────────────────────────────────────────────

const emptyCert = (): CertificationEntry => ({
  id: genId(), name: "", issuer: "", date: "", url: "",
});

const CertSection = ({
  entries,
  onChange,
}: {
  entries: CertificationEntry[];
  onChange: (e: CertificationEntry[]) => void;
}) => {
  const update = (id: string, patch: Partial<CertificationEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const add = () => onChange([...entries, emptyCert()]);

  return (
    <Card className={cls.card}>
      <CardHeader className="pb-0">
        <div className={cls.sectionHeader}>
          <div className={cls.sectionIcon}><Award size={16} className="text-primary" /></div>
          <h2 className="text-sm font-heading uppercase tracking-[0.2em] text-foreground/70">Certifications</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.div key={e.id}
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pb-6 border-b border-foreground/10 last:border-0 last:pb-0">
              <div className={cls.row}>
                <div>
                  <label className={cls.label}>Certificate Name *</label>
                  <input value={e.name} onChange={(ev) => update(e.id, { name: ev.target.value })}
                    className={cls.input} placeholder="AWS Certified Solutions Architect" />
                </div>
                <div>
                  <label className={cls.label}>Issuing Organisation *</label>
                  <input value={e.issuer} onChange={(ev) => update(e.id, { issuer: ev.target.value })}
                    className={cls.input} placeholder="Amazon Web Services" />
                </div>
              </div>
              <div className={cls.row}>
                <div>
                  <label className={cls.label}>Date Issued</label>
                  <input value={e.date ?? ""} onChange={(ev) => update(e.id, { date: ev.target.value })}
                    className={cls.input} placeholder="March 2024" />
                </div>
                <div>
                  <label className={cls.label}>Credential URL</label>
                  <input value={e.url ?? ""} onChange={(ev) => update(e.id, { url: ev.target.value })}
                    className={cls.input} placeholder="https://credly.com/badges/..." />
                </div>
              </div>
              <button onClick={() => remove(e.id)}
                className="flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive transition-colors font-light">
                <Trash2 size={13} /> Remove
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <Button type="button" variant="outline" size="sm" onClick={add}
          className="rounded-full gap-2 text-xs font-light">
          <Plus size={13} /> Add Certification
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── SKILLS ───────────────────────────────────────────────────────────────────

const SkillsSection = ({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (s: string[]) => void;
}) => {
  const [draft, setDraft] = useState("");

  const addSkill = () => {
    const trimmed = draft.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    onChange([...skills, trimmed]);
    setDraft("");
  };

  return (
    <Card className={cls.card}>
      <CardHeader className="pb-0">
        <div className={cls.sectionHeader}>
          <div className={cls.sectionIcon}><Code2 size={16} className="text-primary" /></div>
          <h2 className="text-sm font-heading uppercase tracking-[0.2em] text-foreground/70">Skills</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
            className={`${cls.input} flex-1`}
            placeholder="React, Python, Docker… (press Enter)"
          />
          <Button type="button" size="sm" onClick={addSkill} className="rounded-xl flex-shrink-0">
            <Plus size={14} />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <Badge key={s} variant="secondary"
              className="font-light text-xs gap-1.5 pr-1.5 cursor-pointer hover:bg-destructive/20 transition-colors"
              onClick={() => onChange(skills.filter((x) => x !== s))}>
              {s} <span className="text-foreground/40 hover:text-destructive">×</span>
            </Badge>
          ))}
        </div>
        {skills.length === 0 && (
          <p className="text-xs text-foreground/30 font-light">No skills added yet.</p>
        )}
      </CardContent>
    </Card>
  );
};

// ─── PAGE ─────────────────────────────────────────────────────────────────────

const MemberEdit = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { session } = useStudentAuth();
  const { toast } = useToast();

  // Only owner can edit
  const isOwn = session?.githubUsername?.toLowerCase() === username?.toLowerCase();

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [avatar, setAvatar] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bio, setBio] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [experience, setExperience] = useState<ExperienceEntry[]>([]);
  const [certifications, setCertifications] = useState<CertificationEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!username) return;
    const fetchMember = async () => {
      let s: any = null;
      try {
        const remote = await getStudentByUsername(username);
        if (remote) {
          s = {
            ...remote,
            githubUsername: remote.github_username || remote.githubUsername,
            name: remote.name || remote.username,
            avatar: remote.avatar || remote.avatar_url || (remote as any).profiles?.avatar_url,
            linkedinUrl: remote.linkedin_url || (remote as any).linkedinUrl,
            portfolioUrl: remote.portfolio_url || (remote as any).portfolioUrl,
            education: remote.education || [],
            experience: remote.experience || [],
            certifications: remote.certifications || [],
          };
        }
      } catch (_e) {}
      if (!s) {
        s = getStudentByGithub(username);
      }
      if (!s) { navigate(`/members/${username}`); return; }
      if (!isOwn) { navigate(`/members/${username}`); return; }
      setStudent(s);
      setAvatar(s.avatar ?? "");
      setBio(s.bio ?? "");
      setLinkedinUrl(s.linkedinUrl ?? "");
      setPortfolioUrl(s.portfolioUrl ?? "");
      setSkills(s.skills || []);
      setEducation(s.education || []);
      setExperience(s.experience || []);
      setCertifications(s.certifications || []);
    };
    fetchMember();
  }, [username, isOwn, navigate]);

  // Handle local image file upload & compression
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please upload an image file (PNG, JPG, WebP).", variant: "destructive" });
      return;
    }

    setAvatarUploading(true);

    try {
      // 1. If Supabase configured, attempt storage upload
      if (isSupabaseConfigured() && session?.studentId) {
        const ext = file.name.split(".").pop() || "png";
        const path = `${session.studentId}/avatar_${Date.now()}.${ext}`;
        const { url, error } = await uploadFile("avatars", path, file);
        if (url && !error) {
          setAvatar(url);
          toast({ title: "Avatar uploaded ✓" });
          setAvatarUploading(false);
          return;
        }
      }

      // 2. Fallback: Compress to responsive Data URL
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setAvatar(dataUrl);
          toast({ title: "Avatar updated locally ✓" });
          setAvatarUploading(false);
        };
        img.src = readerEvent.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err?.message || "Could not process image.", variant: "destructive" });
      setAvatarUploading(false);
    }
  };

  const save = async () => {
    if (!student) return;
    setSaving(true);
    try {
      await updateStudentProfile(student.id, {
        bio: bio || null,
        linkedin_url: linkedinUrl || null,
        portfolio_url: portfolioUrl || null,
        skills,
      });

      // Update avatar in profiles and student_profiles tables
      if (isSupabaseConfigured() && avatar) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const targetUserId = authData?.user?.id || (student as any).user_id || session?.studentId;
          if (targetUserId) {
            await supabase
              .from("profiles")
              .update({ avatar_url: avatar })
              .eq("id", targetUserId);
          }
          await supabase
            .from("student_profiles")
            .update({ avatar_url: avatar } as any)
            .eq("id", student.id);
        } catch (_avatarErr) {}
      }
    } catch (_err) {}
    updateStudent(student.id, {
      avatar: avatar || undefined,
      bio: bio || undefined,
      linkedinUrl: linkedinUrl || undefined,
      portfolioUrl: portfolioUrl || undefined,
      skills,
      education,
      experience,
      certifications,
    });

    // Dispatch a custom event so MemberProfile and other consumers
    // reactively update the avatar without a full page reload.
    if (avatar) {
      window.dispatchEvent(
        new CustomEvent("ts_avatar_updated", {
          detail: { avatarUrl: avatar, studentId: student.id },
        })
      );
    }

    setSaving(false);
    setSaved(true);
    toast({ title: "Profile saved ✓" });
    setTimeout(() => setSaved(false), 3000);
  };

  if (!student) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-foreground/40 font-light text-sm">Loading…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-24 max-w-3xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
          <div>
            <button onClick={() => navigate(`/members/${username}`)}
              className="flex items-center gap-2 text-xs text-foreground/40 hover:text-foreground transition-colors font-light mb-3">
              <ArrowLeft size={13} /> Back to profile
            </button>
            <h1 className="text-3xl font-heading font-light tracking-tight">Edit Profile</h1>
            <p className="text-foreground/40 font-light text-sm mt-1">@{username}</p>
          </div>
          <Button onClick={save} disabled={saving}
            className="rounded-full px-8 gap-2 shadow-xl">
            {saved ? <><Check size={15} /> Saved</> : saving ? "Saving…" : <><Save size={15} /> Save Changes</>}
          </Button>
        </div>

        <div className="space-y-8">

          {/* Profile Picture / Avatar */}
          <Card className={cls.card}>
            <CardHeader className="pb-0">
              <div className={cls.sectionHeader}>
                <div className={cls.sectionIcon}><Camera size={16} className="text-primary" /></div>
                <h2 className="text-sm font-heading uppercase tracking-[0.2em] text-foreground/70">Profile Picture</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Live Preview Avatar */}
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden ring-4 ring-primary/20 shadow-xl bg-card shrink-0">
                  {avatar || student.githubUsername ? (
                    <img
                      src={avatar || `https://github.com/${student.githubUsername}.png`}
                      alt={student.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <span className="text-3xl font-heading text-primary">{student.name[0]?.toUpperCase() ?? "U"}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 text-center sm:text-left w-full">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFile}
                        disabled={avatarUploading}
                      />
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-light bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20 cursor-pointer">
                        <Upload size={13} /> {avatarUploading ? "Processing…" : "Upload Photo"}
                      </span>
                    </label>

                    {avatar && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setAvatar("")}
                        className="rounded-full text-xs font-light gap-1.5 h-8 px-3.5 text-foreground/60"
                      >
                        <RefreshCw size={12} /> Reset to GitHub Avatar
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-foreground/40 font-light">
                    Upload a custom JPG, PNG, or WebP. Or paste an image URL below.
                  </p>
                  <div>
                    <input
                      type="url"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      className={cls.input}
                      placeholder="Or paste image URL (https://...)"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bio & links */}
          <Card className={cls.card}>
            <CardHeader className="pb-0">
              <div className={cls.sectionHeader}>
                <div className={cls.sectionIcon}><User size={16} className="text-primary" /></div>
                <h2 className="text-sm font-heading uppercase tracking-[0.2em] text-foreground/70">About</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className={cls.label}>Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                  rows={3} className={`${cls.input} resize-none`}
                  placeholder="Tell us about yourself…" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={cls.label}>LinkedIn URL</label>
                  <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
                    className={cls.input} placeholder="https://linkedin.com/in/yourname" />
                </div>
                <div>
                  <label className={cls.label}>Portfolio / Website</label>
                  <input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)}
                    className={cls.input} placeholder="https://yoursite.dev" />
                </div>
              </div>
            </CardContent>
          </Card>

          <SkillsSection skills={skills} onChange={setSkills} />
          <EducationSection entries={education} onChange={setEducation} />
          <ExperienceSection entries={experience} onChange={setExperience} />
          <CertSection entries={certifications} onChange={setCertifications} />

          {/* Save button (bottom) */}
          <div className="flex justify-end pt-4">
            <Button onClick={save} disabled={saving} className="rounded-full px-10 gap-2 shadow-xl h-14 text-sm tracking-widest uppercase font-light">
              {saved ? <><Check size={15} /> Saved!</> : saving ? "Saving…" : <><Save size={15} /> Save All Changes</>}
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MemberEdit;
