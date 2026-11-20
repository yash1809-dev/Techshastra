/**
 * RoleApplicationModal.tsx
 *
 * Fullscreen, mobile-optimized modal allowing students to apply for
 * TechShastra organizational hierarchy roles based on academic year eligibility
 * and real-time position vacancy.
 *
 * Eligibility Rules:
 * - 4th & 3rd Year: Eligible for President, Vice President, General Secretary, Treasurer,
 *   Functional Heads, Co-Heads, and Volunteer roles.
 * - 2nd Year: Eligible for Vice President, Functional Heads, Co-Heads, and Volunteer roles.
 * - 1st Year: Eligible strictly for Club Volunteer across any functional wing.
 * - Dynamic Vacancy Gating: Once a leadership position (President, VP, Sec, Treasurer,
 *   or specific Wing Head/Co-Head) is promoted, it is greyed out with the appointed holder's
 *   name until opened again.
 * - Club Volunteer remains permanently open for all students across all years under any wing.
 */

import React, { useState, useMemo, useEffect } from "react";
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
  Crown,
  Lock,
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
  type PromotedMember,
  submitRoleApplication,
  getPromotedMembers,
} from "@/lib/services/hierarchyService";

interface Props {
  open: boolean;
  onClose: () => void;
  student: any;
}

