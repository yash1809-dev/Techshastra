/**
 * hierarchyService.ts
 * 
 * Manages TechShastra's organizational hierarchy, role applications,
 * promotion workflows, and unique admin access keys.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { getStoredCredentials, createAdminCredential, deleteAdminCredential, type AdminRole } from "@/lib/adminStore";
import { getAllStudents } from "@/lib/studentStore";

// ─── HIERARCHY DEFINITION ───────────────────────────────────────────────────

export type TierLevel = 1 | 2 | 3;

export type FunctionalWing =
  | "logistics_events"
  | "design_web"
  | "technical"
  | "content_social"
  | "community";

export const WING_METADATA: Record<FunctionalWing, { label: string; description: string }> = {
  logistics_events: {
    label: "Logistics & Events",
    description: "Venue booking, equipment coordination, hackathons and workshop operations.",
  },
  design_web: {
    label: "Design & Website Management",
    description: "Visual branding, posters, UI/UX design, maintaining and updating the club website.",
  },
  technical: {
    label: "Technical",
    description: "Organizing coding workshops, hackathons, leading hardware & software projects.",
  },
  content_social: {
    label: "Content & Social Media",
    description: "Copywriting, reels, photography, newsletters, and social channels management.",
  },
  community: {
    label: "Community Management",
    description: "Member onboarding, WhatsApp/Discord management, and active community engagement.",
  },
};

export type HierarchyRole =
  | "president"
  | "vice_president"
  | "general_secretary"
  | "treasurer"
  | "functional_head"
  | "functional_co_head"
  | "volunteer";

export interface RoleDefinition {
  id: HierarchyRole;
  title: string;
  tier: TierLevel;
  eligibleYears: string[]; // e.g. ["3rd Year", "2nd Year"]
  requiresWing: boolean;
  isOpenForApplication: boolean;
  description: string;
}

export const ROLE_DEFINITIONS: Record<HierarchyRole, RoleDefinition> = {
  president: {
    id: "president",
    title: "President",
    tier: 1,
    eligibleYears: ["3rd Year", "4th Year"],
    requiresWing: false,
    isOpenForApplication: true, // Opened for 3rd & 4th year applicants
    description: "Overall leadership, external representation, and strategic direction of TechShastra.",
  },
  vice_president: {
    id: "vice_president",
    title: "Vice President",
    tier: 1,
    eligibleYears: ["2nd Year", "3rd Year", "4th Year"],
    requiresWing: false,
    isOpenForApplication: true,
    description: "Operations oversight, executive alignment, and leadership continuity.",
  },
  general_secretary: {
    id: "general_secretary",
    title: "General Secretary",
    tier: 1,
    eligibleYears: ["3rd Year", "4th Year"],
    requiresWing: false,
    isOpenForApplication: true, // Opened for 3rd & 4th year applicants (multiple positions available)
    description: "Documentation, governance, administrative coordination, and records. Open for multiple appointments.",
  },
  treasurer: {
    id: "treasurer",
    title: "Treasurer",
    tier: 1,
    eligibleYears: ["3rd Year", "4th Year"],
    requiresWing: false,
    isOpenForApplication: true, // Opened for 3rd & 4th year applicants (multiple positions available)
    description: "Budgeting, financial accounts, allocations, and sponsorship management. Open for multiple appointments.",
  },
  functional_head: {
    id: "functional_head",
    title: "Functional Head",
    tier: 2,
    eligibleYears: ["2nd Year", "3rd Year", "4th Year"],
    requiresWing: true,
    isOpenForApplication: true,
    description: "Lead departmental operations, project deliverables, and team leadership.",
  },
  functional_co_head: {
    id: "functional_co_head",
    title: "Functional Co-Head",
    tier: 2,
    eligibleYears: ["2nd Year", "3rd Year", "4th Year"],
    requiresWing: true,
    isOpenForApplication: true,
    description: "Support department head and coordinate volunteer execution.",
  },
  volunteer: {
    id: "volunteer",
    title: "Club Volunteer / Team Member",
    tier: 3,
    eligibleYears: ["1st Year", "2nd Year", "3rd Year", "4th Year"], // Open for all students under any wing
    requiresWing: true,
    isOpenForApplication: true,
    description: "Hands-on contribution within wings, event support, and domain exploration.",
  },
};

// ─── ROLE APPLICATION DATA STRUCTURE ────────────────────────────────────────

export interface RoleApplication {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  githubUsername: string;
  avatar?: string;
  academicYear: string; // e.g. "1st Year", "2nd Year"
  course?: string;
  appliedRole: HierarchyRole;
  appliedWing?: FunctionalWing;
  statement: string;
  skills?: string[];
  portfolioUrl?: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  created_at: string;
  updated_at?: string;
}

// ─── PROMOTED APPOINTMENT ───────────────────────────────────────────────────

export interface PromotedMember {
  id: string; // studentId or githubUsername
  studentId: string;
  name: string;
  email: string;
  githubUsername: string;
  avatar?: string;
  academicYear: string;
  course?: string;
  role: HierarchyRole;
  roleTitle: string;
  tier: TierLevel;
  wing?: FunctionalWing;
  hasAdminKey?: boolean;
  /** Obfuscated key stored for cross-device synchronization */
  adminKey?: string;
  promotedBy: string;
  promotedAt: string;
}

