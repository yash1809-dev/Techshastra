/**
 * Student store — persistent student profiles + cookie-based auth session.
 *
 * ponytail: all data in localStorage, session token in a cookie (7-day expiry).
 * Ceiling: single-browser, no server sync. Upgrade: add a backend + JWT.
 */

import { createLocalStore } from "./localStore";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface StudentProfile {
  id: string;
  created_at: string;
  updated_at?: string;

  // Core identity
  name: string;
  email: string;
  /** hashed with a simple deterministic hash — not crypto-grade, but stops plain-text storage */
  passwordHash: string;
  rollNumber?: string;
  course?: string;
  year?: string;
  bio?: string;
  avatar?: string; // URL or data-URL

  // Social links (LinkedIn is just stored/displayed — no API scraping possible)
  githubUsername: string; // bare username, e.g. "octocat"
  linkedinUrl?: string;   // full URL
  portfolioUrl?: string;

  // Manually filled profile sections (LinkedIn-equivalent data)
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  certifications: CertificationEntry[];

  // Interests collected on signup (reuse Join page interests list)
  interests: string[];

  is_active: boolean;
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  startYear: string;
  endYear?: string; // blank = present
  grade?: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  date?: string;
  url?: string;
}

// ─── COOKIE HELPERS ───────────────────────────────────────────────────────────

const COOKIE_KEY = "ts_student_session";
const COOKIE_DAYS = 7;

const setCookie = (value: string, days: number) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = typeof window !== "undefined" && window.location?.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict${secure}`;
};

const getCookie = (): string | null => {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_KEY}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
};

const deleteCookie = () => {
  const secure = typeof window !== "undefined" && window.location?.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict${secure}`;
};

// ─── PASSWORD HASHING ─────────────────────────────────────────────────────────

const SALT = "ts_salt_v2_";

/**
 * Deterministic cryptographic SHA-256 hash for password storage.
 * Works synchronously across both browser and Node.js test runners without external dependencies.
 */
export const hashPassword = (password: string): string => {
  const input = `${SALT}${password}`;

  function rotr(n: number, x: number) {
    return (x >>> n) | (x << (32 - n));
  }
  function choose(x: number, y: number, z: number) {
    return (x & y) ^ (~x & z);
  }
  function majority(x: number, y: number, z: number) {
    return (x & y) ^ (x & z) ^ (y & z);
  }
  function sigma0(x: number) {
    return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
  }
  function sigma1(x: number) {
    return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
  }
  function gamma0(x: number) {
    return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
  }
  function gamma1(x: number) {
    return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);
  }

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const utf8 = unescape(encodeURIComponent(input));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >>> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }

  const bitLength = utf8.length * 8;
  words[bitLength >>> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >>> 9) << 4) + 15] = bitLength;

  const W: number[] = new Array(64);
  for (let i = 0; i < words.length; i += 16) {
    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let t = 0; t < 64; t++) {
      if (t < 16) {
        W[t] = words[i + t] || 0;
      } else {
        W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) | 0;
      }

      const T1 = (h + sigma1(e) + choose(e, f, g) + K[t] + W[t]) | 0;
      const T2 = (sigma0(a) + majority(a, b, c)) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + T1) | 0;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  return [H0, H1, H2, H3, H4, H5, H6, H7]
    .map((v) => (v >>> 0).toString(16).padStart(8, "0"))
    .join("");
};

/** Legacy fallback helper for djb2 */
const legacyDjb2 = (password: string): string => {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) ^ password.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(16);
};

export const verifyPassword = (password: string, storedHash: string): boolean => {
  if (storedHash === hashPassword(password)) return true;
  return storedHash === legacyDjb2(password);
};

// ─── STORE ────────────────────────────────────────────────────────────────────

const store = createLocalStore<StudentProfile>("ts_students");

export const getAllStudents = store.getAll;
export const getStudentById = store.getById;
export const deleteStudent = store.delete;

export const getStudentByEmail = (email: string): StudentProfile | null =>
  store.getAll().find((s) => s.email.toLowerCase() === email.toLowerCase()) ?? null;

export const getStudentByGithub = (username: string): StudentProfile | null =>
  store.getAll().find(
    (s) => s.githubUsername.toLowerCase() === username.toLowerCase()
  ) ?? null;

export const createStudent = (
  data: Omit<StudentProfile, "id" | "created_at" | "passwordHash" | "is_active"> & {
    password: string;
  }
): StudentProfile => {
  const { password, ...rest } = data;
  // Guard: email must be unique
  if (getStudentByEmail(rest.email)) {
    throw new Error("EMAIL_EXISTS");
  }
  return store.add({
    ...rest,
    passwordHash: hashPassword(password),
    is_active: true,
  });
};

export const updateStudent = (
  id: string,
  updates: Partial<Omit<StudentProfile, "id" | "created_at" | "passwordHash">>
): StudentProfile | null => store.update(id, updates);

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export interface StudentSession {
  studentId: string;
  githubUsername: string;
  name: string;
  authenticated_at: string;
}

export const signInStudent = (
  email: string,
  password: string
): StudentSession | null => {
  const student = getStudentByEmail(email);
  if (!student || !student.is_active) return null;
  if (!verifyPassword(password, student.passwordHash)) return null;

  const session: StudentSession = {
    studentId: student.id,
    githubUsername: student.githubUsername,
    name: student.name,
    authenticated_at: new Date().toISOString(),
  };
  setCookie(JSON.stringify(session), COOKIE_DAYS);
  return session;
};

export const signOutStudent = () => deleteCookie();

export const getStudentSession = (): StudentSession | null => {
  const raw = getCookie();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudentSession;
  } catch {
    return null;
  }
};

export const isStudentLoggedIn = (): boolean => getStudentSession() !== null;
