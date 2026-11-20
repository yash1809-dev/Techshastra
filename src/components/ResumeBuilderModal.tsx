import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Printer,
  Download,
  Save,
  Plus,
  Trash2,
  FileText,
  Eye,
  Check,
  Maximize2,
  Minimize2,
  Camera,
  Upload,
  RotateCcw,
  Layout,
  Columns,
  Sparkles,
  Layers,
  GraduationCap,
  Briefcase,
  Award,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { StudentProfile } from "@/lib/studentStore";
import type { GHUser, GHRepo } from "@/lib/githubApi";
import {
  type ResumeData,
  type ResumeProjectItem,
  type ResumeTemplateId,
  getDefaultResumeData,
  generateResumeHTML,
  printResumeData,
} from "@/components/ResumeDocument";
import { downloadLatex } from "@/lib/resumeExport";

interface ResumeBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentProfile;
  ghUser: GHUser | null;
  repos: GHRepo[];
  langMap: Record<string, number>;
  onSaveToProfile?: (updated: Partial<StudentProfile>) => void;
}

const TEMPLATES: Array<{
  id: ResumeTemplateId;
  name: string;
  badge: string;
  desc: string;
  icon: typeof FileText;
  hasPhoto?: boolean;
}> = [
  {
    id: "ats-single",
    name: "ATS Executive",
    badge: "99% ATS Score",
    desc: "Single-column format engineered for FAANG, MNCs & campus placements.",
    icon: FileText,
  },
  {
    id: "modern-two-col",
    name: "Modern 2-Column",
    badge: "Trending Tech",
    desc: "Technical sidebar for skills/contact + main panel for impact-driven projects.",
    icon: Columns,
  },
  {
    id: "photo-card",
    name: "Creative Photo Card",
    badge: "Photo Attached",
    desc: "Developer portfolio card with embedded photo, tech tags, and modern cards.",
    icon: Layout,
    hasPhoto: true,
  },
];