// ─── LOCAL STORAGE KEYS ─────────────────────────────────────────────────────

const APPLICATIONS_KEY = "ts_role_applications";
const PROMOTED_MEMBERS_KEY = "ts_promoted_members";
// Admin keys are stored SEPARATELY and obfuscated — never inside the member blob
const ADMIN_KEYS_VAULT = "ts_akv";

// ─── KEY VAULT HELPERS ───────────────────────────────────────────────────────
// Simple XOR-obfuscation so keys don't sit as plain-text strings in DevTools.
// This is a deterrent, NOT encryption — real security comes from server-side
// session validation (Supabase RPC + admin_sessions table).

const _SALT = "TSxClubxSalt2026";
const _xorObfuscate = (text: string): string => {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ _SALT.charCodeAt(i % _SALT.length));
  }
  return btoa(out); // base64 encode the XOR'd bytes
};
const _xorDeobfuscate = (encoded: string): string => {
  try {
    const raw = atob(encoded);
    let out = "";
    for (let i = 0; i < raw.length; i++) {
      out += String.fromCharCode(raw.charCodeAt(i) ^ _SALT.charCodeAt(i % _SALT.length));
    }
    return out;
  } catch {
    return "";
  }
};

/** Read the vault: { [identifier]: { key, generatedAt } } */
const _readVault = (): Record<string, { key: string; generatedAt: string }> => {
  try {
    const raw = localStorage.getItem(ADMIN_KEYS_VAULT);
    if (!raw) return {};
    return JSON.parse(_xorDeobfuscate(raw)) || {};
  } catch { return {}; }
};

/** Save a key into the vault for an identifier (studentId or githubUsername). */
const _vaultSet = (identifier: string, key: string): void => {
  const vault = _readVault();
  vault[identifier] = { key, generatedAt: new Date().toISOString() };
  localStorage.setItem(ADMIN_KEYS_VAULT, _xorObfuscate(JSON.stringify(vault)));
};

/** Retrieve a key from the vault, or undefined. */
const _vaultGet = (identifier: string): { key: string; generatedAt: string } | undefined => {
  return _readVault()[identifier];
};

/** Delete a key from the vault (on demotion). */
const _vaultDelete = (identifier: string): void => {
  const vault = _readVault();
  delete vault[identifier];
  localStorage.setItem(ADMIN_KEYS_VAULT, _xorObfuscate(JSON.stringify(vault)));
};

// ─── ROLE APPLICATION METHODS ───────────────────────────────────────────────

