import { supabase, isSupabaseConfigured } from '../supabase/client';
import type { Database } from '../supabase/types';

export type StudentProfile = Database['public']['Tables']['student_profiles']['Row'];
export type StudentEducation = Database['public']['Tables']['student_education']['Row'];
export type StudentExperience = Database['public']['Tables']['student_experience']['Row'];
export type StudentCertification = Database['public']['Tables']['student_certifications']['Row'];

export interface FullStudentProfile extends StudentProfile {
  education: StudentEducation[];
  experience: StudentExperience[];
  certifications: StudentCertification[];
  email?: string;
  name?: string;
  githubUsername?: string;
}

export const getAllStudents = async (includeInactive = false): Promise<FullStudentProfile[]> => {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from('student_profiles')
    .select(`
      *,
      profiles:user_id (email, full_name, avatar_url),
      education:student_education (*),
      experience:student_experience (*),
      certifications:student_certifications (*)
    `);

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get student profiles:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    ...item,
    name: item.profiles?.full_name || item.name || item.username,
    email: item.profiles?.email || item.email || '',
    avatar: item.profiles?.avatar_url || item.avatar_url || item.avatar || null,
    githubUsername: item.github_username || item.githubUsername,
    education: item.education || [],
    experience: item.experience || [],
    certifications: item.certifications || [],
  }));
};

export const getStudentByUsername = async (username: string): Promise<FullStudentProfile | null> => {
  if (!isSupabaseConfigured()) return null;
  const cleanUsername = username.trim().toLowerCase();

  try {
    const { data } = await supabase
      .from('student_profiles')
      .select(`
        *,
        profiles:user_id (email, full_name, avatar_url),
        education:student_education (*),
        experience:student_experience (*),
        certifications:student_certifications (*)
      `)
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (data) {
      return {
        ...data,
        name: (data as any).profiles?.full_name || (data as any).name || data.username,
        email: (data as any).profiles?.email || (data as any).email || '',
        avatar: (data as any).profiles?.avatar_url || (data as any).avatar_url || (data as any).avatar || null,
        githubUsername: (data as any).github_username || (data as any).githubUsername,
        education: (data as any).education || [],
        experience: (data as any).experience || [],
        certifications: (data as any).certifications || [],
      };
    }
  } catch (_err) {}

  // Resilient fallback: simple query without relation joins
  try {
    const { data: fallback } = await supabase
      .from('student_profiles')
      .select('*')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (fallback) {
      return {
        ...fallback,
        name: fallback.username,
        avatar: (fallback as any).avatar_url || (fallback as any).avatar || null,
        githubUsername: (fallback as any).github_username || (fallback as any).githubUsername,
        education: [],
        experience: [],
        certifications: [],
      } as any;
    }
  } catch (_e) {}

  return null;
};

