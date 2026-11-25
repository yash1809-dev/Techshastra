/**
 * Role Application Deadline & Clock Service for TechShastra
 *
 * Persists and synchronizes role application deadlines between SuperAdmin
 * and applicants in real time via Supabase Cloud and localStorage.
 */

import { supabase, isSupabaseConfigured } from "../supabase/client";

export interface RoleApplicationDeadlineConfig {
  deadlineAt: string | null; // ISO string e.g. "2026-11-25T18:30:00.000Z"
  isEnabled: boolean;        // whether applications are open
  updatedBy?: string;
  updatedAt?: string;
}

const DEADLINE_STORAGE_KEY = "ts_role_app_deadline";

const DEFAULT_CONFIG: RoleApplicationDeadlineConfig = {
  deadlineAt: null,
  isEnabled: true,
  updatedBy: "Super Admin",
  updatedAt: new Date().toISOString(),
};

/**
 * Read current deadline configuration synchronously from localStorage for 0ms render.
 */
export function getRoleApplicationDeadline(): RoleApplicationDeadlineConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(DEADLINE_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      deadlineAt: parsed.deadlineAt ?? null,
      isEnabled: parsed.isEnabled !== false,
      updatedBy: parsed.updatedBy || "Super Admin",
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Fetch current deadline configuration from Supabase Cloud and cache locally.
 */
export async function fetchRoleApplicationDeadlineRemote(): Promise<RoleApplicationDeadlineConfig> {
  const currentLocal = getRoleApplicationDeadline();
  if (!isSupabaseConfigured()) return currentLocal;

  try {
    const { data, error } = await supabase
      .from("role_application_settings")
      .select("*")
      .eq("id", "current")
      .maybeSingle();

    if (error) {
      console.warn("[roleDeadlineService] fetch error:", error.message);
      return currentLocal;
    }

    if (data) {
      const config: RoleApplicationDeadlineConfig = {
        deadlineAt: data.deadline_at,
        isEnabled: data.is_enabled !== false,
        updatedBy: data.updated_by || "Super Admin",
        updatedAt: data.updated_at,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem(DEADLINE_STORAGE_KEY, JSON.stringify(config));
      }
      return config;
    }
    return currentLocal;
  } catch (err) {
    console.warn("[roleDeadlineService] fetch exception:", err);
    return currentLocal;
  }
}

/**
 * Update deadline configuration in Supabase Cloud and localStorage.
 */
export async function setRoleApplicationDeadlineRemote(
  updates: Partial<RoleApplicationDeadlineConfig>,
  actorName = "Super Admin"
): Promise<RoleApplicationDeadlineConfig> {
  const current = getRoleApplicationDeadline();
  const nextConfig: RoleApplicationDeadlineConfig = {
    ...current,
    ...updates,
    updatedBy: actorName,
    updatedAt: new Date().toISOString(),
  };

  // 1. Update localStorage immediately
  if (typeof window !== "undefined") {
    localStorage.setItem(DEADLINE_STORAGE_KEY, JSON.stringify(nextConfig));
  }

  // 2. Persist to Supabase Cloud
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("role_application_settings")
        .upsert(
          {
            id: "current",
            deadline_at: nextConfig.deadlineAt,
            is_enabled: nextConfig.isEnabled,
            updated_by: nextConfig.updatedBy,
            updated_at: nextConfig.updatedAt,
          },
          { onConflict: "id" }
        );

      if (error) {
        console.warn("[roleDeadlineService] upsert error:", error.message);
      }
    } catch (err) {
      console.warn("[roleDeadlineService] upsert exception:", err);
    }
  }

  return nextConfig;
}

/**
 * Subscribe to realtime changes on role_application_settings
 */
export function subscribeToRoleApplicationDeadline(
  onUpdate: (config: RoleApplicationDeadlineConfig) => void
): () => void {
  if (!isSupabaseConfigured()) return () => {};

  try {
    const channel = supabase
      .channel("public:role_application_settings-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "role_application_settings" },
        (payload: any) => {
          if (payload.new) {
            const config: RoleApplicationDeadlineConfig = {
              deadlineAt: payload.new.deadline_at,
              isEnabled: payload.new.is_enabled !== false,
              updatedBy: payload.new.updated_by || "Super Admin",
              updatedAt: payload.new.updated_at,
            };
            if (typeof window !== "undefined") {
              localStorage.setItem(DEADLINE_STORAGE_KEY, JSON.stringify(config));
            }
            onUpdate(config);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn("[roleDeadlineService] subscribe error:", err);
    return () => {};
  }
}

export interface TimeRemainingResult {
  isExpired: boolean;
  isClosed: boolean;
  hasDeadline: boolean;
  totalMs: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;     // e.g. "03:45"
  fullFormatted: string; // e.g. "3h 45m 12s"
}

/**
 * Calculate time remaining from now until deadline.
 */
export function calculateTimeRemaining(
  deadlineIso: string | null,
  isEnabled = true
): TimeRemainingResult {
  if (!isEnabled) {
    return {
      isExpired: true,
      isClosed: true,
      hasDeadline: Boolean(deadlineIso),
      totalMs: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: "00:00",
      fullFormatted: "Applications Closed",
    };
  }

  if (!deadlineIso) {
    return {
      isExpired: false,
      isClosed: false,
      hasDeadline: false,
      totalMs: Infinity,
      hours: 99,
      minutes: 59,
      seconds: 59,
      formatted: "No deadline",
      fullFormatted: "Open Indefinitely",
    };
  }

  const deadlineMs = new Date(deadlineIso).getTime();
  const nowMs = Date.now();
  const diffMs = deadlineMs - nowMs;

  if (diffMs <= 0 || isNaN(diffMs)) {
    return {
      isExpired: true,
      isClosed: true,
      hasDeadline: true,
      totalMs: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: "00:00",
      fullFormatted: "Deadline Expired",
    };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((diffMs / 1000) % 60);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  const formatted = `${hh}:${mm}`;
  const fullFormatted =
    hours >= 24
      ? `${Math.floor(hours / 24)}d ${hours % 24}h ${mm}m`
      : `${hours}h ${mm}m ${ss}s`;

  return {
    isExpired: false,
    isClosed: false,
    hasDeadline: true,
    totalMs: diffMs,
    hours,
    minutes,
    seconds,
    formatted,
    fullFormatted,
  };
}