export const getRoleApplications = (): RoleApplication[] => {
  try {
    const raw = localStorage.getItem(APPLICATIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

/**
 * Checks a user's active application and leadership standing.
 * Ensures cross-platform single-application integrity:
 * - If user is already an active appointed leader, returns isLeader = true.
 * - If user has an existing application with status = "pending", returns activeApp.
 * - If user's latest application was "rejected", returns rejectedApp (eligible to reapply).
 */
export const getUserApplicationStatus = async (user: {
  studentId?: string;
  githubUsername?: string;
  email?: string;
}): Promise<{
  activeApp: RoleApplication | null;
  rejectedApp: RoleApplication | null;
  isLeader: boolean;
  leaderRole?: string;
}> => {
  const sId = user.studentId?.trim();
  const gh = user.githubUsername?.trim().toLowerCase();
  const em = user.email?.trim().toLowerCase();

  // 1. Check if user is already an active appointed leader
  if (isSupabaseConfigured() && supabase) {
    try {
      const orConditions: string[] = [];
      if (sId) orConditions.push(`student_id.eq.${sId}`, `id.eq.${sId}`);
      if (gh) orConditions.push(`github_username.ilike.${gh}`);
      if (em) orConditions.push(`email.ilike.${em}`);

      if (orConditions.length > 0) {
        const { data: leaderData } = await (supabase
          .from("promoted_members" as any)
          .select("role_title, role")
          .eq("is_active", true)
          .or(orConditions.join(","))
          .maybeSingle() as any);

        if (leaderData) {
          return {
            activeApp: null,
            rejectedApp: null,
            isLeader: true,
            leaderRole: leaderData.role_title || leaderData.role,
          };
        }
      }
    } catch (_err) {}
  }

  // Fallback to local promoted members check
  const localPromoted = getPromotedMembers();
  const localLeader = localPromoted.find((m) => {
    return (
      (sId && (m.studentId === sId || m.id === sId)) ||
      (gh && m.githubUsername.toLowerCase() === gh) ||
      (em && m.email?.toLowerCase() === em)
    );
  });
  if (localLeader) {
    return {
      activeApp: null,
      rejectedApp: null,
      isLeader: true,
      leaderRole: localLeader.roleTitle || localLeader.role,
    };
  }

  // 2. Check user's role applications (Supabase is single source of truth)
  if (isSupabaseConfigured() && supabase) {
    try {
      const orConditions: string[] = [];
      if (sId) orConditions.push(`student_id.eq.${sId}`);
      if (gh) orConditions.push(`github_username.ilike.${gh}`);
      if (em) orConditions.push(`student_email.ilike.${em}`);

      if (orConditions.length > 0) {
        const { data, error } = await (supabase
          .from("role_applications" as any)
          .select("*")
          .or(orConditions.join(","))
          .order("created_at", { ascending: false }) as any);

        if (!error && Array.isArray(data) && data.length > 0) {
          const pending = data.find((d: any) => d.status === "pending");
          if (pending) {
            return {
              activeApp: {
                id: pending.id,
                studentId: pending.student_id,
                studentName: pending.student_name,
                studentEmail: pending.student_email,
                githubUsername: pending.github_username,
                academicYear: pending.academic_year,
                course: pending.course,
                appliedRole: pending.applied_role as HierarchyRole,
                appliedWing: pending.applied_wing as FunctionalWing | undefined,
                statement: pending.statement,
                status: pending.status,
                reviewedBy: pending.reviewed_by,
                reviewedAt: pending.reviewed_at,
                created_at: pending.created_at,
              },
              rejectedApp: null,
              isLeader: false,
            };
          }

          const rejected = data.find((d: any) => d.status === "rejected");
          if (rejected) {
            return {
              activeApp: null,
              rejectedApp: {
                id: rejected.id,
                studentId: rejected.student_id,
                studentName: rejected.student_name,
                studentEmail: rejected.student_email,
                githubUsername: rejected.github_username,
                academicYear: rejected.academic_year,
                course: rejected.course,
                appliedRole: rejected.applied_role as HierarchyRole,
                appliedWing: rejected.applied_wing as FunctionalWing | undefined,
                statement: rejected.statement,
                status: rejected.status,
                reviewedBy: rejected.reviewed_by,
                reviewedAt: rejected.reviewed_at,
                created_at: rejected.created_at,
              },
              isLeader: false,
            };
          }
        }
      }
    } catch (_appErr) {}
  }

  // Fallback to local applications
  const localApps = getRoleApplications();
  const userApps = localApps.filter((a) => {
    return (
      (sId && a.studentId === sId) ||
      (gh && a.githubUsername.toLowerCase() === gh) ||
      (em && a.studentEmail?.toLowerCase() === em)
    );
  });

  const pending = userApps.find((a) => a.status === "pending");
  if (pending) {
    return { activeApp: pending, rejectedApp: null, isLeader: false };
  }

  const rejected = userApps.find((a) => a.status === "rejected");
  if (rejected) {
    return { activeApp: null, rejectedApp: rejected, isLeader: false };
  }

  return { activeApp: null, rejectedApp: null, isLeader: false };
};

export const submitRoleApplication = async (
  appData: Omit<RoleApplication, "id" | "status" | "created_at">
): Promise<RoleApplication> => {
  // STRICT RULE: Check if user already has an active application or is an appointed leader
  const status = await getUserApplicationStatus({
    studentId: appData.studentId,
    githubUsername: appData.githubUsername,
    email: appData.studentEmail,
  });

  if (status.isLeader) {
    throw new Error(
      `You are already officially appointed as ${status.leaderRole}. Current leadership team members cannot submit new role applications.`
    );
  }

  if (status.activeApp) {
    const activeRoleTitle = ROLE_DEFINITIONS[status.activeApp.appliedRole]?.title || status.activeApp.appliedRole;
    throw new Error(
      `You already have an active application under review for "${activeRoleTitle}". To prevent duplicate submissions and role spamming, students can only hold one active application at a time. You may only apply again if your earlier application is rejected.`
    );
  }

  // Prevent applying for an already occupied role
  if (appData.appliedRole !== "volunteer") {
    const check = isRoleOccupied(appData.appliedRole, appData.appliedWing);
    if (check.occupied) {
      throw new Error(
        `The position of ${ROLE_DEFINITIONS[appData.appliedRole].title}${
          appData.appliedWing ? ` (${WING_METADATA[appData.appliedWing]?.label || appData.appliedWing})` : ""
        } is already filled by an appointed member. It will reopen if the position becomes vacant.`
      );
    }
  }

  const newApp: RoleApplication = {
    ...appData,
    id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  // Supabase is the primary store for applications
  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from("role_applications").insert({
        id: newApp.id,
        student_id: newApp.studentId,
        student_name: newApp.studentName,
        student_email: newApp.studentEmail,
        github_username: newApp.githubUsername,
        academic_year: newApp.academicYear,
        course: newApp.course,
        applied_role: newApp.appliedRole,
        applied_wing: newApp.appliedWing,
        statement: newApp.statement,
        status: newApp.status,
        created_at: newApp.created_at,
      } as any);

      if (error) {
        console.error("Failed to insert role application to Supabase:", error);
      }
    } catch (err) {
      console.warn("Exception inserting role application to Supabase:", err);
    }
  }

  // Update local cache
  const apps = getRoleApplications();
  const updated = [newApp, ...apps.filter((a) => !(a.studentId === appData.studentId && a.status === "pending"))];
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("ts_applications_updated"));

  return newApp;
};

/**
 * Rejects a role application in Supabase and updates local cache.
 * Frees up the student to submit a new application for another role.
 */
export const rejectRoleApplication = async (
  appId: string,
  reviewerName: string
): Promise<void> => {
  if (isSupabaseConfigured() && supabase) {
    try {
      await (supabase
        .from("role_applications" as any)
        .update({
          status: "rejected",
          reviewed_by: reviewerName,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", appId) as any);
    } catch (err) {
      console.warn("Failed to reject application in Supabase:", err);
    }
  }

  const raw = getRoleApplications();
  const updated = raw.map((a) =>
    a.id === appId
      ? { ...a, status: "rejected" as const, reviewedBy: reviewerName, reviewedAt: new Date().toISOString() }
      : a
  );
  try {
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updated));
  } catch {}
  window.dispatchEvent(new CustomEvent("ts_applications_updated"));
};

/**
 * Fetches applications from Supabase role_applications and updates localStorage.
 * Supabase is the single source of truth across all devices.
 */
export const fetchRoleApplicationsRemote = async (): Promise<RoleApplication[]> => {
  let remoteApps: RoleApplication[] = [];
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from("role_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        remoteApps = data.map((d: any) => ({
          id: d.id,
          studentId: d.student_id,
          studentName: d.student_name,
          studentEmail: d.student_email,
          githubUsername: d.github_username,
          academicYear: d.academic_year,
          course: d.course,
          appliedRole: d.applied_role as HierarchyRole,
          appliedWing: d.applied_wing as FunctionalWing | undefined,
          statement: d.statement,
          status: d.status,
          reviewedBy: d.reviewed_by,
          reviewedAt: d.reviewed_at,
          created_at: d.created_at,
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch remote role applications:", e);
    }
  }

  // When Supabase is connected, remote records are the authoritative list
  if (isSupabaseConfigured() && remoteApps.length >= 0) {
    try {
      localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(remoteApps));
    } catch {}
    return remoteApps;
  }

  const localApps = getRoleApplications();
  return localApps;
};