export const RoleApplicationModal: React.FC<Props> = ({ open, onClose, student }) => {
  const { toast } = useToast();

  // Real-time promoted members state
  const [promotedMembers, setPromotedMembers] = useState<PromotedMember[]>([]);

  useEffect(() => {
    const load = () => {
      setPromotedMembers(getPromotedMembers());
    };
    load();
    window.addEventListener("ts_hierarchy_updated", load);
    return () => window.removeEventListener("ts_hierarchy_updated", load);
  }, []);

  // Normalize student academic year
  const studentYear = useMemo(() => {
    const raw = (student?.year || student?.academicYear || "1st Year").toString().toLowerCase();
    if (raw.includes("1") || raw.includes("first")) return "1st Year";
    if (raw.includes("2") || raw.includes("second")) return "2nd Year";
    if (raw.includes("3") || raw.includes("third")) return "3rd Year";
    if (raw.includes("4") || raw.includes("fourth")) return "4th Year";
    return "1st Year";
  }, [student]);

  // Year breakdown:
  // 1st Year: strictly Volunteer only (higher tiers locked)
  // 2nd Year: can apply up to Vice President & Functional Heads / Co-Heads
  // 3rd & 4th Year: eligible for President, all Tier 1 roles & Functional Heads
  const isFirstYear = studentYear === "1st Year";
  const isSecondYear = studentYear === "2nd Year";
  const isSenior = studentYear === "3rd Year" || studentYear === "4th Year";

  // Check whether student is academically eligible for a specific role
  const isYearEligible = (role: HierarchyRole): boolean => {
    if (role === "volunteer") return true; // Open to all years
    if (isFirstYear) return false;
    if (role === "president" || role === "general_secretary" || role === "treasurer") {
      return isSenior; // Strictly 3rd & 4th Year
    }
    // Vice President, functional_head, functional_co_head: 2nd, 3rd, 4th Year
    return isSecondYear || isSenior;
  };

  // Check whether role is currently occupied by a promoted member
  const getRoleOccupancy = (role: HierarchyRole, wing?: FunctionalWing): { occupied: boolean; holderName: string | null } => {
    if (role === "volunteer") {
      return { occupied: false, holderName: null };
    }
    if (role === "president" || role === "vice_president" || role === "general_secretary" || role === "treasurer") {
      const holder = promotedMembers.find((m) => m.role === role);
      return { occupied: !!holder, holderName: holder ? holder.name : null };
    }
    if (role === "functional_head" || role === "functional_co_head") {
      if (wing) {
        const holder = promotedMembers.find((m) => m.role === role && m.wing === wing);
        return { occupied: !!holder, holderName: holder ? holder.name : null };
      }
      // If no wing passed, check if all 5 wings have this head/co-head filled
      const allWings: FunctionalWing[] = ["logistics_events", "design_web", "technical", "content_social", "community"];
      const allTaken = allWings.every((w) => promotedMembers.some((m) => m.role === role && m.wing === w));
      return { occupied: allTaken, holderName: null };
    }
    return { occupied: false, holderName: null };
  };

  // Initial role selection prioritizing an open role
  const initialRole: HierarchyRole = useMemo(() => {
    if (isFirstYear) return "volunteer";
    if (isSenior) {
      if (!getRoleOccupancy("president").occupied) return "president";
      if (!getRoleOccupancy("vice_president").occupied) return "vice_president";
      if (!getRoleOccupancy("general_secretary").occupied) return "general_secretary";
      if (!getRoleOccupancy("treasurer").occupied) return "treasurer";
    }
    if (!getRoleOccupancy("vice_president").occupied && !isFirstYear) return "vice_president";
    if (!getRoleOccupancy("functional_head").occupied && !isFirstYear) return "functional_head";
    return "volunteer";
  }, [isFirstYear, isSenior, promotedMembers]);

  // Form State
  const [selectedRole, setSelectedRole] = useState<HierarchyRole>(initialRole);
  const [selectedWing, setSelectedWing] = useState<FunctionalWing>("technical");
  const [statement, setStatement] = useState("");
  const [skillsText, setSkillsText] = useState(
    Array.isArray(student?.skills) ? student.skills.join(", ") : ""
  );
  const [portfolioUrl, setPortfolioUrl] = useState(student?.portfolioUrl || "");
  const [submitting, setSubmitting] = useState(false);

  // If 1st year, strictly force volunteer
  const currentRole: HierarchyRole = isFirstYear ? "volunteer" : selectedRole;
  const requiresWing = ROLE_DEFINITIONS[currentRole].requiresWing;

  // Auto-switch selected wing if currently selected wing head position is filled
  useEffect(() => {
    if (currentRole === "functional_head" || currentRole === "functional_co_head") {
      const isWingOccupied = getRoleOccupancy(currentRole, selectedWing).occupied;
      if (isWingOccupied) {
        const allWings: FunctionalWing[] = ["technical", "design_web", "logistics_events", "content_social", "community"];
        const freeWing = allWings.find((w) => !getRoleOccupancy(currentRole, w).occupied);
        if (freeWing) {
          setSelectedWing(freeWing);
        }
      }
    }
  }, [currentRole, selectedWing, promotedMembers]);

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

    // Guard against applying for occupied role
    if (currentRole !== "volunteer") {
      const check = getRoleOccupancy(currentRole, requiresWing ? selectedWing : undefined);
      if (check.occupied) {
        toast({
          title: "Position Currently Filled",
          description: `The position of ${ROLE_DEFINITIONS[currentRole].title} is already filled by ${check.holderName || "an appointed member"}. Please choose an open position or apply as a Volunteer.`,
          variant: "destructive",
        });
        return;
      }
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

  // Helper for role button
  const renderRoleButton = (
    role: HierarchyRole,
    tierLabel: string,
    tagline: string
  ) => {
    const roleDef = ROLE_DEFINITIONS[role];
    const eligible = isYearEligible(role);
    const occupancy = getRoleOccupancy(role, requiresWing && currentRole === role ? selectedWing : undefined);
    const isOccupied = occupancy.occupied;
    const isSelected = currentRole === role;

    const isDisabled = !eligible || isOccupied;

    let reasonText = "";
    if (isOccupied) {
      reasonText = occupancy.holderName ? `Filled by ${occupancy.holderName}` : "Position Filled";
    } else if (!eligible) {
      if (role === "president" || role === "general_secretary" || role === "treasurer") {
        reasonText = "Restricted to 3rd & 4th Year";
      } else {
        reasonText = "Restricted to 2nd, 3rd & 4th Year";
      }
    }

    return (
      <button
        key={role}
        type="button"
        disabled={isDisabled}
        onClick={() => setSelectedRole(role)}
        className={`p-3.5 rounded-2xl text-left border transition-all relative ${
          isDisabled
            ? "opacity-50 cursor-not-allowed border-border/40 bg-muted/30"
            : isSelected
            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
            : "border-border hover:border-border/80 bg-background/50 hover:bg-muted/10"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`font-medium text-xs sm:text-sm ${isDisabled ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {roleDef.title}
          </span>
          <Badge
            variant="outline"
            className={`text-[9px] ${
              isOccupied
                ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
                : !eligible
                ? "border-muted-foreground/30 text-muted-foreground"
                : isSelected
                ? "border-primary text-primary"
                : "border-border text-foreground/70"
            }`}
          >
            {isOccupied ? "Occupied" : tierLabel}
          </Badge>
        </div>

        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {tagline}
        </p>

        {/* Status indicators */}
        {isDisabled && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium">
            {isOccupied ? (
              <span className="text-amber-500 flex items-center gap-1">
                <Lock size={11} /> {reasonText}
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1">
                <AlertCircle size={11} /> {reasonText}
              </span>
            )}
          </div>
        )}

        {!isDisabled && isSelected && (
          <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-primary">
            <CheckCircle2 size={12} /> Selected for Application
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl flex flex-col bg-card/95 border-0 sm:border border-border/80 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Crown size={20} />
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
                  <strong>Club Volunteer / Team Member</strong>. Higher leadership tiers unlock from 2nd Year onward.
                </>
              ) : isSecondYear ? (
                <>
                  <strong className="text-primary font-medium">2nd Year Progression:</strong> You are eligible to apply for{" "}
                  <strong>Vice President</strong>, <strong>Functional Heads</strong>, <strong>Co-Heads</strong>, or as a <strong>Volunteer</strong> across any wing.
                </>
              ) : (
                <>
                  <strong className="text-primary font-medium">{studentYear} Core Leadership:</strong> You are eligible for{" "}
                  <strong>President</strong>, <strong>all Executive Board roles (VP, General Secretary, Treasurer)</strong>, as well as <strong>Functional Heads</strong> and <strong>Volunteers</strong>.
                </>
              )}
              <span className="block mt-1 text-[11px] text-muted-foreground">
                Positions already filled by an appointed member are greyed out until reopened. <strong>Club Volunteer</strong> is open for all years across every wing.
              </span>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-4">
            
            {/* ── Tier 1: Executive Board ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Crown size={13} className="text-amber-500" /> Tier 1: Executive Board (3rd & 4th Year)
                </label>
                <span className="text-[10px] text-muted-foreground">Core Strategy & Approvals</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {renderRoleButton(
                  "president",
                  "Tier 1 · President",
                  "Overall leadership, institutional representation, and final decision-making."
                )}
                {renderRoleButton(
                  "vice_president",
                  "Tier 1 · VP",
                  "Operations oversight, executive continuity, and wing alignment."
                )}
                {renderRoleButton(
                  "general_secretary",
                  "Tier 1 · Secretary",
                  "Governance, documentation, institutional records, and administrative coordination."
                )}
                {renderRoleButton(
                  "treasurer",
                  "Tier 1 · Treasurer",
                  "Budgeting, accounts, sponsorship management, and financial planning."
                )}
              </div>
            </div>

            {/* ── Tier 2: Functional Wings Leadership ── */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Briefcase size={13} className="text-blue-500" /> Tier 2: Functional Heads (2nd, 3rd & 4th Year)
                </label>
                <span className="text-[10px] text-muted-foreground">Appointed per Wing</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {renderRoleButton(
                  "functional_head",
                  "Tier 2 · Head",
                  "Lead departmental operations, technical workshops, hackathons, or design sprints."
                )}
                {renderRoleButton(
                  "functional_co_head",
                  "Tier 2 · Co-Head",
                  "Support wing operations, task execution, and coordinate volunteer teams."
                )}
              </div>
            </div>

            {/* ── Tier 3: Volunteers & Team Members ── */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users size={13} className="text-emerald-500" /> Tier 3: Volunteers & Team Members (All Years)
                </label>
              </div>
              <div>
                {renderRoleButton(
                  "volunteer",
                  "Tier 3 · Member",
                  "Hands-on contributor under a designated functional head. Open entry for all students with exploration across multiple wings."
                )}
              </div>
            </div>

          </div>

          {/* Wing Selection (if applicable) */}
          {requiresWing && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  2. Choose Functional Wing
                </label>
                <span className="text-[10px] text-muted-foreground">Select department to join</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {(Object.keys(WING_METADATA) as FunctionalWing[]).map((wing) => {
                  const meta = WING_METADATA[wing];
                  const Icon = wingIcons[wing] || Users;
                  const isSelected = selectedWing === wing;

                  // Check if head/co-head position in this wing is already filled
                  const isWingFilled = currentRole !== "volunteer" && getRoleOccupancy(currentRole, wing).occupied;
                  const holderName = isWingFilled ? getRoleOccupancy(currentRole, wing).holderName : null;

                  return (
                    <button
                      key={wing}
                      type="button"
                      disabled={isWingFilled}
                      onClick={() => setSelectedWing(wing)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isWingFilled
                          ? "opacity-40 cursor-not-allowed border-border/40 bg-muted/20"
                          : isSelected
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                          : "border-border hover:border-border/80 bg-background/50 hover:bg-muted/10"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                              <Icon size={14} />
                            </div>
                            <span className="text-xs font-medium text-foreground">{meta.label}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {meta.description}
                        </p>
                      </div>

                      {isWingFilled ? (
                        <div className="mt-2 text-[10px] text-amber-500 font-medium flex items-center gap-1">
                          <Lock size={10} /> {holderName ? `Filled by ${holderName}` : "Position Appointed"}
                        </div>
                      ) : isSelected ? (
                        <div className="mt-2 text-[10px] text-primary font-semibold flex items-center gap-1">
                          <CheckCircle2 size={11} /> Selected Wing
                        </div>
                      ) : null}
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
