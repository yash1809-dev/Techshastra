import { supabase } from "@/lib/supabase/client";
import mentorImg from "@/assets/mentor.jpg";
import akhileshImg from "@/assets/akhilesh.jpg";
import amiteshImg from "@/assets/amitesh.jpg";

export interface Leader {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo_url: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Fallback static data matching the original hardcoded section */
export const DEFAULT_LEADERS: Leader[] = [
  {
    id: "default-1",
    name: "Dr. Sandeep Singh Negi",
    role: "Chief Mentor & Patron",
    bio: "The visionary backbone of TECHSHASTRA, providing strategic guidance and academic integrity.",
    photo_url: mentorImg,
    display_order: 0,
    is_active: true,
  },
  {
    id: "default-2",
    name: "Akhilesh Raje",
    role: "President",
    bio: "Overseeing daily operations and leading the strategic expansion of the community.",
    photo_url: akhileshImg,
    display_order: 1,
    is_active: true,
  },
  {
    id: "default-3",
    name: "Amitesh Kumar",
    role: "Vice-President",
    bio: "Driving technical initiatives and coordination across various internal domains.",
    photo_url: amiteshImg,
    display_order: 2,
    is_active: true,
  },
];

export async function fetchLeaders(): Promise<Leader[]> {
  try {
    const { data, error } = await supabase
      .from("leaders_directors")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.warn("[leadersService] fetchLeaders error:", error.message);
      return DEFAULT_LEADERS;
    }
    return data && data.length > 0 ? (data as Leader[]) : DEFAULT_LEADERS;
  } catch (err) {
    console.warn("[leadersService] fetchLeaders exception:", err);
    return DEFAULT_LEADERS;
  }
}

export async function fetchAllLeaders(): Promise<Leader[]> {
  try {
    const { data, error } = await supabase
      .from("leaders_directors")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.warn("[leadersService] fetchAllLeaders error:", error.message);
      return DEFAULT_LEADERS;
    }
    return data && data.length > 0 ? (data as Leader[]) : DEFAULT_LEADERS;
  } catch (err) {
    console.warn("[leadersService] fetchAllLeaders exception:", err);
    return DEFAULT_LEADERS;
  }
}

export async function upsertLeader(
  leader: Omit<Leader, "id" | "created_at" | "updated_at"> & { id?: string }
): Promise<Leader> {
  const payload: Record<string, unknown> = {
    name: leader.name,
    role: leader.role,
    bio: leader.bio,
    photo_url: leader.photo_url,
    display_order: leader.display_order,
    is_active: leader.is_active,
    updated_at: new Date().toISOString(),
  };

  if (leader.id && !leader.id.startsWith("default-")) {
    // Update existing
    const { data, error } = await supabase
      .from("leaders_directors")
      .update(payload)
      .eq("id", leader.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Leader;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from("leaders_directors")
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Leader;
  }
}

export async function deleteLeader(id: string): Promise<void> {
  if (id.startsWith("default-")) return; // Can't delete static fallbacks
  const { error } = await supabase
    .from("leaders_directors")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateLeaderOrder(leaders: Leader[]): Promise<void> {
  const updates = leaders
    .filter((l) => !l.id.startsWith("default-"))
    .map((l, idx) =>
      supabase
        .from("leaders_directors")
        .update({ display_order: idx, updated_at: new Date().toISOString() })
        .eq("id", l.id)
    );
  await Promise.all(updates);
}

/** Upload a photo to Supabase Storage and return its public URL */
export async function uploadLeaderPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("leaders-photos")
    .upload(fileName, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("leaders-photos").getPublicUrl(fileName);
  return data.publicUrl;
}

/** Seed the database with the default leaders if the table is empty */
export async function seedLeadersIfEmpty(): Promise<void> {
  const { count, error } = await supabase
    .from("leaders_directors")
    .select("id", { count: "exact", head: true });
  if (error || (count !== null && count > 0)) return;

  for (let i = 0; i < DEFAULT_LEADERS.length; i++) {
    const l = DEFAULT_LEADERS[i];
    await supabase.from("leaders_directors").insert({
      name: l.name,
      role: l.role,
      bio: l.bio,
      photo_url: "", // No URL — users should re-upload
      display_order: i,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}