// ─── PROMOTED MEMBERS & HIERARCHY RETRIEVAL ─────────────────────────────────

/**
 * Checks whether a student profile actually exists in the system.
 * A person's profile MUST exist as a registered member for promotion or listing.
 */
export const isStudentRegistered = (identifier: string): boolean => {
  if (!identifier) return false;
  const clean = identifier.trim().toLowerCase();
  const students = getAllStudents();
  return students.some(
    (s) =>
      s.id.toLowerCase() === clean ||
      s.githubUsername?.toLowerCase() === clean ||
      s.email?.toLowerCase() === clean ||
      s.name?.toLowerCase() === clean
  );
};

export const getPromotedMembers = (): PromotedMember[] => {
  try {
    const raw = localStorage.getItem(PROMOTED_MEMBERS_KEY);
    if (!raw) return [];
    const members: PromotedMember[] = JSON.parse(raw);
    if (!Array.isArray(members)) return [];
    return members;
  } catch {
    return [];
  }
};

export const savePromotedMembers = (members: PromotedMember[]): void => {
  try {
    localStorage.setItem(PROMOTED_MEMBERS_KEY, JSON.stringify(members));
    window.dispatchEvent(new CustomEvent("ts_hierarchy_updated"));
  } catch {}
};

/**
 * Fetches promoted members from Supabase with cross-device sync.
 * Automatically backfills existing promotions from laptop to Supabase
 * so mobile and other devices immediately see the updated roles and keys.
 */
export const fetchPromotedMembersRemote = async (): Promise<PromotedMember[]> => {
  if (!isSupabaseConfigured()) {
    return getPromotedMembers();
  }

  try {
    const { data, error } = await (supabase
      .from("promoted_members" as any)
      .select("*")
      .eq("is_active", true) as any);

    if (error) {
      console.warn("fetchPromotedMembersRemote error:", error);
      return getPromotedMembers();
    }

    const localMembers = getPromotedMembers();
    const map = new Map<string, PromotedMember>();

    // Map remote database records
    const remoteMapped: PromotedMember[] = (data || []).map((row: any) => {
      let av = row.avatar || undefined;
      if (!av && row.github_username) {
        av =
          localStorage.getItem(`ts_avatar_${row.github_username}`) ||
          `https://github.com/${row.github_username}.png`;
      }
      return {
        id: row.id,
        studentId: row.student_id,
        name: row.name,
        email: row.email || "",
        githubUsername: row.github_username,
        avatar: av,
        academicYear: row.academic_year,
        course: row.course || undefined,
        role: row.role as HierarchyRole,
        roleTitle: row.role_title,
        tier: row.tier,
        wing: row.wing as FunctionalWing,
        hasAdminKey: Boolean(row.has_admin_key),
        adminKey: row.admin_key || undefined,
        promotedBy: row.promoted_by,
        promotedAt: row.promoted_at,
      };
    });

    for (const m of remoteMapped) {
      const key = (m.studentId || m.githubUsername).toLowerCase();
      map.set(key, m);
    }

    // In Supabase mode, remote database records are the single source of truth across all devices.
    // If a member was demoted, they are absent from remoteMapped and will NOT be re-inserted.
    try {
      localStorage.setItem(PROMOTED_MEMBERS_KEY, JSON.stringify(remoteMapped));
    } catch {}
    window.dispatchEvent(new CustomEvent("ts_hierarchy_updated"));
    return remoteMapped;
  } catch (err) {
    console.warn("fetchPromotedMembersRemote exception:", err);
    return getPromotedMembers();
  }
};

