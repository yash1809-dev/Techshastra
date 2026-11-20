/**
 * ResumeDocument — Professional Executive Tech Resume Template (ATS-Compliant).
 *
 * Designed to meet international tech hiring standards (FAANG / Tech Startup standard).
 * High-contrast, clean typography, single-column flow with elegant dividers,
 * categorized technical skills, and structured impact-driven project bullets.
 */

import type { StudentProfile } from "@/lib/studentStore";
import type { GHUser, GHRepo } from "@/lib/githubApi";
import { langPercents } from "@/lib/githubApi";

export type ResumeTemplateId = "ats-single" | "modern-two-col" | "photo-card";

export interface ResumeProjectItem {
  id: string;
  name: string;
  techStack: string;
  link?: string;
  github?: string;
  bullets: string[];
}

export interface ResumeData {
  templateId?: ResumeTemplateId;
  photoUrl?: string;
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  github: string;
  linkedin: string;
  portfolio: string;
  summary: string;
  skills: {
    languages: string;
    frameworks: string;
    developerTools: string;
    coreConcepts: string;
  };
  education: Array<{
    id: string;
    institution: string;
    degree: string;
    field: string;
    startYear: string;
    endYear: string;
    grade?: string;
  }>;
  experience: Array<{
    id: string;
    role: string;
    company: string;
    startDate: string;
    endDate?: string;
    description?: string;
  }>;
  projects: ResumeProjectItem[];
  certifications: Array<{
    id: string;
    name: string;
    issuer: string;
    date?: string;
  }>;
}