export const getStudentByUserId = async (userId: string): Promise<FullStudentProfile | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data } = await supabase
      .from('student_profiles')
      .select(`
        *,
        profiles:user_id (email, full_name, avatar_url),
        education:student_education (*),
        experience:student_experience (*),
        certifications:student_certifications (*)
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      return {
        ...data,
        name: (data as any).profiles?.full_name || (data as any).name || data.username,
        email: (data as any).profiles?.email || (data as any).email || '',
        avatar: (data as any).profiles?.avatar_url || (data as any).avatar_url || (data as any).avatar || null,
        githubUsername: (data as any).github_username || (data as any).githubUsername,
        education: (data as any).education || [],
        experience: (data as any).experience || [],
        certifications: (data as any).certifications || [],
      };
    }
  } catch (_err) {}

  // Resilient fallback: direct query without joins
  try {
    const { data: fallback } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fallback) {
      return {
        ...fallback,
        name: fallback.username,
        avatar: (fallback as any).avatar_url || (fallback as any).avatar || null,
        githubUsername: (fallback as any).github_username || (fallback as any).githubUsername,
        education: [],
        experience: [],
        certifications: [],
      } as any;
    }
  } catch (_e) {}

  return null;
};

export interface RegisterStudentInput {
  name: string;
  email: string;
  password: string;
  rollNumber?: string;
  course?: string;
  year?: string;
  bio?: string;
  githubUsername: string;
  linkedinUrl?: string;
  interests?: string[];
  skills?: string[];
}

import { getAllStudents as getLocalStudents } from '../studentStore';

export const registerStudentProfile = async (
  input: RegisterStudentInput
): Promise<FullStudentProfile | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('[TECHSHASTRA] Backend not configured, skipping remote student registration.');
    return null;
  }

  const rawUsername = input.githubUsername.trim();
  const lowerUsername = rawUsername.toLowerCase();

  // PRE-CHECK 1: Check if GitHub username is already registered in student_profiles
  try {
    const { data: existingUser } = await supabase
      .from('student_profiles')
      .select('id, username, github_username')
      .or(`username.eq.${lowerUsername},github_username.ilike.${rawUsername}`)
      .maybeSingle();

    if (existingUser) {
      throw new Error('USERNAME_EXISTS');
    }
  } catch (err: any) {
    if (err?.message === 'USERNAME_EXISTS') throw err;
  }

  // PRE-CHECK 2: Check local student store
  try {
    const localStudents = getLocalStudents();
    if (localStudents.some((s) => s.githubUsername?.trim().toLowerCase() === lowerUsername)) {
      throw new Error('USERNAME_EXISTS');
    }
  } catch (_e) {}

  // 1. Sign up user with Supabase Auth (ONLY after username is verified available)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        full_name: input.name.trim(),
        role: 'student_member',
        github_username: rawUsername,
        avatar_url: `https://github.com/${rawUsername}.png`,
      },
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('user already exists')) {
      throw new Error('EMAIL_EXISTS');
    }
    console.error('Supabase auth.signUp error:', authError);
    throw authError;
  }

  if (!authData.user) {
    throw new Error('Authentication user creation failed.');
  }

  // Supabase security check: when email is already registered and email confirmation is on,
  // Supabase returns an empty identities array to prevent user enumeration.
  if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
    throw new Error('EMAIL_EXISTS');
  }

  const userId = authData.user.id;
  const username = lowerUsername;

  // 2. Insert into student_profiles table
  const { data: studentRecord, error: studentError } = await supabase
    .from('student_profiles')
    .insert({
      user_id: userId,
      username: username,
      github_username: rawUsername,
      roll_number: input.rollNumber?.trim() || null,
      course: input.course?.trim() || null,
      year: input.year?.trim() || null,
      bio: input.bio?.trim() || null,
      linkedin_url: input.linkedinUrl?.trim() || null,
      interests: input.interests || [],
      skills: input.skills || [],
      is_active: true,
    })
    .select()
    .single();

  if (studentError) {
    if (studentError.code === '23505' || studentError.message.includes('student_profiles_username_key')) {
      throw new Error('USERNAME_EXISTS');
    }
    console.error('Failed to create student_profiles record in Supabase:', studentError);
    throw studentError;
  }

  // 3. Ensure profiles record has avatar_url and details
  try {
    await supabase.from('profiles').upsert({
      id: userId,
      email: input.email.trim().toLowerCase(),
      full_name: input.name.trim(),
      role: 'student_member',
      avatar_url: `https://github.com/${rawUsername}.png`,
    }, { onConflict: 'id' });
  } catch (_profileErr) {}

  return {
    ...studentRecord,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    githubUsername: rawUsername,
    education: [],
    experience: [],
    certifications: [],
  };
};

export const signInStudentRemote = async (email: string, password: string) => {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    return null;
  }

  let student = await getStudentByUserId(data.user.id);

  // Self-heal: If auth user exists but student_profiles was missing (e.g. earlier failed signup)
  if (!student && data.user) {
    try {
      const meta = data.user.user_metadata || {};
      const baseUsername = (meta.github_username || data.user.email?.split('@')[0] || `user_${data.user.id.slice(0, 6)}`)
        .trim()
        .toLowerCase();

      // Check if username is free, or make unique
      let safeUsername = baseUsername;
      const { data: existing } = await supabase
        .from('student_profiles')
        .select('id')
        .eq('username', safeUsername)
        .maybeSingle();

      if (existing) {
        safeUsername = `${baseUsername}_${data.user.id.slice(0, 4)}`;
      }

      const { data: newProfile } = await supabase
        .from('student_profiles')
        .insert({
          user_id: data.user.id,
          username: safeUsername,
          github_username: meta.github_username || safeUsername,
          is_active: true,
          interests: [],
          skills: [],
        })
        .select()
        .maybeSingle();

      if (newProfile) {
        student = await getStudentByUserId(data.user.id);
      }
    } catch (_healErr) {
      console.warn("Self-healing profile creation warning:", _healErr);
    }
  }

  return {
    user: data.user,
    student,
  };
};

export const updateStudentProfile = async (
  profileId: string,
  updates: Partial<Database['public']['Tables']['student_profiles']['Update']>
) => {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('student_profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ─── EDUCATION / EXPERIENCE / CERTIFICATION MUTATIONS ──────────────────

export const addEducation = async (edu: Database['public']['Tables']['student_education']['Insert']) => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('student_education').insert(edu).select().single();
  if (error) throw error;
  return data;
};

export const deleteEducation = async (id: string) => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('student_education').delete().eq('id', id);
  if (error) throw error;
};

export const addExperience = async (exp: Database['public']['Tables']['student_experience']['Insert']) => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('student_experience').insert(exp).select().single();
  if (error) throw error;
  return data;
};

export const deleteExperience = async (id: string) => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('student_experience').delete().eq('id', id);
  if (error) throw error;
};

export const addCertification = async (cert: Database['public']['Tables']['student_certifications']['Insert']) => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('student_certifications').insert(cert).select().single();
  if (error) throw error;
  return data;
};

export const deleteCertification = async (id: string) => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('student_certifications').delete().eq('id', id);
  if (error) throw error;
};