/**
 * Checks whether a role (and optional wing) is currently filled by an appointed member.
 * When a role is occupied, applicants cannot select it until the position opens again.
 * Volunteer role is never occupied and remains open for all years under any wing.
 */
export const isRoleOccupied = (
  role: HierarchyRole,
  wing?: FunctionalWing
): { occupied: boolean; holder?: PromotedMember } => {
  if (role === "volunteer") {
    return { occupied: false };
  }

  const promoted = getPromotedMembers();

  // President: single occupant only
  if (role === "president") {
    const holder = promoted.find((m) => m.role === role);
    return { occupied: !!holder, holder };
  }

  // Vice President: allows up to 2 appointments
  if (role === "vice_president") {
    const holders = promoted.filter((m) => m.role === role);
    return { occupied: holders.length >= 2, holder: holders[0] };
  }

  // General Secretary & Treasurer: open for multiple appointments (up to 3)
  if (role === "general_secretary" || role === "treasurer") {
    const holders = promoted.filter((m) => m.role === role);
    return { occupied: holders.length >= 3, holder: holders[0] };
  }

  if (role === "functional_head" || role === "functional_co_head") {
    const maxSlots = role === "functional_head" ? 1 : 2;
    if (!wing) {
      const wings: FunctionalWing[] = ["logistics_events", "design_web", "technical", "content_social", "community"];
      const allFilled = wings.every((w) => promoted.filter((m) => m.role === role && m.wing === w).length >= maxSlots);
      return { occupied: allFilled };
    }
    const holders = promoted.filter((m) => m.role === role && m.wing === wing);
    return { occupied: holders.length >= maxSlots, holder: holders[0] };
  }

  return { occupied: false };
};

/**
 * Checks whether an account is eligible to promote others.
 * Allowed: Super Admin, or promoted President.
 */
export const canPromoteRoles = (userRole?: string, userName?: string): boolean => {
  if (userRole === "super_admin" || userRole === "president") return true;
  if (userName?.toLowerCase() === "super admin") return true;
  const promoted = getPromotedMembers();
  return promoted.some(
    (m) =>
      m.role === "president" &&
      (m.name.toLowerCase() === userName?.toLowerCase() || m.githubUsername.toLowerCase() === userName?.toLowerCase())
  );
};

/**
 * Promotes an applicant or student directly.
 * STRICT RULE: A person's profile MUST exist in the system as a registered member for their promotion.
 */