const e = (s: string) =>
  (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Generates an intelligent, high-impact default ResumeData object pre-filled
 * with real student details and professional placeholder text where missing.
 */
export const getDefaultResumeData = (
  student: StudentProfile,
  ghUser: GHUser | null,
  repos: GHRepo[] = [],
  langMap: Record<string, number> = {}
): ResumeData => {
  const name = student.name || ghUser?.name || "Student Developer";
  const course = student.course || "B.Tech in Computer Science & Engineering";
  const year = student.year ? `${student.year} Year` : "";

  // Compute top languages from GitHub + profile skills
  const topLangs = langPercents(langMap).slice(0, 6).map((l) => l.lang);
  const allLangs = Array.from(new Set([...topLangs, ...student.skills.filter(s => ["JavaScript", "TypeScript", "Python", "C++", "Java", "C", "Go", "Rust", "HTML/CSS", "SQL"].includes(s))]));
  const defaultLangs = allLangs.length > 0 ? allLangs.join(", ") : "JavaScript, TypeScript, Python, C++, SQL, HTML/CSS";

  // Pre-fill top projects from GitHub repos
  const topRepos = repos
    .filter((r) => !r.fork && !r.archived)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count)
    .slice(0, 3);

  const projects: ResumeProjectItem[] =
    topRepos.length > 0
      ? topRepos.map((r) => ({
          id: String(r.id),
          name: r.name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          techStack: r.language ? `${r.language}, React, Git` : "React, TypeScript, Tailwind CSS",
          link: r.homepage || undefined,
          github: r.html_url,
          bullets: [
            r.description ||
              `Architected and built a responsive full-stack application featuring modular component design and optimized performance.`,
            `Engineered RESTful API integration, dynamic data persistence, and interactive user state management.`,
            `Maintained clean code standards, comprehensive documentation, and deployed production builds to cloud hosting.`,
          ],
        }))
      : [
          {
            id: "sample-proj-1",
            name: "TechShastra Campus Collaboration Hub",
            techStack: "React, TypeScript, Supabase, Tailwind CSS",
            link: "https://techshastra.vmsbutu.live",
            github: `https://github.com/${student.githubUsername || "techshastra"}`,
            bullets: [
              "Engineered an interactive student learning and project collaboration ecosystem for university engineering students.",
              "Implemented secure authentication, real-time leaderboards, and code sandbox execution pipelines.",
              "Designed responsive glassmorphism UI with Tailwind CSS and Framer Motion for high user engagement.",
            ],
          },
          {
            id: "sample-proj-2",
            name: "Algorithmic Problem Solving & Code Runner",
            techStack: "Python, JavaScript, Docker, REST API",
            bullets: [
              "Developed an automated code evaluation sandbox executing multi-language unit tests with sub-second feedback.",
              "Implemented dynamic test case evaluation, memory constraint profiling, and error boundary handling.",
            ],
          },
        ];

  // Education prefill
  const education =
    student.education && student.education.length > 0
      ? student.education.map((ed) => ({
          id: ed.id,
          institution: ed.institution || "Uttarakhand Technical University (VMSB UTU)",
          degree: ed.degree || course,
          field: ed.field || "Computer Science and Engineering",
          startYear: ed.startYear || "2023",
          endYear: ed.endYear || "2027",
          grade: ed.grade || "First Division",
        }))
      : [
          {
            id: "edu-default",
            institution: "Veer Madho Singh Bhandari Uttarakhand Technical University",
            degree: course,
            field: "Computer Science & Engineering",
            startYear: "2023",
            endYear: "2027",
            grade: "CGPA: 8.5 / 10",
          },
        ];

  // Experience prefill
  const experience =
    student.experience && student.experience.length > 0
      ? student.experience
      : [
          {
            id: "exp-default",
            role: "Technical Core Member & Contributor",
            company: "TechShastra Technical Club · UTU",
            startDate: "August 2023",
            endDate: "Present",
            description:
              "Collaborated with peer engineers to build university open-source projects, conducted hands-on coding bootcamps on React and Data Structures, and organized annual technical hackathons.",
          },
        ];

  return {
    templateId: "ats-single",
    photoUrl: student.avatar || ghUser?.avatar_url || "",
    fullName: name,
    headline: `${course}${year ? ` · ${year}` : ""} | Software Developer`,
    email: student.email || "developer@techshastra.edu",
    phone: student.rollNumber ? `Roll: ${student.rollNumber}` : "+91 ••••• •••••",
    location: ghUser?.location || "Dehradun, Uttarakhand, India",
    github: `github.com/${student.githubUsername || ""}`,
    linkedin: student.linkedinUrl ? student.linkedinUrl.replace(/^https?:\/\//, "") : "",
    portfolio: student.portfolioUrl ? student.portfolioUrl.replace(/^https?:\/\//, "") : "",
    summary:
      student.bio ||
      `Passionate Computer Science student and software engineer with solid foundations in data structures, algorithms, and full-stack development. Experienced in building responsive web applications with modern frameworks like React and TypeScript. Eager to solve real-world problems and deliver high-impact software solutions.`,
    skills: {
      languages: defaultLangs,
      frameworks: "React, Next.js, Node.js, Express.js, Tailwind CSS, Vite",
      developerTools: "Git, GitHub, VS Code, Postman, Supabase, Linux, Vercel, Docker",
      coreConcepts: "Data Structures & Algorithms, Object-Oriented Programming, RESTful APIs, Database Design, System Architecture",
    },
    education,
    experience,
    projects,
    certifications: student.certifications || [],
  };
};

/**
 * Template 1: ATS Single-Column (Clean Classic tech standard)
 */
export const generateAtsSingleResumeHTML = (data: ResumeData): string => {
  const contactItems = [
    data.email && `<a href="mailto:${e(data.email)}">✉ ${e(data.email)}</a>`,
    data.phone && `<span>📞 ${e(data.phone)}</span>`,
    data.location && `<span>📍 ${e(data.location)}</span>`,
    data.linkedin && `<a href="https://${e(data.linkedin)}" target="_blank">in/${e(data.linkedin)}</a>`,
    data.github && `<a href="https://${e(data.github)}" target="_blank">⌥ ${e(data.github)}</a>`,
    data.portfolio && `<a href="https://${e(data.portfolio)}" target="_blank">🌐 ${e(data.portfolio)}</a>`,
  ].filter(Boolean);

  const educationHTML = data.education
    .map(
      (ed) => `
      <div class="entry">
        <div class="entry-header">
          <div>
            <strong class="entry-title">${e(ed.institution)}</strong>
            <span class="entry-subtitle">${e(ed.degree)}${ed.field ? ` in ${e(ed.field)}` : ""}${ed.grade ? ` · <span class="highlight">${e(ed.grade)}</span>` : ""}</span>
          </div>
          <span class="entry-date">${e(ed.startYear)} – ${e(ed.endYear || "Present")}</span>
        </div>
      </div>`
    )
    .join("");

  const experienceHTML = data.experience
    .map(
      (exp) => `
      <div class="entry">
        <div class="entry-header">
          <div>
            <strong class="entry-title">${e(exp.role)}</strong>
            <span class="entry-subtitle">@ ${e(exp.company)}</span>
          </div>
          <span class="entry-date">${e(exp.startDate)} – ${e(exp.endDate || "Present")}</span>
        </div>
        ${exp.description ? `<p class="entry-desc">${e(exp.description)}</p>` : ""}
      </div>`
    )
    .join("");

  const projectsHTML = data.projects
    .map((p) => {
      const bulletsHTML = (p.bullets || [])
        .filter((b) => b.trim().length > 0)
        .map((b) => `<li>${e(b)}</li>`)
        .join("");

      return `
      <div class="entry">
        <div class="entry-header">
          <div>
            <strong class="entry-title">${e(p.name)}</strong>
            ${p.techStack ? `<span class="tech-tag">${e(p.techStack)}</span>` : ""}
          </div>
          <div class="entry-links">
            ${p.link ? `<a href="${e(p.link)}" target="_blank" class="link-btn">Live ↗</a>` : ""}
            ${p.github ? `<a href="${e(p.github)}" target="_blank" class="link-btn">Code ↗</a>` : ""}
          </div>
        </div>
        ${bulletsHTML ? `<ul class="bullets">${bulletsHTML}</ul>` : ""}
      </div>`;
    })
    .join("");

  const certsHTML =
    data.certifications && data.certifications.length > 0
      ? data.certifications
          .map(
            (c) => `
        <div class="cert-item">
          <strong>${e(c.name)}</strong> — <span>${e(c.issuer)}</span>${c.date ? ` <span class="entry-date">(${e(c.date)})</span>` : ""}
        </div>`
          )
          .join("")
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(data.fullName)} — ATS Resume</title>
<style>
  @page {
    size: A4 portrait;
    margin: 8mm 12mm 10mm 12mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    background: #ffffff;
    line-height: 1.45;
    font-size: 9.5pt;
    -webkit-font-smoothing: antialiased;
  }
  .resume-container {
    max-width: 210mm;
    margin: 0 auto;
    padding: 12px 16px;
    background: #ffffff;
  }
  header {
    text-align: center;
    border-bottom: 2px solid #2a0f14;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  h1.name {
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #2a0f14;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .headline {
    font-size: 10pt;
    color: #4a4a4a;
    font-weight: 500;
    margin-bottom: 6px;
  }
  .contact-bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    font-size: 8.5pt;
    color: #555555;
  }
  .contact-bar a { color: inherit; text-decoration: none; }
  .contact-bar a:hover { color: #2a0f14; text-decoration: underline; }
  section { margin-bottom: 11px; }
  .section-title {
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #2a0f14;
    border-bottom: 1px solid #dcdcdc;
    padding-bottom: 2px;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e5e5e5;
  }
  .summary-text { font-size: 9pt; color: #333333; line-height: 1.45; text-align: justify; }
  .entry { margin-bottom: 7px; page-break-inside: avoid; }
  .entry:last-child { margin-bottom: 0; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 2px; }
  .entry-title { font-size: 9.5pt; font-weight: 700; color: #111111; }
  .entry-subtitle { font-size: 9pt; color: #444444; margin-left: 4px; font-weight: 400; }
  .entry-date { font-size: 8.5pt; color: #666666; font-style: italic; white-space: nowrap; }
  .entry-desc { font-size: 8.8pt; color: #333333; line-height: 1.4; margin-top: 2px; }
  .entry-links { display: flex; gap: 6px; font-size: 8pt; }
  .link-btn { color: #2a0f14; text-decoration: none; font-weight: 600; background: #f4eff1; padding: 1px 6px; border-radius: 4px; }
  .link-btn:hover { background: #2a0f14; color: #ffffff; }
  .tech-tag { font-size: 8pt; font-weight: 500; color: #555555; background: #f0f0f0; padding: 1px 6px; border-radius: 3px; margin-left: 6px; display: inline-block; }
  .highlight { font-weight: 600; color: #2a0f14; }
  ul.bullets { margin: 3px 0 3px 18px; padding: 0; }
  ul.bullets li { font-size: 8.8pt; color: #333333; line-height: 1.4; margin-bottom: 2px; }
  .skills-table { width: 100%; border-collapse: collapse; font-size: 8.8pt; }
  .skills-table td { padding: 2px 0; vertical-align: top; }
  .skill-category { font-weight: 700; color: #2a0f14; width: 155px; padding-right: 8px; }
  .skill-list { color: #333333; }
  .cert-item { font-size: 8.8pt; color: #333333; margin-bottom: 3px; }
  @media print {
    body { background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .resume-container { padding: 0 !important; max-width: 100% !important; }
    .link-btn { background: none !important; padding: 0 !important; text-decoration: underline !important; }
  }
</style>
</head>
<body>
<div class="resume-container">
  <header>
    <h1 class="name">${e(data.fullName)}</h1>
    ${data.headline ? `<div class="headline">${e(data.headline)}</div>` : ""}
    <div class="contact-bar">${contactItems.join(" • ")}</div>
  </header>
  ${data.summary ? `<section><h2 class="section-title">Professional Summary</h2><p class="summary-text">${e(data.summary)}</p></section>` : ""}
  <section>
    <h2 class="section-title">Technical Skills</h2>
    <table class="skills-table">
      ${data.skills.languages ? `<tr><td class="skill-category">Languages:</td><td class="skill-list">${e(data.skills.languages)}</td></tr>` : ""}
      ${data.skills.frameworks ? `<tr><td class="skill-category">Frameworks & Libraries:</td><td class="skill-list">${e(data.skills.frameworks)}</td></tr>` : ""}
      ${data.skills.developerTools ? `<tr><td class="skill-category">Tools & Cloud:</td><td class="skill-list">${e(data.skills.developerTools)}</td></tr>` : ""}
      ${data.skills.coreConcepts ? `<tr><td class="skill-category">Core Concepts:</td><td class="skill-list">${e(data.skills.coreConcepts)}</td></tr>` : ""}
    </table>
  </section>
  ${data.projects && data.projects.length > 0 ? `<section><h2 class="section-title">Featured Projects</h2>${projectsHTML}</section>` : ""}
  ${data.experience && data.experience.length > 0 ? `<section><h2 class="section-title">Experience & Leadership</h2>${experienceHTML}</section>` : ""}
  <section><h2 class="section-title">Education</h2>${educationHTML}</section>
  ${certsHTML ? `<section><h2 class="section-title">Certifications</h2>${certsHTML}</section>` : ""}
</div>
</body>
</html>`;
};

/**
 * Template 2: Modern Two-Column (Sidebar Layout with Tech Badges)
 */
export const generateModernTwoColResumeHTML = (data: ResumeData): string => {
  const contactLinks = [
    data.email && `<div class="sidebar-item"><span class="icon">✉</span><a href="mailto:${e(data.email)}">${e(data.email)}</a></div>`,
    data.phone && `<div class="sidebar-item"><span class="icon">📞</span><span>${e(data.phone)}</span></div>`,
    data.location && `<div class="sidebar-item"><span class="icon">📍</span><span>${e(data.location)}</span></div>`,
    data.github && `<div class="sidebar-item"><span class="icon">⌥</span><a href="https://${e(data.github)}" target="_blank">${e(data.github)}</a></div>`,
    data.linkedin && `<div class="sidebar-item"><span class="icon">in</span><a href="https://${e(data.linkedin)}" target="_blank">${e(data.linkedin)}</a></div>`,
    data.portfolio && `<div class="sidebar-item"><span class="icon">🌐</span><a href="https://${e(data.portfolio)}" target="_blank">${e(data.portfolio)}</a></div>`,
  ].filter(Boolean);

  const skillsHTML = [
    data.skills.languages && `<div class="sidebar-skill-group"><span class="skill-head">Languages</span><div class="skill-tags">${data.skills.languages.split(",").map(s => `<span class="tag">${e(s.trim())}</span>`).join("")}</div></div>`,
    data.skills.frameworks && `<div class="sidebar-skill-group"><span class="skill-head">Frameworks</span><div class="skill-tags">${data.skills.frameworks.split(",").map(s => `<span class="tag">${e(s.trim())}</span>`).join("")}</div></div>`,
    data.skills.developerTools && `<div class="sidebar-skill-group"><span class="skill-head">Tools & Infra</span><div class="skill-tags">${data.skills.developerTools.split(",").map(s => `<span class="tag">${e(s.trim())}</span>`).join("")}</div></div>`,
    data.skills.coreConcepts && `<div class="sidebar-skill-group"><span class="skill-head">Concepts</span><p class="sidebar-text">${e(data.skills.coreConcepts)}</p></div>`,
  ].filter(Boolean).join("");

  const eduSidebarHTML = data.education
    .map(
      (ed) => `
      <div class="sidebar-entry">
        <strong class="sidebar-bold">${e(ed.institution)}</strong>
        <p class="sidebar-sub">${e(ed.degree)}${ed.field ? ` · ${e(ed.field)}` : ""}</p>
        <div class="sidebar-meta"><span>${e(ed.startYear)} – ${e(ed.endYear || "Present")}</span>${ed.grade ? ` · <span class="accent-text">${e(ed.grade)}</span>` : ""}</div>
      </div>`
    )
    .join("");

  const certsSidebarHTML =
    data.certifications && data.certifications.length > 0
      ? data.certifications
          .map(
            (c) => `
        <div class="sidebar-entry">
          <strong class="sidebar-bold">${e(c.name)}</strong>
          <p class="sidebar-sub">${e(c.issuer)}${c.date ? ` (${e(c.date)})` : ""}</p>
        </div>`
          )
          .join("")
      : "";

  const projectsHTML = data.projects
    .map((p) => {
      const bulletsHTML = (p.bullets || [])
        .filter((b) => b.trim().length > 0)
        .map((b) => `<li>${e(b)}</li>`)
        .join("");

      return `
      <div class="main-entry">
        <div class="entry-header">
          <div>
            <strong class="entry-title">${e(p.name)}</strong>
            ${p.techStack ? `<span class="main-tech-tag">${e(p.techStack)}</span>` : ""}
          </div>
          <div class="entry-links">
            ${p.link ? `<a href="${e(p.link)}" target="_blank" class="link-pill">Live ↗</a>` : ""}
            ${p.github ? `<a href="${e(p.github)}" target="_blank" class="link-pill">Code ↗</a>` : ""}
          </div>
        </div>
        ${bulletsHTML ? `<ul class="main-bullets">${bulletsHTML}</ul>` : ""}
      </div>`;
    })
    .join("");

  const experienceHTML = data.experience
    .map(
      (exp) => `
      <div class="main-entry">
        <div class="entry-header">
          <div>
            <strong class="entry-title">${e(exp.role)}</strong>
            <span class="entry-subtitle">· ${e(exp.company)}</span>
          </div>
          <span class="entry-date">${e(exp.startDate)} – ${e(exp.endDate || "Present")}</span>
        </div>
        ${exp.description ? `<p class="entry-desc">${e(exp.description)}</p>` : ""}
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(data.fullName)} — Modern Two-Column Resume</title>
<style>
  @page { size: A4 portrait; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.4;
    font-size: 9pt;
    -webkit-font-smoothing: antialiased;
  }
  .resume-grid {
    display: flex;
    max-width: 210mm;
    margin: 0 auto;
    border-radius: 8px;
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e2e8f0;
  }
  /* SIDEBAR */
  .sidebar {
    width: 32%;
    background: #f8fafc;
    padding: 16px 14px;
    border-right: 1.5px solid #e2e8f0;
    flex-shrink: 0;
  }
  .avatar-wrap {
    text-align: center;
    margin-bottom: 12px;
  }
  .avatar-img {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #6366f1;
    display: inline-block;
  }
  .avatar-fallback {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: #e0e7ff;
    color: #4f46e5;
    font-size: 24pt;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  }
  .sidebar-section { margin-bottom: 14px; }
  .sidebar-title {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
    color: #4f46e5;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 3px;
    margin-bottom: 8px;
  }
  .sidebar-item {
    font-size: 8pt;
    color: #475569;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    word-break: break-all;
  }
  .sidebar-item a { color: inherit; text-decoration: none; }
  .sidebar-item a:hover { color: #4f46e5; }
  .sidebar-item .icon { font-size: 8.5pt; color: #6366f1; flex-shrink: 0; }
  .sidebar-skill-group { margin-bottom: 6px; }
  .skill-head { font-size: 7.5pt; font-weight: 600; color: #334155; text-transform: uppercase; display: block; margin-bottom: 3px; }
  .skill-tags { display: flex; flex-wrap: wrap; gap: 3px; }
  .tag { font-size: 7pt; background: #e0e7ff; color: #3730a3; padding: 1.5px 5px; border-radius: 4px; font-weight: 500; }
  .sidebar-text { font-size: 7.5pt; color: #64748b; line-height: 1.35; }
  .sidebar-entry { margin-bottom: 6px; }
  .sidebar-bold { font-size: 8pt; color: #0f172a; display: block; line-height: 1.25; }
  .sidebar-sub { font-size: 7.5pt; color: #475569; }
  .sidebar-meta { font-size: 7pt; color: #64748b; }
  .accent-text { color: #4f46e5; font-weight: 600; }

  /* MAIN CONTENT */
  .main-content {
    width: 68%;
    padding: 16px 18px;
  }
  .main-header {
    border-bottom: 2px solid #4f46e5;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  .main-name {
    font-size: 22pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .main-headline {
    font-size: 9.5pt;
    color: #4f46e5;
    font-weight: 600;
    margin-top: 2px;
  }
  .main-section { margin-bottom: 12px; }
  .main-section-title {
    font-size: 9.5pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .main-section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }
  .summary-para { font-size: 8.5pt; color: #334155; line-height: 1.45; text-align: justify; }
  .main-entry { margin-bottom: 8px; page-break-inside: avoid; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .entry-title { font-size: 9pt; font-weight: 700; color: #0f172a; }
  .entry-subtitle { font-size: 8.5pt; color: #475569; font-weight: 500; }
  .entry-date { font-size: 8pt; color: #64748b; font-style: italic; white-space: nowrap; }
  .entry-desc { font-size: 8.2pt; color: #334155; margin-top: 2px; }
  .main-tech-tag { font-size: 7.5pt; font-weight: 500; color: #475569; background: #f1f5f9; padding: 1px 5px; border-radius: 3px; margin-left: 6px; }
  .link-pill { font-size: 7.5pt; color: #4f46e5; text-decoration: none; font-weight: 600; background: #e0e7ff; padding: 1px 6px; border-radius: 4px; }
  .main-bullets { margin: 3px 0 3px 14px; }
  .main-bullets li { font-size: 8.2pt; color: #334155; line-height: 1.35; margin-bottom: 1.5px; }

  @media print {
    body { background: #ffffff !important; }
    .resume-grid { border: none !important; width: 100% !important; max-width: 100% !important; }
    .sidebar { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .tag, .link-pill { background: #e0e7ff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
<div class="resume-grid">
  <!-- LEFT SIDEBAR -->
  <aside class="sidebar">
    ${data.photoUrl ? `
    <div class="avatar-wrap">
      <img src="${e(data.photoUrl)}" alt="${e(data.fullName)}" class="avatar-img" />
    </div>` : `
    <div class="avatar-wrap">
      <div class="avatar-fallback">${e(data.fullName[0]?.toUpperCase() || "S")}</div>
    </div>`}

    <div class="sidebar-section">
      <h3 class="sidebar-title">Contact</h3>
      ${contactLinks.join("")}
    </div>

    <div class="sidebar-section">
      <h3 class="sidebar-title">Technical Stack</h3>
      ${skillsHTML}
    </div>

    <div class="sidebar-section">
      <h3 class="sidebar-title">Education</h3>
      ${eduSidebarHTML}
    </div>

    ${certsSidebarHTML ? `
    <div class="sidebar-section">
      <h3 class="sidebar-title">Certifications</h3>
      ${certsSidebarHTML}
    </div>` : ""}
  </aside>

  <!-- RIGHT MAIN COLUMN -->
  <main class="main-content">
    <div class="main-header">
      <h1 class="main-name">${e(data.fullName)}</h1>
      ${data.headline ? `<div class="main-headline">${e(data.headline)}</div>` : ""}
    </div>

    ${data.summary ? `
    <section class="main-section">
      <h2 class="main-section-title">About & Profile</h2>
      <p class="summary-para">${e(data.summary)}</p>
    </section>` : ""}

    ${data.projects && data.projects.length > 0 ? `
    <section class="main-section">
      <h2 class="main-section-title">Featured Projects</h2>
      ${projectsHTML}
    </section>` : ""}

    ${data.experience && data.experience.length > 0 ? `
    <section class="main-section">
      <h2 class="main-section-title">Experience & Leadership</h2>
      ${experienceHTML}
    </section>` : ""}
  </main>
</div>
</body>
</html>`;
};

/**
 * Template 3: Photo Card Template (Modern Creative Developer Card)
 */
export const generatePhotoCardResumeHTML = (data: ResumeData): string => {
  const contactBadges = [
    data.email && `<span class="badge">✉ ${e(data.email)}</span>`,
    data.phone && `<span class="badge">📞 ${e(data.phone)}</span>`,
    data.location && `<span class="badge">📍 ${e(data.location)}</span>`,
    data.github && `<a href="https://${e(data.github)}" target="_blank" class="badge link-badge">⌥ ${e(data.github)}</a>`,
    data.linkedin && `<a href="https://${e(data.linkedin)}" target="_blank" class="badge link-badge">in/${e(data.linkedin)}</a>`,
    data.portfolio && `<a href="https://${e(data.portfolio)}" target="_blank" class="badge link-badge">🌐 ${e(data.portfolio)}</a>`,
  ].filter(Boolean);

  const projectsHTML = data.projects
    .map((p) => {
      const bulletsHTML = (p.bullets || [])
        .filter((b) => b.trim().length > 0)
        .map((b) => `<li>${e(b)}</li>`)
        .join("");

      return `
      <div class="project-card">
        <div class="card-head">
          <div>
            <strong class="card-title">${e(p.name)}</strong>
            ${p.techStack ? `<span class="pill-tag">${e(p.techStack)}</span>` : ""}
          </div>
          <div class="card-links">
            ${p.link ? `<a href="${e(p.link)}" target="_blank" class="btn-sm">Demo</a>` : ""}
            ${p.github ? `<a href="${e(p.github)}" target="_blank" class="btn-sm">Source</a>` : ""}
          </div>
        </div>
        ${bulletsHTML ? `<ul class="card-bullets">${bulletsHTML}</ul>` : ""}
      </div>`;
    })
    .join("");

  const experienceHTML = data.experience
    .map(
      (exp) => `
      <div class="timeline-item">
        <div class="dot"></div>
        <div class="timeline-content">
          <div class="timeline-head">
            <strong>${e(exp.role)}</strong> · <span class="company">${e(exp.company)}</span>
            <span class="timeline-date">${e(exp.startDate)} – ${e(exp.endDate || "Present")}</span>
          </div>
          ${exp.description ? `<p class="timeline-desc">${e(exp.description)}</p>` : ""}
        </div>
      </div>`
    )
    .join("");

  const educationHTML = data.education
    .map(
      (ed) => `
      <div class="timeline-item">
        <div class="dot"></div>
        <div class="timeline-content">
          <div class="timeline-head">
            <strong>${e(ed.institution)}</strong>
            <span class="timeline-date">${e(ed.startYear)} – ${e(ed.endYear || "Present")}</span>
          </div>
          <p class="timeline-desc">${e(ed.degree)}${ed.field ? ` in ${e(ed.field)}` : ""}${ed.grade ? ` · <span class="accent">${e(ed.grade)}</span>` : ""}</p>
        </div>
      </div>`
    )
    .join("");

  const certsHTML =
    data.certifications && data.certifications.length > 0
      ? data.certifications
          .map(
            (c) => `
        <div class="cert-pill">
          <span class="cert-name">${e(c.name)}</span>
          <span class="cert-by">${e(c.issuer)}</span>
        </div>`
          )
          .join("")
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(data.fullName)} — Creative Card Resume</title>
<style>
  @page { size: A4 portrait; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #0f172a;
    background: #ffffff;
    line-height: 1.4;
    font-size: 8.8pt;
    -webkit-font-smoothing: antialiased;
  }
  .card-container {
    max-width: 210mm;
    margin: 0 auto;
    padding: 10px;
  }
  /* HERO HEADER CARD */
  .hero-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 10px;
  }
  .photo-frame {
    width: 80px;
    height: 80px;
    border-radius: 14px;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 4px 10px rgba(0,0,0,0.06);
    border: 2px solid #8b5cf6;
    background: #ede9fe;
  }
  .photo-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .photo-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26pt;
    font-weight: 700;
    color: #7c3aed;
  }
  .hero-info { flex: 1; min-width: 0; }
  .hero-name {
    font-size: 20pt;
    font-weight: 800;
    color: #1e1b4b;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .hero-headline {
    font-size: 9pt;
    font-weight: 600;
    color: #7c3aed;
    margin-top: 1px;
    margin-bottom: 6px;
  }
  .badge-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .badge {
    font-size: 7.5pt;
    background: #ffffff;
    color: #475569;
    border: 1px solid #cbd5e1;
    padding: 2px 7px;
    border-radius: 12px;
    font-weight: 500;
  }
  .link-badge { text-decoration: none; color: #6d28d9; border-color: #ddd6fe; }
  .link-badge:hover { background: #ede9fe; }

  /* SUMMARY BANNER */
  .summary-banner {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 9px 14px;
    margin-bottom: 10px;
    font-size: 8.5pt;
    color: #334155;
    line-height: 1.4;
  }
  .summary-banner strong { color: #1e1b4b; }

  /* SPLIT LAYOUT */
  .body-split {
    display: flex;
    gap: 12px;
  }
  .col-left { width: 38%; flex-shrink: 0; }
  .col-right { width: 62%; flex-grow: 1; }

  .section-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 9px;
    page-break-inside: avoid;
  }
  .sec-heading {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    color: #6d28d9;
    margin-bottom: 7px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sec-heading::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #ede9fe;
  }

  /* SKILL PILLS */
  .skill-group { margin-bottom: 6px; }
  .skill-group-name { font-size: 7.5pt; font-weight: 600; color: #475569; display: block; margin-bottom: 2px; }
  .pill-container { display: flex; flex-wrap: wrap; gap: 3px; }
  .pill-item { font-size: 7pt; background: #f3f4f6; color: #1f2937; padding: 2px 5px; border-radius: 4px; font-weight: 500; }

  /* TIMELINE */
  .timeline-item {
    position: relative;
    padding-left: 14px;
    margin-bottom: 7px;
  }
  .timeline-item .dot {
    position: absolute;
    left: 0;
    top: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #8b5cf6;
  }
  .timeline-head { font-size: 8.2pt; color: #0f172a; display: flex; justify-content: space-between; flex-wrap: wrap; }
  .timeline-date { font-size: 7.5pt; color: #64748b; font-style: italic; }
  .timeline-desc { font-size: 7.8pt; color: #475569; margin-top: 1px; }
  .company { color: #6d28d9; font-weight: 500; }
  .accent { color: #7c3aed; font-weight: 600; }

  /* PROJECT CARDS */
  .project-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 10px;
    margin-bottom: 7px;
  }
  .card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
  .card-title { font-size: 8.5pt; font-weight: 700; color: #0f172a; }
  .pill-tag { font-size: 7pt; background: #ede9fe; color: #6d28d9; padding: 1px 5px; border-radius: 4px; margin-left: 5px; }
  .card-links { display: flex; gap: 4px; }
  .btn-sm { font-size: 7pt; color: #ffffff; background: #7c3aed; text-decoration: none; padding: 1px 6px; border-radius: 3px; font-weight: 600; }
  .card-bullets { margin: 3px 0 2px 14px; }
  .card-bullets li { font-size: 7.8pt; color: #334155; line-height: 1.35; margin-bottom: 1.5px; }

  /* CERTS */
  .cert-pill {
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    padding: 3px 0;
    border-bottom: 1px dashed #e2e8f0;
  }
  .cert-name { font-weight: 600; color: #1e1b4b; }
  .cert-by { color: #64748b; font-size: 7pt; }

  @media print {
    body { background: #ffffff !important; }
    .hero-card, .project-card, .section-card, .summary-banner {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
</style>
</head>
<body>
<div class="card-container">
  <!-- HERO CARD WITH PHOTO -->
  <header class="hero-card">
    <div class="photo-frame">
      ${data.photoUrl ? `
        <img src="${e(data.photoUrl)}" alt="${e(data.fullName)}" />
      ` : `
        <div class="photo-fallback">${e(data.fullName[0]?.toUpperCase() || "S")}</div>
      `}
    </div>
    <div class="hero-info">
      <h1 class="hero-name">${e(data.fullName)}</h1>
      ${data.headline ? `<div class="hero-headline">${e(data.headline)}</div>` : ""}
      <div class="badge-list">${contactBadges.join("")}</div>
    </div>
  </header>

  ${data.summary ? `
  <div class="summary-banner">
    <strong>Executive Profile: </strong>${e(data.summary)}
  </div>` : ""}

  <div class="body-split">
    <!-- LEFT COLUMN -->
    <div class="col-left">
      <div class="section-card">
        <h3 class="sec-heading">Skills & Tools</h3>
        ${data.skills.languages ? `
        <div class="skill-group">
          <span class="skill-group-name">Languages</span>
          <div class="pill-container">${data.skills.languages.split(",").map(s => `<span class="pill-item">${e(s.trim())}</span>`).join("")}</div>
        </div>` : ""}
        ${data.skills.frameworks ? `
        <div class="skill-group">
          <span class="skill-group-name">Frameworks</span>
          <div class="pill-container">${data.skills.frameworks.split(",").map(s => `<span class="pill-item">${e(s.trim())}</span>`).join("")}</div>
        </div>` : ""}
        ${data.skills.developerTools ? `
        <div class="skill-group">
          <span class="skill-group-name">Dev Tools & Cloud</span>
          <div class="pill-container">${data.skills.developerTools.split(",").map(s => `<span class="pill-item">${e(s.trim())}</span>`).join("")}</div>
        </div>` : ""}
        ${data.skills.coreConcepts ? `
        <div class="skill-group">
          <span class="skill-group-name">Core Competencies</span>
          <p style="font-size: 7.2pt; color: #64748b; line-height: 1.3;">${e(data.skills.coreConcepts)}</p>
        </div>` : ""}
      </div>

      <div class="section-card">
        <h3 class="sec-heading">Education</h3>
        ${educationHTML}
      </div>

      ${certsHTML ? `
      <div class="section-card">
        <h3 class="sec-heading">Certifications</h3>
        ${certsHTML}
      </div>` : ""}
    </div>

    <!-- RIGHT COLUMN -->
    <div class="col-right">
      ${data.projects && data.projects.length > 0 ? `
      <div class="section-card">
        <h3 class="sec-heading">Featured Projects</h3>
        ${projectsHTML}
      </div>` : ""}

      ${data.experience && data.experience.length > 0 ? `
      <div class="section-card">
        <h3 class="sec-heading">Experience & Roles</h3>
        ${experienceHTML}
      </div>` : ""}
    </div>
  </div>
</div>
</body>
</html>`;
};

/**
 * Universal Resume HTML dispatcher supporting all 3 templates
 */
export const generateResumeHTML = (
  data: ResumeData,
  templateId?: ResumeTemplateId
): string => {
  const chosen = templateId || data.templateId || "ats-single";
  switch (chosen) {
    case "modern-two-col":
      return generateModernTwoColResumeHTML(data);
    case "photo-card":
      return generatePhotoCardResumeHTML(data);
    case "ats-single":
    default:
      return generateAtsSingleResumeHTML(data);
  }
};

/**
 * Backwards compatible alias pointing to universal generator
 */
export const generateProfessionalResumeHTML = (data: ResumeData): string => {
  return generateResumeHTML(data, data.templateId || "ats-single");
};

// ─── WINDOW HELPERS ──────────────────────────────────────────────────────────

const openWindow = (html: string): Window | null => {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "width=920,height=800");
  if (!win) {
    alert("Please allow popups in your browser to preview or print your resume.");
    URL.revokeObjectURL(url);
    return null;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return win;
};

/** Open resume in new tab for preview */
export const previewResume = (
  student: StudentProfile,
  ghUser: GHUser | null,
  repos: GHRepo[] = [],
  langMap: Record<string, number> = {}
) => {
  const data = getDefaultResumeData(student, ghUser, repos, langMap);
  openWindow(generateProfessionalResumeHTML(data));
};

/** Open resume in print window then trigger browser print dialog */
export const openResumePrintWindow = (
  student: StudentProfile,
  ghUser: GHUser | null,
  repos: GHRepo[] = [],
  langMap: Record<string, number> = {}
) => {
  const data = getDefaultResumeData(student, ghUser, repos, langMap);
  printResumeData(data);
};

/** Print custom edited resume data */
export const printResumeData = (data: ResumeData) => {
  const win = openWindow(generateProfessionalResumeHTML(data));
  if (win) {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 600);
  }
};
