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
    isOpenForApplication: false, // Locked as per user requirement
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
    eligibleYears: ["2nd Year", "3rd Year", "4th Year"],
    requiresWing: false,
    isOpenForApplication: false, // Locked as per user requirement
    description: "Documentation, governance, administrative coordination, and records.",
  },
  treasurer: {
    id: "treasurer",
    title: "Treasurer",
    tier: 1,
    eligibleYears: ["2nd Year", "3rd Year", "4th Year"],
    requiresWing: false,
    isOpenForApplication: false, // Locked as per user requirement
    description: "Budgeting, financial accounts, allocations, and sponsorship management.",
  },
  functional_head: {
    id: "functional_head",
    title: "Functional Head",
    tier: 2,
    eligibleYears: ["2nd Year", "3rd Year"],
    requiresWing: true,
    isOpenForApplication: true,
    description: "Lead departmental operations, project deliverables, and team leadership.",
  },
  functional_co_head: {
    id: "functional_co_head",
    title: "Functional Co-Head",
    tier: 2,
    eligibleYears: ["2nd Year", "3rd Year"],
    requiresWing: true,
    isOpenForApplication: true,
    description: "Support department head and coordinate volunteer execution.",
  },
  volunteer: {
    id: "volunteer",
    title: "Club Volunteer / Team Member",
    tier: 3,
    eligibleYears: ["1st Year", "2nd Year"],
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
  /** Key lives in obfuscated vault (ts_akv) — never in this blob. */
  hasAdminKey?: boolean;
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

export const submitRoleApplication = async (
  appData: Omit<RoleApplication, "id" | "status" | "created_at">
): Promise<RoleApplication> => {
  const newApp: RoleApplication = {
    ...appData,
    id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  const apps = getRoleApplications();
  // Filter out any previous pending app by this student for this role
  const updated = [newApp, ...apps.filter((a) => !(a.studentId === appData.studentId && a.status === "pending"))];
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("ts_applications_updated"));

  // Optional Supabase backup
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from("role_applications").upsert({
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
    } catch {}
  }

  return newApp;
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

    // STRICT GOVERNANCE RULE:
    // Only post/include members whose profiles exist as registered members in the system.
    // If they are not registered as a member, they CANNOT appear in the leadership or hierarchy tree.
    const registeredStudents = getAllStudents();
    const validMembers = members.filter((m) =>
      registeredStudents.some(
        (s) =>
          (m.studentId && s.id === m.studentId) ||
          (m.githubUsername && s.githubUsername?.toLowerCase() === m.githubUsername.toLowerCase()) ||
          (m.email && s.email?.toLowerCase() === m.email.toLowerCase()) ||
          (m.name && s.name?.toLowerCase() === m.name.toLowerCase())
      )
    );

    // Auto-clean any unverified or mock records from localStorage
    if (validMembers.length !== members.length) {
      localStorage.setItem(PROMOTED_MEMBERS_KEY, JSON.stringify(validMembers));
    }
    return validMembers;
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
  const profileExists = registeredStudents.some(
    (s) =>
      (params.studentId && s.id === params.studentId) ||
      (params.githubUsername && s.githubUsername?.toLowerCase() === params.githubUsername.toLowerCase()) ||
      (params.email && s.email?.toLowerCase() === params.email.toLowerCase()) ||
      (params.name && s.name?.toLowerCase() === params.name.toLowerCase())
  );

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

  const newPromoted: PromotedMember = {
    id: params.studentId || params.githubUsername,
    studentId: params.studentId,
    name: params.name,
    email: params.email,
    githubUsername: params.githubUsername,
    avatar: params.avatar,
    academicYear: params.academicYear,
    course: params.course,
    role: params.role,
    roleTitle: roleDef.title,
    tier: roleDef.tier,
    wing: params.wing,
    hasAdminKey: existingIdx >= 0 ? (!!_vaultGet(params.studentId || params.githubUsername)) : false,
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

  // If promoted from application, update application status
  if (params.applicationId) {
    const apps = getRoleApplications();
    const updatedApps = apps.map((a) =>
      a.id === params.applicationId
        ? { ...a, status: "approved" as const, reviewedBy: params.promotedBy, reviewedAt: new Date().toISOString() }
        : a
    );
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updatedApps));
    window.dispatchEvent(new CustomEvent("ts_applications_updated"));
  }

  return newPromoted;
};

/**
 * Demotes a member back to normal student.
 * Immediately revokes their admin key if they had one.
 */
export const demoteMember = async (identifier: string, demotedBy: string): Promise<void> => {
  const currentMembers = getPromotedMembers();
  const member = currentMembers.find(
    (m) => m.studentId === identifier || m.githubUsername.toLowerCase() === identifier.toLowerCase()
  );

  if (member && member.hasAdminKey) {
    // Revoke admin key from vault
    revokeAdminKey(member.studentId || member.githubUsername);
  }

  const filtered = currentMembers.filter(
    (m) => m.studentId !== identifier && m.githubUsername.toLowerCase() !== identifier.toLowerCase()
  );
  savePromotedMembers(filtered);
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

  // If already generated, return existing key from the secure vault (NOT from the member blob)
  const existing = _vaultGet(member.studentId || member.githubUsername);
  if (existing?.key) {
    return existing.key;
  }

  // Generate cryptographic high-entropy key: TS-ADM-XXXX-XXXX-XXXX
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join("");
  const key = `TS-ADM-${randomPart.slice(0, 4)}-${randomPart.slice(4, 8)}-${randomPart.slice(8, 12)}`;

  // Store ONLY in vault (obfuscated, separate key) — never in the member blob
  _vaultSet(member.studentId || member.githubUsername, key);

  // Update hasAdminKey flag on the member blob (just a boolean, no key value)
  members[idx] = { ...member, hasAdminKey: true };
  savePromotedMembers(members);

  // Sync with Admin Credentials store for legacy verify_admin_login fallback
  try {
    const adminRole: AdminRole = member.tier === 1 ? "super_admin" : "admin";
    createAdminCredential({
      name: member.name.trim(),
      mobile: key,
      dob: "2000-01-01",
      email: member.email,
      role: adminRole,
    });
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
    members[idx] = { ...members[idx], hasAdminKey: false };
    savePromotedMembers(members);

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

  // Look up the key in the vault (never stored in the member blob)
  const vaultEntry = _vaultGet(candidate.studentId || candidate.githubUsername);
  if (vaultEntry?.key && vaultEntry.key === cleanKey) {
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
 * Only call this when the logged-in student IS the identifier (own profile).
 * Returns undefined if no key has been generated yet.
 */
export const getOwnAdminKey = (identifier: string): string | undefined => {
  return _vaultGet(identifier)?.key;
};