export const promoteStudent = async (params: {
  applicationId?: string;
  studentId: string;
  name: string;
  email: string;
  githubUsername: string;
  avatar?: string;
  academicYear: string;
  course?: string;
  role: HierarchyRole;
  wing?: FunctionalWing;
  promotedBy: string;
}): Promise<PromotedMember> => {
  // Validate that student profile actually exists in the system
  const registeredStudents = getAllStudents();
  let profileExists = registeredStudents.some(
    (s) =>
      (params.studentId && s.id === params.studentId) ||
      (params.githubUsername && s.githubUsername?.toLowerCase() === params.githubUsername.toLowerCase()) ||
      (params.email && s.email?.toLowerCase() === params.email.toLowerCase()) ||
      (params.name && s.name?.toLowerCase() === params.name.toLowerCase())
  );

  if (!profileExists && isSupabaseConfigured()) {
    try {
      const { data: remoteProfile } = await (supabase
        .from("student_profiles" as any)
        .select("id, username, github_username")
        .or(`id.eq.${params.studentId},username.ilike.${params.githubUsername || params.name},github_username.ilike.${params.githubUsername || params.name}`)
        .maybeSingle() as any);
      if (remoteProfile) profileExists = true;
    } catch {}
  }

  if (!profileExists) {
    throw new Error(
      `Cannot promote: "${params.name}" does not have an active registered member profile. A person profile must exist in the system for their promotion.`
    );
  }

  const currentMembers = getPromotedMembers();
  const roleDef = ROLE_DEFINITIONS[params.role];

  const existingIdx = currentMembers.findIndex(
    (m) => m.studentId === params.studentId || m.githubUsername.toLowerCase() === params.githubUsername.toLowerCase()
  );

  const existingVaultKey = _vaultGet(params.studentId || params.githubUsername)?.key;
  const existingKey = existingVaultKey || (existingIdx >= 0 ? currentMembers[existingIdx].adminKey : undefined);

  // Guarantee avatar is never left blank: check params -> localStorage -> student store -> GitHub
  let resolvedAvatar = params.avatar;
  if (!resolvedAvatar && params.githubUsername) {
    const cached = localStorage.getItem(`ts_avatar_${params.githubUsername}`);
    if (cached) {
      resolvedAvatar = cached;
    } else {
      const match = registeredStudents.find(
        (s) =>
          (params.studentId && s.id === params.studentId) ||
          (params.githubUsername && s.githubUsername?.toLowerCase() === params.githubUsername.toLowerCase())
      );
      resolvedAvatar = match?.avatar || `https://github.com/${params.githubUsername}.png`;
    }
  }

  const newPromoted: PromotedMember = {
    id: params.studentId || params.githubUsername,
    studentId: params.studentId,
    name: params.name,
    email: params.email,
    githubUsername: params.githubUsername,
    avatar: resolvedAvatar,
    academicYear: params.academicYear,
    course: params.course,
    role: params.role,
    roleTitle: roleDef.title,
    tier: roleDef.tier,
    wing: params.wing,
    hasAdminKey: existingIdx >= 0 ? (!!existingKey) : false,
    adminKey: existingKey ? (existingVaultKey ? _xorObfuscate(existingVaultKey) : existingKey) : undefined,
    promotedBy: params.promotedBy,
    promotedAt: new Date().toISOString(),
  };

  let updatedList: PromotedMember[];
  if (existingIdx >= 0) {
    updatedList = [...currentMembers];
    updatedList[existingIdx] = newPromoted;
  } else {
    updatedList = [...currentMembers, newPromoted];
  }

  savePromotedMembers(updatedList);

  // Sync to Supabase promoted_members table for cross-device support
  if (isSupabaseConfigured()) {
    try {
      await (supabase.from("promoted_members" as any).upsert({
        id: newPromoted.id,
        student_id: newPromoted.studentId,
        name: newPromoted.name,
        email: newPromoted.email || null,
        github_username: newPromoted.githubUsername,
        avatar: newPromoted.avatar || null,
        academic_year: newPromoted.academicYear,
        course: newPromoted.course || null,
        role: newPromoted.role,
        role_title: newPromoted.roleTitle,
        tier: newPromoted.tier,
        wing: newPromoted.wing || null,
        has_admin_key: newPromoted.hasAdminKey || false,
        admin_key: newPromoted.adminKey || null,
        promoted_by: newPromoted.promotedBy,
        promoted_at: newPromoted.promotedAt,
        is_active: true,
      }) as any);
    } catch (dbErr) {
      console.warn("Failed to sync promoted member to Supabase:", dbErr);
    }
  }

  // If promoted from application, update application status
  if (params.applicationId) {
    const apps = getRoleApplications();
    const updatedApps = apps.map((a) =>
      a.id === params.applicationId
        ? { ...a, status: "approved" as const, reviewedBy: params.promotedBy, reviewedAt: new Date().toISOString() }
        : a
    );
    try {
      localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updatedApps));
    } catch {}
    window.dispatchEvent(new CustomEvent("ts_applications_updated"));

    if (isSupabaseConfigured()) {
      try {
        await (supabase.from("role_applications" as any).update({
          status: "approved",
          reviewed_by: params.promotedBy,
          reviewed_at: new Date().toISOString(),
        }).eq("id", params.applicationId) as any);
      } catch (_appErr) {}
    }
  }

  return newPromoted;
};

/**
 * Demotes a member back to normal student.
 * Immediately revokes their admin key, removes them from Supabase promoted_members,
 * updates any approved role application so their role slot is freed,
 * and clears local storage.
 */
