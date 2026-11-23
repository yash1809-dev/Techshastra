import { supabase } from "@/lib/supabase/client";

export type DignitySection = "leadership" | "directors";

export interface Dignitary {
  id: string;
  section: DignitySection;
  name: string;
  title: string;
  institute?: string;
  message?: string;
  photo_url: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_LEADERSHIP: Dignitary[] = [
  {
    id: "default-l1",
    section: "leadership",
    name: "Lt. Gen. Gurmit Singh",
    title: "Governor, Uttarakhand & Chancellor of the University",
    message: "Honourable Chancellor's Message",
    photo_url: "/Governer.jpg",
    display_order: 0,
    is_active: true,
  },
  {
    id: "default-l2",
    section: "leadership",
    name: "Shri Pushkar Singh Dhami",
    title: "Chief Minister, Uttarakhand",
    photo_url: "/CM.jpg",
    display_order: 1,
    is_active: true,
  },
  {
    id: "default-l3",
    section: "leadership",
    name: "Dr. Tripta Thakur",
    title: "Vice-Chancellor",
    photo_url: "/VC.jpg",
    display_order: 2,
    is_active: true,
  },
];

export const DEFAULT_DIRECTORS: Dignitary[] = [
  {
    id: "default-d1",
    section: "directors",
    name: "Dr. Santoshkumar Hampannavar",
    title: "Director",
    institute: "B.T.K.I.T. Dwarahat",
    photo_url: "/Director BTKIT.jpg",
    display_order: 0,
    is_active: true,
  },
  {
    id: "default-d2",
    section: "directors",
    name: "Dr. Amit Agarwal",
    title: "Director IT",
    institute: "Gopeshwar",
    photo_url: "/Director ITG.jpg",
    display_order: 1,
    is_active: true,
  },
  {
    id: "default-d3",
    section: "directors",
    name: "Prof. (Dr.) Ajit Singh",
    title: "Director",
    institute: "NPSEI Pithoragarh",
    photo_url: "/NPSEI Director.jpeg",
    display_order: 2,
    is_active: true,
  },
  {
    id: "default-d4",
    section: "directors",
    name: "Dr. Sharad Kumar Pradhan",
    title: "Director",
    institute: "THDC-IHE Tehri & GWIT",
    photo_url: "/Director THIDC & WIT.webp",
    display_order: 3,
    is_active: true,
  },
  {
    id: "default-d5",
    section: "directors",
    name: "Prof. Hardwari Lal Mandoria",
    title: "Director",
    institute: "Dr. APJ AKIT, Tanakpur",
    photo_url: "/Director AKIT.jpeg",
    display_order: 4,
    is_active: true,
  },
  {
    id: "default-d6",
    section: "directors",
    name: "Dr. H.S Bhadauria",
    title: "Director IT",
    institute: "BAUN",
    photo_url: "/Director IT Baun.jpeg",
    display_order: 5,
    is_active: true,
  },
];

export async function fetchDignitariesBySection(
  section: DignitySection
): Promise<Dignitary[]> {
  try {
    const { data, error } = await supabase
      .from("dignitaries")
      .select("*")
      .eq("section", section)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.warn("[dignitariesService] fetch error:", error.message);
      return section === "leadership" ? DEFAULT_LEADERSHIP : DEFAULT_DIRECTORS;
    }
    const defaults = section === "leadership" ? DEFAULT_LEADERSHIP : DEFAULT_DIRECTORS;
    return data && data.length > 0 ? (data as Dignitary[]) : defaults;
  } catch {
    return section === "leadership" ? DEFAULT_LEADERSHIP : DEFAULT_DIRECTORS;
  }
}

export async function fetchAllDignitaries(): Promise<Dignitary[]> {
  try {
    const { data, error } = await supabase
      .from("dignitaries")
      .select("*")
      .order("section", { ascending: true })
      .order("display_order", { ascending: true });

    if (error) {
      console.warn("[dignitariesService] fetchAll error:", error.message);
      return [...DEFAULT_LEADERSHIP, ...DEFAULT_DIRECTORS];
    }
    return data && data.length > 0
      ? (data as Dignitary[])
      : [...DEFAULT_LEADERSHIP, ...DEFAULT_DIRECTORS];
  } catch {
    return [...DEFAULT_LEADERSHIP, ...DEFAULT_DIRECTORS];
  }
}

export async function upsertDignitary(
  d: Omit<Dignitary, "created_at" | "updated_at"> & { id?: string }
): Promise<Dignitary> {
  const payload = {
    section: d.section,
    name: d.name,
    title: d.title,
    institute: d.institute || null,
    message: d.message || null,
    photo_url: d.photo_url,
    display_order: d.display_order,
    is_active: d.is_active,
    updated_at: new Date().toISOString(),
  };

  if (d.id && !d.id.startsWith("default-")) {
    const { data, error } = await supabase
      .from("dignitaries")
      .update(payload)
      .eq("id", d.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Dignitary;
  } else {
    const { data, error } = await supabase
      .from("dignitaries")
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Dignitary;
  }
}

export async function deleteDignitary(id: string): Promise<void> {
  if (id.startsWith("default-")) return;
  const { error } = await supabase
    .from("dignitaries")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateDignitaryOrder(list: Dignitary[]): Promise<void> {
  const updates = list
    .filter((d) => !d.id.startsWith("default-"))
    .map((d, idx) =>
      supabase
        .from("dignitaries")
        .update({ display_order: idx, updated_at: new Date().toISOString() })
        .eq("id", d.id)
    );
  await Promise.all(updates);
}

export async function uploadDignitaryPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("dignitaries-photos")
    .upload(fileName, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("dignitaries-photos").getPublicUrl(fileName);
  return data.publicUrl;
}
