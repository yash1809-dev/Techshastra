/**
 * RoleApplicationModal.tsx
 *
 * Fullscreen, mobile-optimized modal allowing students to apply for
 * TechShastra organizational hierarchy roles based on academic year eligibility.
 */

import React, { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Users,
  Compass,
  ArrowRight,
  Code2,
  Palette,
  Calendar,
  Share2,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  ROLE_DEFINITIONS,
  WING_METADATA,
  type HierarchyRole,
  type FunctionalWing,
  submitRoleApplication,
} from "@/lib/services/hierarchyService";

interface Props {
  open: boolean;
  onClose: () => void;
  student: any;
}

export const RoleApplicationModal: React.FC<Props> = ({ open, onClose, student }) => {
  const { toast } = useToast();

  // Normalize student year (e.g. "1st Year", "2nd Year", "3rd Year", "4th Year")
  const studentYear = useMemo(() => {
    const raw = (student?.year || student?.academicYear || "1st Year").toString().toLowerCase();
    if (raw.includes("1") || raw.includes("first")) return "1st Year";
    if (raw.includes("2") || raw.includes("second")) return "2nd Year";
    if (raw.includes("3") || raw.includes("third")) return "3rd Year";
    if (raw.includes("4") || raw.includes("fourth")) return "4th Year";
    return "1st Year";
  }, [student]);

  // Year-based rules:
  // 1st Year: strictly Volunteer only (higher tiers disabled)
  // 2nd Year: can apply up to Vice President & Functional Heads / Co-Heads
  // 3rd Year: can apply for Vice President & Functional Heads
  const isFirstYear = studentYear === "1st Year";

  // Form State
  const [selectedRole, setSelectedRole] = useState<HierarchyRole>(
    isFirstYear ? "volunteer" : "functional_head"
  );
  const [selectedWing, setSelectedWing] = useState<FunctionalWing>("technical");
  const [statement, setStatement] = useState("");
  const [skillsText, setSkillsText] = useState(
    Array.isArray(student?.skills) ? student.skills.join(", ") : ""
  );
  const [portfolioUrl, setPortfolioUrl] = useState(student?.portfolioUrl || "");
  const [submitting, setSubmitting] = useState(false);

  // If 1st year, lock role to volunteer
  const currentRole: HierarchyRole = isFirstYear ? "volunteer" : selectedRole;
  const requiresWing = ROLE_DEFINITIONS[currentRole].requiresWing;

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!statement.trim() || statement.trim().length < 20) {
      toast({
        title: "Statement too brief",
        description: "Please share at least 2-3 sentences explaining your motivation and relevant skills.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const skillsArray = skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await submitRoleApplication({
        studentId: student?.id || student?.githubUsername || "student",
        studentName: student?.name || student?.username || "Club Member",
        studentEmail: student?.email || "",
        githubUsername: student?.githubUsername || student?.username || "",
        avatar: student?.avatar || student?.avatar_url || "",
        academicYear: studentYear,
        course: student?.course || "B.Tech",
        appliedRole: currentRole,
        appliedWing: requiresWing ? selectedWing : undefined,
        statement: statement.trim(),
        skills: skillsArray,
        portfolioUrl: portfolioUrl.trim() || undefined,
      });

      toast({
        title: "Application Submitted Successfully! 🚀",
        description: `Your application for ${ROLE_DEFINITIONS[currentRole].title} has been routed to the Super Admin and President for review.`,
      });

      onClose();
    } catch (err: any) {
      toast({
        title: "Submission Error",
        description: err.message || "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const wingIcons: Record<FunctionalWing, any> = {
    technical: Code2,
    design_web: Palette,
    logistics_events: Calendar,
    content_social: Share2,
    community: HeartHandshake,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl flex flex-col bg-card/95 border-0 sm:border border-border/80 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-heading font-medium text-foreground tracking-wide">
                Apply for Leadership or Volunteer Role
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">Logged in as: {student?.name || "Member"}</span>
                <Badge variant="outline" className="text-[10px] py-0 px-2 border-primary/30 text-primary">
                  {studentYear}
                </Badge>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 sm:py-6 space-y-6">
          
          {/* Eligibility Notice Banner */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
            <Sparkles size={18} className="text-primary shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-foreground/80">
              {isFirstYear ? (
                <>
                  <strong className="text-primary font-medium">1st Year Entry:</strong> As a 1st Year member, you are invited to join our functional wings as a{" "}
                  <strong>Club Volunteer / Team Member</strong>. Select the wing you wish to contribute to below.
                </>
              ) : (
                <>
                  <strong className="text-primary font-medium">{studentYear} Core Succession:</strong> You are eligible to apply for{" "}
                  <strong>Vice President</strong>, <strong>Functional Head</strong>, or <strong>Co-Head</strong> across our 5 specialized wings.
                </>
              )}
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              1. Select Designation
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Vice President (Eligible: 2nd & 3rd Year) */}
              <button
                type="button"
                disabled={isFirstYear}
                onClick={() => setSelectedRole("vice_president")}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  isFirstYear
                    ? "opacity-40 cursor-not-allowed border-border/40 bg-muted/20"
                    : currentRole === "vice_president"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border hover:border-border/80 bg-background/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs sm:text-sm text-foreground">Vice President</span>
                  <Badge variant="outline" className="text-[9px] border-border">
                    Tier 1 · Executive
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  Operations oversight and club-wide strategic leadership.
                </p>
                {isFirstYear && (
                  <span className="text-[10px] text-amber-500/90 mt-1 block font-medium">
                    Restricted to 2nd & 3rd Year
                  </span>
                )}
              </button>

              {/* Functional Head (Eligible: 2nd & 3rd Year) */}
              <button
                type="button"
                disabled={isFirstYear}
                onClick={() => setSelectedRole("functional_head")}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  isFirstYear
                    ? "opacity-40 cursor-not-allowed border-border/40 bg-muted/20"
                    : currentRole === "functional_head"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border hover:border-border/80 bg-background/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs sm:text-sm text-foreground">Functional Head</span>
                  <Badge variant="outline" className="text-[9px] border-border">
                    Tier 2 · Department Lead
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  Lead a functional wing (Technical, Design, Events, etc.).
                </p>
                {isFirstYear && (
                  <span className="text-[10px] text-amber-500/90 mt-1 block font-medium">
                    Restricted to 2nd & 3rd Year
                  </span>
                )}
              </button>

              {/* Functional Co-Head (Eligible: 2nd & 3rd Year) */}
              <button
                type="button"
                disabled={isFirstYear}
                onClick={() => setSelectedRole("functional_co_head")}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  isFirstYear
                    ? "opacity-40 cursor-not-allowed border-border/40 bg-muted/20"
                    : currentRole === "functional_co_head"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border hover:border-border/80 bg-background/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs sm:text-sm text-foreground">Functional Co-Head</span>
                  <Badge variant="outline" className="text-[9px] border-border">
                    Tier 2 · Department Co-Lead
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  Co-orchestrate wing execution and mentor student volunteers.
                </p>
              </button>

              {/* Club Volunteer (Open to 1st & 2nd Year) */}
              <button
                type="button"
                onClick={() => setSelectedRole("volunteer")}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  currentRole === "volunteer"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border hover:border-border/80 bg-background/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs sm:text-sm text-foreground">Club Volunteer / Member</span>
                  <Badge variant="outline" className="text-[9px] border-border">
                    Tier 3 · Wing Member
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  Hands-on contributor under a designated functional head.
                </p>
              </button>
            </div>
          </div>

          {/* Wing Selection (if applicable) */}
          {requiresWing && (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                2. Choose Department / Wing
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {(Object.keys(WING_METADATA) as FunctionalWing[]).map((wing) => {
                  const meta = WING_METADATA[wing];
                  const Icon = wingIcons[wing] || Users;
                  const isSelected = selectedWing === wing;
                  return (
                    <button
                      key={wing}
                      type="button"
                      onClick={() => setSelectedWing(wing)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border hover:border-border/80 bg-background/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`p-1.5 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          <Icon size={14} />
                        </div>
                        <span className="text-xs font-medium text-foreground">{meta.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Statement of Interest */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              3. Why are you interested in this role? *
            </label>
            <Textarea
              rows={4}
              required
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Describe your background, prior contributions, event/leadership experience, and what you aim to achieve in this role..."
              className="text-xs sm:text-sm rounded-2xl border-border bg-card/60 resize-none leading-relaxed"
            />
          </div>

          {/* Skills & Portfolio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Relevant Skills (comma separated)
              </label>
              <Input
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="e.g. React, Event Coordination, Figma, Video Editing"
                className="h-9 text-xs rounded-xl border-border bg-card"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Portfolio / GitHub / Work Links
              </label>
              <Input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://github.com/username or portfolio URL"
                className="h-9 text-xs rounded-xl border-border bg-card"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-border/60 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl text-xs h-9 px-4 border-border"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-xl text-xs h-9 px-6 bg-primary text-primary-foreground font-medium gap-2 shadow-sm shadow-primary/20 hover:bg-primary/90"
            >
              {submitting ? "Submitting..." : "Submit Application"}
              <ArrowRight size={14} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