export const demoteMember = async (
  identifier: string,
  demotedBy: string,
  memberObj?: PromotedMember
): Promise<void> => {
  const currentMembers = getPromotedMembers();

  // Find target member across all identifier candidates
  const targetKeys = new Set(
    [identifier, memberObj?.id, memberObj?.studentId, memberObj?.githubUsername]
      .filter(Boolean)
      .map((k) => k!.trim().toLowerCase())
  );

  const member = currentMembers.find((m) => {
    return (
      (m.id && targetKeys.has(m.id.toLowerCase())) ||
      (m.studentId && targetKeys.has(m.studentId.toLowerCase())) ||
      (m.githubUsername && targetKeys.has(m.githubUsername.toLowerCase()))
    );
  }) || memberObj;

  if (member) {
    // Revoke admin key from local vault
    revokeAdminKey(member.studentId || member.githubUsername || member.id);
  }

  // 1. Remove from local promoted members
  const filtered = currentMembers.filter((m) => {
    return (
      (!m.id || !targetKeys.has(m.id.toLowerCase())) &&
      (!m.studentId || !targetKeys.has(m.studentId.toLowerCase())) &&
      (!m.githubUsername || !targetKeys.has(m.githubUsername.toLowerCase()))
    );
  });
  savePromotedMembers(filtered);

  // 2. Mark any approved application as rejected / vacated so the role opens up and applicant can apply again
  const localApps = getRoleApplications();
  const updatedApps = localApps.map((a) => {
    const matchesUser =
      (a.studentId && targetKeys.has(a.studentId.toLowerCase())) ||
      (a.githubUsername && targetKeys.has(a.githubUsername.toLowerCase())) ||
      (a.id && targetKeys.has(a.id.toLowerCase()));
    if (matchesUser && a.status === "approved") {
      return {
        ...a,
        status: "rejected" as const,
        reviewedBy: demotedBy,
        reviewedAt: new Date().toISOString(),
      };
    }
    return a;
  });
  try {
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updatedApps));
    window.dispatchEvent(new CustomEvent("ts_applications_updated"));
  } catch {}

  // 3. Supabase live synchronization
  if (isSupabaseConfigured() && supabase) {
    try {
      const orConditions: string[] = [];
      targetKeys.forEach((key) => {
        orConditions.push(`id.eq.${key}`, `student_id.eq.${key}`, `github_username.ilike.${key}`);
      });
      const orClause = orConditions.join(",");

      // Permanently remove from promoted_members table
      await (supabase.from("promoted_members" as any).delete().or(orClause) as any);

      // Also set is_active: false in case of soft delete policies
      await (supabase
        .from("promoted_members" as any)
        .update({
          is_active: false,
          demoted_at: new Date().toISOString(),
          admin_key: null,
          has_admin_key: false,
        })
        .or(orClause) as any);

      // Reopen any approved application so position is vacated
      await (supabase
        .from("role_applications" as any)
        .update({
          status: "rejected",
          reviewed_by: demotedBy,
          reviewed_at: new Date().toISOString(),
        })
        .or(orClause)
        .eq("status", "approved") as any);
    } catch (err) {
      console.warn("Failed to sync demotion to Supabase:", err);
    }
  }

  window.dispatchEvent(new CustomEvent("ts_hierarchy_updated"));
};

// ─── UNIQUE ADMIN SECRET KEY GENERATION & VERIFICATION ──────────────────────

/**
 * Generates a high-entropy, unique one-time access key for promoted leaders.
 * Format: TS-ADM-XXXX-XXXX-XXXX
 */
export const generateUniqueAdminKey = (identifier: string): string => {
  const members = getPromotedMembers();
  const idx = members.findIndex(
    (m) => m.studentId === identifier || m.githubUsername.toLowerCase() === identifier.toLowerCase()
  );

  if (idx < 0) {
    throw new Error("Only promoted Core Leaders or Functional Heads can generate an Admin Key.");
  }

  const member = members[idx];
  if (member.tier > 2) {
    throw new Error("Volunteers do not have administrative panel access.");
  }

  // If already generated in local vault, return it
  const existing = _vaultGet(member.studentId || member.githubUsername);
  if (existing?.key) {
    return existing.key;
  }

  // If key exists on member (e.g. from Supabase sync), deobfuscate, cache and return
  if (member.adminKey) {
    const recovered = _xorDeobfuscate(member.adminKey);
    if (recovered) {
      _vaultSet(member.studentId || member.githubUsername, recovered);
      return recovered;
    }
  }

  // Generate cryptographic high-entropy key: TS-ADM-XXXX-XXXX-XXXX
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join("");
  const key = `TS-ADM-${randomPart.slice(0, 4)}-${randomPart.slice(4, 8)}-${randomPart.slice(8, 12)}`;

  // Store in vault (local storage)
  _vaultSet(member.studentId || member.githubUsername, key);

  // Update hasAdminKey and adminKey on the member blob
  const obfuscatedKey = _xorObfuscate(key);
  members[idx] = { ...member, hasAdminKey: true, adminKey: obfuscatedKey };
  savePromotedMembers(members);

  // Sync to Supabase promoted_members for cross-device visibility
  if (isSupabaseConfigured()) {
    try {
      (supabase
        .from("promoted_members" as any)
        .update({
          has_admin_key: true,
          admin_key: obfuscatedKey,
        })
        .or(`student_id.eq.${member.studentId},github_username.ilike.${member.githubUsername},id.eq.${member.id}`) as any)
        .then(() => {});
    } catch (_syncErr) {}
  }

  // Sync with Admin Credentials store for legacy verify_admin_login fallback
  try {
    createAdminCredential(
      member.name.trim(),
      key,
      "2000-01-01",
      "member",
      member.email
    );
  } catch {}

  return key;
};

/**
 * Revokes the unique admin key.
 */