export default function ResumeBuilderModal({
  open,
  onOpenChange,
  student,
  ghUser,
  repos,
  langMap,
  onSaveToProfile,
}: ResumeBuilderModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [data, setData] = useState<ResumeData>(() =>
    getDefaultResumeData(student, ghUser, repos, langMap)
  );
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sync default data when opened or student changes
  useEffect(() => {
    if (open) {
      const storageKey = `ts_resume_data_${student.id}`;
      const savedCustom = localStorage.getItem(storageKey);
      if (savedCustom) {
        try {
          const parsed = JSON.parse(savedCustom);
          setData({
            ...getDefaultResumeData(student, ghUser, repos, langMap),
            ...parsed,
          });
          return;
        } catch (_e) {}
      }
      setData(getDefaultResumeData(student, ghUser, repos, langMap));
    } else {
      setIsFullscreen(false);
    }
  }, [open, student, ghUser, repos, langMap]);

  // Handle field change helper
  const updateField = <K extends keyof ResumeData>(key: K, val: ResumeData[K]) => {
    setData((prev) => ({ ...prev, [key]: val }));
  };

  const updateSkills = (key: keyof ResumeData["skills"], val: string) => {
    setData((prev) => ({
      ...prev,
      skills: { ...prev.skills, [key]: val },
    }));
  };

  // Add/remove project
  const addProject = () => {
    const newProj: ResumeProjectItem = {
      id: crypto.randomUUID(),
      name: "New Software Project",
      techStack: "React, TypeScript, Node.js",
      bullets: [
        "Architected scalable web application utilizing modern component architecture.",
        "Integrated dynamic REST APIs and optimized database retrieval performance.",
      ],
    };
    setData((prev) => ({ ...prev, projects: [...prev.projects, newProj] }));
  };

  const updateProject = (idx: number, patch: Partial<ResumeProjectItem>) => {
    setData((prev) => {
      const next = [...prev.projects];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, projects: next };
    });
  };

  const removeProject = (idx: number) => {
    setData((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== idx),
    }));
  };

  // Photo handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (PNG, JPG, WebP).",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (re) => {
      const url = re.target?.result as string;
      if (url) {
        updateField("photoUrl", url);
        toast({
          title: "Photo Attached ✓",
          description: "Your picture is now embedded into your resume.",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUseProfileAvatar = () => {
    const av = student.avatar || ghUser?.avatar_url;
    if (av) {
      updateField("photoUrl", av);
      toast({
        title: "Profile Avatar Loaded ✓",
        description: "Using your TechShastra member profile photo.",
      });
    } else {
      toast({
        title: "No Avatar Found",
        description: "Please upload an image using the upload button.",
      });
    }
  };

  const handleRemovePhoto = () => {
    updateField("photoUrl", "");
    toast({
      title: "Photo Removed",
      description: "Fallback initials will be used.",
    });
  };

  // Save changes locally and to profile
  const handleSave = () => {
    localStorage.setItem(`ts_resume_data_${student.id}`, JSON.stringify(data));
    if (onSaveToProfile) {
      onSaveToProfile({
        bio: data.summary,
        education: data.education,
        experience: data.experience,
      });
    }
    setIsSaved(true);
    toast({
      title: "Resume Data Saved ✓",
      description: "Your edits and chosen template have been preserved.",
    });
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handlePrint = () => {
    printResumeData(data);
  };

  const previewHtml = generateResumeHTML(data, data.templateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={(e) => {
          if (e.key === "Escape" && isFullscreen) {
            e.preventDefault();
            e.stopPropagation();
            setIsFullscreen(false);
          }
        }}
        style={
          isFullscreen
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                transform: "none",
                width: "100vw",
                height: "100vh",
                maxWidth: "100vw",
                maxHeight: "100vh",
                margin: 0,
                borderRadius: 0,
                zIndex: 50,
              }
            : undefined
        }
        className={cn(
          "flex flex-col p-0 overflow-hidden bg-card text-foreground transition-all duration-200 border border-border",
          isFullscreen
            ? "!fixed !top-0 !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !border-0 !m-0 !z-50"
            : "w-[96vw] max-w-5xl h-[92vh] max-h-[890px] rounded-3xl shadow-2xl"
        )}
      >
        {/* Subtle accent bar at top */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/70 to-primary/20 shrink-0" />

        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-card/60 backdrop-blur-md">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0 pr-10 sm:pr-0">
              <DialogTitle className="text-lg sm:text-2xl font-heading font-light tracking-tight flex items-center gap-2 text-foreground truncate">
                <FileText className="w-5 h-5 text-primary shrink-0" /> Professional Resume Builder
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground font-light mt-0.5 truncate">
                3 trending industry templates. Full A4 ATS preview, live edit & instant PDF export.
              </DialogDescription>
            </div>

            {/* Top action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Fullscreen Toggle */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={cn(
                  "h-8 px-2.5 text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs",
                  isFullscreen
                    ? "bg-primary text-primary-foreground border-primary font-semibold hover:bg-primary/90"
                    : "bg-background text-foreground border-border hover:bg-muted/40 font-medium"
                )}
                title={isFullscreen ? "Exit Fullscreen (or press Esc)" : "Open Full Screen"}
              >
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span className="text-[11px] hidden xs:inline">{isFullscreen ? "Exit Fullscreen" : "Full Screen"}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                className="rounded-xl text-xs font-light gap-1.5 h-8 px-3 border-border hover:bg-muted/40"
              >
                {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                <span className="hidden xs:inline">{isSaved ? "Saved" : "Save Draft"}</span>
              </Button>

              <Button
                size="sm"
                onClick={handlePrint}
                className="rounded-xl text-xs font-medium gap-1.5 h-8 px-3.5 bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
              >
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </Button>
            </div>
          </div>

          {/* TEMPLATE PICKER STRIP */}
          <div className="pt-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1 shrink-0 mr-1">
                <Sparkles size={12} className="text-primary" /> Template:
              </span>
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                const isSelected = (data.templateId || "ats-single") === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => updateField("templateId", tmpl.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all shrink-0 border",
                      isSelected
                        ? "bg-primary/10 border-primary text-primary font-medium shadow-xs"
                        : "bg-background/80 border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    <Icon size={13} className={isSelected ? "text-primary" : "text-muted-foreground"} />
                    <span className="font-heading">{tmpl.name}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[9px] px-1.5 py-0 rounded-md font-mono",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {tmpl.badge}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        {/* Tab switch bar */}
        <div className="px-4 sm:px-6 py-2.5 shrink-0 flex items-center justify-between border-b border-border bg-muted/20">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("edit")}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-light tracking-wider transition-all",
                activeTab === "edit"
                  ? "bg-primary text-primary-foreground shadow-sm font-medium"
                  : "hover:bg-foreground/5 text-muted-foreground"
              )}
            >
              Edit Content
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-light tracking-wider transition-all flex items-center gap-1.5",
                activeTab === "preview"
                  ? "bg-primary text-primary-foreground shadow-sm font-medium"
                  : "hover:bg-foreground/5 text-muted-foreground"
              )}
            >
              <Eye className="w-3.5 h-3.5" /> Live Preview
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadLatex(student, ghUser, repos, langMap)}
              className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1"
            >
              <Download size={12} /> Download LaTeX
            </Button>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono hidden md:inline">
              A4 Standard • Ready to Print
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-muted/10">
          {activeTab === "edit" ? (
            <div className="space-y-6 max-w-4xl mx-auto pb-8">

              {/* PHOTO ATTACH SECTION */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Camera size={15} className="text-primary" />
                    <h3 className="text-xs font-heading uppercase tracking-wider text-primary font-semibold">
                      Profile Picture / Photo Attachment
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                    Featured in Photo Card & Modern 2-Col
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                  {/* Photo Preview Circle */}
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/40 bg-muted/40 flex items-center justify-center shrink-0 shadow-sm relative group">
                    {data.photoUrl ? (
                      <img
                        src={data.photoUrl}
                        alt="Resume Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-xl font-heading font-light text-muted-foreground">
                        {data.fullName[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <p className="text-xs text-muted-foreground font-light">
                      Attach a professional photo. It will be seamlessly styled according to the selected template.
                    </p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-xl text-xs h-8 gap-1.5 border-border"
                      >
                        <Upload size={13} /> Upload Image
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleUseProfileAvatar}
                        className="rounded-xl text-xs h-8 gap-1.5 border-border"
                      >
                        <Sparkles size={13} className="text-primary" /> Use Profile Avatar
                      </Button>
                      {data.photoUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleRemovePhoto}
                          className="rounded-xl text-xs h-8 gap-1 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 size={13} /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Info Section */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-xs space-y-4">
                <h3 className="text-xs font-heading uppercase tracking-widest text-primary font-medium">
                  Header & Contact Information
                </h3>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Full Name
                    </label>
                    <Input
                      value={data.fullName}
                      onChange={(e) => updateField("fullName", e.target.value)}
                      placeholder="Your Full Name"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Professional Headline
                    </label>
                    <Input
                      value={data.headline}
                      onChange={(e) => updateField("headline", e.target.value)}
                      placeholder="e.g. B.Tech CSE · Software Developer"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Email Address
                    </label>
                    <Input
                      value={data.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="email@example.com"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Phone Number / ID
                    </label>
                    <Input
                      value={data.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="+91 ••••• •••••"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Location
                    </label>
                    <Input
                      value={data.location}
                      onChange={(e) => updateField("location", e.target.value)}
                      placeholder="Dehradun, Uttarakhand, India"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      GitHub Profile
                    </label>
                    <Input
                      value={data.github}
                      onChange={(e) => updateField("github", e.target.value)}
                      placeholder="github.com/username"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      LinkedIn URL
                    </label>
                    <Input
                      value={data.linkedin}
                      onChange={(e) => updateField("linkedin", e.target.value)}
                      placeholder="linkedin.com/in/username"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Portfolio / Website
                    </label>
                    <Input
                      value={data.portfolio}
                      onChange={(e) => updateField("portfolio", e.target.value)}
                      placeholder="yourportfolio.live"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Summary Section */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-heading uppercase tracking-widest text-primary font-medium">
                    Professional Summary
                  </h3>
                  <span className="text-[10px] text-muted-foreground">2-3 impactful sentences</span>
                </div>
                <Textarea
                  value={data.summary}
                  onChange={(e) => updateField("summary", e.target.value)}
                  rows={3}
                  className="text-xs rounded-xl border-border bg-background resize-none leading-relaxed"
                  placeholder="Summarize your engineering background, top skills, and impact..."
                />
              </div>

              {/* Technical Skills Section */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-xs space-y-3.5">
                <h3 className="text-xs font-heading uppercase tracking-widest text-primary font-medium">
                  Technical Skills (Categorized)
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Programming Languages
                    </label>
                    <Input
                      value={data.skills.languages}
                      onChange={(e) => updateSkills("languages", e.target.value)}
                      placeholder="JavaScript, TypeScript, Python, C++, Java, SQL"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Frameworks & Libraries
                    </label>
                    <Input
                      value={data.skills.frameworks}
                      onChange={(e) => updateSkills("frameworks", e.target.value)}
                      placeholder="React, Next.js, Node.js, Express, Tailwind CSS"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Developer Tools & Cloud
                    </label>
                    <Input
                      value={data.skills.developerTools}
                      onChange={(e) => updateSkills("developerTools", e.target.value)}
                      placeholder="Git, GitHub, Docker, Supabase, Linux, Postman, Vercel"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Core Concepts & Architecture
                    </label>
                    <Input
                      value={data.skills.coreConcepts}
                      onChange={(e) => updateSkills("coreConcepts", e.target.value)}
                      placeholder="Data Structures & Algorithms, RESTful APIs, System Design, OOP"
                      className="text-xs h-9 rounded-xl border-border bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Featured Projects Section */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-heading uppercase tracking-widest text-primary font-medium">
                    Featured Software Projects
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addProject}
                    className="rounded-xl text-xs h-7 gap-1 px-2.5 font-light border-border"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Project
                  </Button>
                </div>

                <div className="space-y-4">
                  {data.projects.map((proj, pIdx) => (
                    <div
                      key={proj.id || pIdx}
                      className="p-4 rounded-xl bg-background/70 border border-border space-y-3 relative group"
                    >
                      <button
                        type="button"
                        onClick={() => removeProject(pIdx)}
                        className="absolute top-3 right-3 text-destructive/60 hover:text-destructive transition-colors text-xs flex items-center gap-1"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="grid sm:grid-cols-2 gap-3 pr-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                            Project Title
                          </label>
                          <Input
                            value={proj.name}
                            onChange={(e) => updateProject(pIdx, { name: e.target.value })}
                            placeholder="e.g. TechShastra Hub"
                            className="text-xs h-8 rounded-lg border-border bg-card"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                            Tech Stack
                          </label>
                          <Input
                            value={proj.techStack}
                            onChange={(e) => updateProject(pIdx, { techStack: e.target.value })}
                            placeholder="React, TypeScript, Tailwind"
                            className="text-xs h-8 rounded-lg border-border bg-card"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                          Bullet Points (One per line)
                        </label>
                        <Textarea
                          value={proj.bullets.join("\n")}
                          onChange={(e) =>
                            updateProject(pIdx, {
                              bullets: e.target.value.split("\n"),
                            })
                          }
                          rows={2}
                          className="text-xs rounded-lg border-border bg-card resize-none font-sans leading-relaxed"
                          placeholder="Key feature, architecture decision, or performance impact..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education Section */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-xs space-y-3">
                <h3 className="text-xs font-heading uppercase tracking-widest text-primary font-medium">
                  Education
                </h3>
                {data.education.map((ed, edIdx) => (
                  <div key={ed.id || edIdx} className="grid sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                        Institution
                      </label>
                      <Input
                        value={ed.institution}
                        onChange={(e) => {
                          const next = [...data.education];
                          next[edIdx].institution = e.target.value;
                          setData((prev) => ({ ...prev, education: next }));
                        }}
                        className="text-xs h-8 rounded-lg border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                        Years
                      </label>
                      <Input
                        value={`${ed.startYear} – ${ed.endYear}`}
                        onChange={(e) => {
                          const [s, end] = e.target.value.split("–").map((p) => p.trim());
                          const next = [...data.education];
                          next[edIdx].startYear = s || "";
                          next[edIdx].endYear = end || "";
                          setData((prev) => ({ ...prev, education: next }));
                        }}
                        className="text-xs h-8 rounded-lg border-border bg-background"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Live Preview Tab */
            <div className="w-full flex flex-col items-center py-2 pb-6 px-1 sm:px-4">
              <div className="w-full max-w-[210mm] flex items-center justify-between pb-3 px-1 text-xs">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Preview: <strong className="text-foreground capitalize">{data.templateId || "ats-single"}</strong>
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Scale: 100% (A4 Aspect Ratio)
                </span>
              </div>
              <div className="w-full max-w-[210mm] bg-white rounded-2xl shadow-2xl overflow-hidden border border-border">
                <iframe
                  title="Resume Live Preview"
                  srcDoc={previewHtml}
                  className="w-full h-[650px] sm:h-[800px] border-none bg-white"
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
