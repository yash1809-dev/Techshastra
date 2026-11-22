import { supabase, isSupabaseConfigured } from '../supabase/client';
import type { Database, UserRole } from '../supabase/types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export interface AuthState {
  user: any | null;
  profile: Profile | null;
  role: UserRole;
  loading: boolean;
}

/**
 * Sign up a new user with Supabase Auth and initialize their profile.
 */
export const signUp = async (
  email: string,
  password: string,
  fullName: string,
  role: UserRole = 'student_member'
) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set credentials in .env');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
      },
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });

  if (error) throw error;
  return data;
};

/**
 * Sign in using email and password.
 */
export const signIn = async (email: string, password: string) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set credentials in .env');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

/**
 * Sign out the current user.
 */
export const signOut = async () => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

/**
 * Send password reset email with OTP token.
 */
export const resetPassword = async (email: string) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set credentials in .env');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) throw error;
};

/**
 * Send password reset email to user.
 * Dispatches the Supabase recovery email with a secure reset link.
 */
export const sendPasswordResetEmail = async (email: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set credentials in .env');
  }

  const cleanEmail = email.trim().toLowerCase();
  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/join?mode=recovery`
    : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  });

  if (error) throw error;
  return true;
};

export const sendPasswordResetOtp = sendPasswordResetEmail;

/**
 * Verify recovery OTP token sent to user's email.
 * On success, establishes a valid authenticated recovery session.
 */
export const verifyPasswordResetOtp = async (email: string, token: string) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set credentials in .env');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();
  const { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: 'recovery',
  });

  if (error) throw error;
  return data;
};

/**
 * Update password for authenticated user.
 */
export const updatePassword = async (newPassword: string) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set credentials in .env');
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
  return data;
};

/**
 * Fetch profile record for a given user ID.
 */
export const getProfile = async (userId: string): Promise<Profile | null> => {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to get profile:', error);
    return null;
  }

  return data;
};

/**
 * Update the current user's profile.
 */
export const updateProfile = async (
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at'>>
): Promise<Profile | null> => {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