export const revokeAdminKey = (identifier: string): void => {
  const members = getPromotedMembers();
  const idx = members.findIndex(
    (m) => m.studentId === identifier || m.githubUsername.toLowerCase() === identifier.toLowerCase()
  );

  if (idx >= 0) {
    // Pull the key from the vault before deleting (needed to clean adminCredentials)
    const vaultEntry = _vaultGet(members[idx].studentId || members[idx].githubUsername);
    const key = vaultEntry?.key;

    // Delete from vault — the key is now gone permanently
    _vaultDelete(members[idx].studentId || members[idx].githubUsername);

    // Update the hasAdminKey flag in the member blob
    members[idx] = { ...members[idx], hasAdminKey: false, adminKey: undefined };
    savePromotedMembers(members);

    if (isSupabaseConfigured()) {
      try {
        (supabase
          .from("promoted_members" as any)
          .update({
            has_admin_key: false,
            admin_key: null,
          })
          .or(`student_id.eq.${members[idx].studentId},github_username.ilike.${members[idx].githubUsername},id.eq.${members[idx].id}`) as any)
          .then(() => {});
      } catch {}
    }

    // Also remove from admin credentials store
    if (key) {
      try {
        const creds = getStoredCredentials();
        const matching = creds.find((c) => c.mobile === key || c.name.toLowerCase() === members[idx].name.toLowerCase());
        if (matching) deleteAdminCredential(matching.id);
      } catch {}
    }
  }
};

/**
 * Verifies admin credentials via Name + Secret Key.
 * Checks both local vault and cross-device synced promoted_members records.
 */
export const verifyAdminKeyLogin = (name: string, key: string): { success: boolean; member?: PromotedMember } => {
  const cleanName = name.trim().toLowerCase();
  const cleanKey = key.trim();

  const members = getPromotedMembers();
  // Find matching name/username among Tier 1 & 2 (not volunteers)
  const candidate = members.find(
    (m) =>
      (m.name.trim().toLowerCase() === cleanName || m.githubUsername.toLowerCase() === cleanName) &&
      m.tier <= 2
  );

  if (!candidate) return { success: false };

  // 1. Look up the key in the local vault
  const vaultEntry = _vaultGet(candidate.studentId || candidate.githubUsername);
  if (vaultEntry?.key && vaultEntry.key === cleanKey) {
    return { success: true, member: candidate };
  }

  // 2. Look up the deobfuscated adminKey synced from Supabase (for mobile/new device)
  if (candidate.adminKey) {
    const deobfuscated = _xorDeobfuscate(candidate.adminKey);
    if (deobfuscated === cleanKey) {
      _vaultSet(candidate.studentId || candidate.githubUsername, cleanKey);
      return { success: true, member: candidate };
    }
  }

  // 3. Direct match fallback
  if (candidate.adminKey === cleanKey) {
    _vaultSet(candidate.studentId || candidate.githubUsername, cleanKey);
    return { success: true, member: candidate };
  }

  return { success: false };
};

/**
 * Helper to get the structured hierarchy tree for display.
 */
export interface StructuredHierarchy {
  tier1: PromotedMember[]; // Core Leadership
  tier2: Array<{
    wing: FunctionalWing;
    metadata: { label: string; description: string };
    heads: PromotedMember[];
    volunteers: PromotedMember[];
  }>;
}

export const getStructuredHierarchy = (): StructuredHierarchy => {
  const allPromoted = getPromotedMembers();

  // Tier 1: Core Leadership (Presidents, VPs, etc.)
  const tier1 = allPromoted
    .filter((m) => m.tier === 1)
    .sort((a, b) => {
      const order = { president: 1, vice_president: 2, general_secretary: 3, treasurer: 4 };
      return (order[a.role as keyof typeof order] || 99) - (order[b.role as keyof typeof order] || 99);
    });

  // Tier 2 Wings with their Heads and Volunteers
  const wingsList: FunctionalWing[] = [
    "technical",
    "design_web",
    "logistics_events",
    "content_social",
    "community",
  ];

  const tier2 = wingsList.map((wing) => {
    const heads = allPromoted.filter(
      (m) => (m.role === "functional_head" || m.role === "functional_co_head") && m.wing === wing
    );
    const volunteers = allPromoted.filter((m) => m.role === "volunteer" && m.wing === wing);

    return {
      wing,
      metadata: WING_METADATA[wing],
      heads,
      volunteers,
    };
  });

  return { tier1, tier2 };
};

/**
 * Returns the admin key for a specific promoted member's own profile view.
 * Works across all devices (laptop, mobile, tablet) by checking the local
 * vault first and falling back to the cross-device synced record.
 */
export const getOwnAdminKey = (identifier: string): string | undefined => {
  if (!identifier) return undefined;
  const clean = identifier.trim().toLowerCase();

  // 1. Check local vault
  const localKey = _vaultGet(identifier)?.key;
  if (localKey) return localKey;

  // 2. Check promoted members record synced from Supabase
  const members = getPromotedMembers();
  const m = members.find(
    (item) =>
      item.studentId?.toLowerCase() === clean ||
      item.githubUsername?.toLowerCase() === clean ||
      item.id?.toLowerCase() === clean
  );

  if (m?.adminKey) {
    const recovered = _xorDeobfuscate(m.adminKey);
    if (recovered) {
      _vaultSet(identifier, recovered);
      return recovered;
    }
  }

  return undefined;
};
