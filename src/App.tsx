import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { StudentAuthProvider } from "@/hooks/useStudentAuth";
import { Loader2 } from "lucide-react";
import { getStoredPageVisibility } from "./lib/adminStore";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";

// ─── Eager (critical path) ───────────────────────────────────────────
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedStudentRoute from "./components/ProtectedStudentRoute";
import NotFound from "./pages/NotFound";

// ─── Lazy (loaded on-demand) ─────────────────────────────────────────
const AboutPage         = lazy(() => import("./pages/AboutPage"));
const Join              = lazy(() => import("./pages/Join"));
const Projects          = lazy(() => import("./pages/Projects"));
const ProjectDetail     = lazy(() => import("./pages/ProjectDetail"));
const ProjectLive       = lazy(() => import("./pages/ProjectLive"));
const Events            = lazy(() => import("./pages/Events"));
const EventDetail       = lazy(() => import("./pages/EventDetail"));
const Blog              = lazy(() => import("./pages/Blog"));
const BlogPost          = lazy(() => import("./pages/BlogPost"));
const Resources         = lazy(() => import("./pages/Resources"));
const Gallery           = lazy(() => import("./pages/Gallery"));
const FAQ               = lazy(() => import("./pages/FAQ"));
const Achievements      = lazy(() => import("./pages/Achievements"));
const Socials           = lazy(() => import("./pages/Socials"));
const Publications      = lazy(() => import("./pages/Publications"));
const ContactPage       = lazy(() => import("./pages/Contact"));
const Members           = lazy(() => import("./pages/Members"));
const MemberProfile     = lazy(() => import("./pages/MemberProfile"));
const MemberEdit        = lazy(() => import("./pages/MemberEdit"));
const CertificateVerify = lazy(() => import("./pages/CertificateVerify"));
const PrivacyPolicy     = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService    = lazy(() => import("./pages/TermsOfService"));
const Admin             = lazy(() => import("./pages/Admin"));
const SuperAdmin        = lazy(() => import("./pages/SuperAdmin"));

// ─── Student Learning Hub (Lazy) ──────────────────────────────────
const StudentLayout   = lazy(() => import("./components/student/StudentLayout"));
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const ProblemsList    = lazy(() => import("./pages/student/ProblemsList"));
const ProblemSolve    = lazy(() => import("./pages/student/ProblemSolve"));
const CodePlayground  = lazy(() => import("./pages/student/CodePlayground"));
const LeaderboardPage = lazy(() => import("./pages/student/LeaderboardPage"));
const TypingTestPage  = lazy(() => import("./pages/student/TypingTestPage"));
const QuestionBankPage = lazy(() => import("./pages/student/QuestionBankPage"));

// ─── Global page-load fallback ───────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

// Reads page visibility from localStorage; redirects to / if hidden by admin
function PageGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const pages = getStoredPageVisibility();
  const entry = pages.find(p => p.page_path === path);
  // If explicitly hidden, redirect home
  if (entry && !entry.is_visible) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <StudentAuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <NetworkStatusBanner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* ── Public: Eager ────────────────── */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />

              {/* ── Public: Lazy ─────────────────── */}
              <Route path="/about"   element={<AboutPage />} />
              <Route path="/join"    element={<Join />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/verify/:certificateId" element={<CertificateVerify />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms"   element={<TermsOfService />} />

              {/* ── Guarded content pages ────────── */}
              <Route path="/projects"        element={<PageGuard path="/projects"><Projects /></PageGuard>} />
              <Route path="/projects/:id"    element={<PageGuard path="/projects"><ProjectDetail /></PageGuard>} />
              <Route path="/projects/:id/live" element={<PageGuard path="/projects"><ProjectLive /></PageGuard>} />

              <Route path="/events"      element={<PageGuard path="/events"><Events /></PageGuard>} />
              <Route path="/events/:id"  element={<PageGuard path="/events"><EventDetail /></PageGuard>} />

              <Route path="/blog"        element={<PageGuard path="/blog"><Blog /></PageGuard>} />
              <Route path="/blog/:slug"  element={<PageGuard path="/blog"><BlogPost /></PageGuard>} />

              <Route path="/resources"     element={<PageGuard path="/resources"><Resources /></PageGuard>} />
              <Route path="/gallery"       element={<PageGuard path="/gallery"><Gallery /></PageGuard>} />
              <Route path="/faq"           element={<PageGuard path="/faq"><FAQ /></PageGuard>} />
              <Route path="/achievements"  element={<PageGuard path="/achievements"><Achievements /></PageGuard>} />
              <Route path="/socials"       element={<PageGuard path="/socials"><Socials /></PageGuard>} />
              <Route path="/publications"  element={<PageGuard path="/publications"><Publications /></PageGuard>} />

              {/* ── Student-protected ────────────── */}
              <Route path="/student" element={
                <ProtectedStudentRoute>
                  <Navigate to="/student/problems" replace />
                </ProtectedStudentRoute>
              } />
              <Route path="/student/problems" element={
                <ProtectedStudentRoute>
                  <StudentLayout title="Faculty Assignments & Problems" subtitle="Curated algorithmic challenges">
                    <ProblemsList />
                  </StudentLayout>
                </ProtectedStudentRoute>
              } />
              <Route path="/student/problems/:id" element={
                <ProtectedStudentRoute>
                  <StudentLayout hideHeader>
                    <ProblemSolve />
                  </StudentLayout>
                </ProtectedStudentRoute>
              } />
              <Route path="/student/compiler" element={
                <ProtectedStudentRoute>
                  <StudentLayout hideHeader>
                    <CodePlayground />
                  </StudentLayout>
                </ProtectedStudentRoute>
              } />
              <Route path="/student/leaderboard" element={
                <ProtectedStudentRoute>
                  <StudentLayout title="Campus Leaderboard" subtitle="Inter-college rankings across UTU institutions">
                    <LeaderboardPage />
                  </StudentLayout>
                </ProtectedStudentRoute>
              } />
              <Route path="/student/typing" element={
                <ProtectedStudentRoute>
                  <StudentLayout title="Typing Speed Arena" subtitle="Improve developer keyboard proficiency and accuracy">
                    <TypingTestPage />
                  </StudentLayout>
                </ProtectedStudentRoute>
              } />
              <Route path="/student/question-bank" element={
                <ProtectedStudentRoute>
                  <StudentLayout title="Question Bank" subtitle="Browse academic questions & live papers">
                    <QuestionBankPage />
                  </StudentLayout>
                </ProtectedStudentRoute>
              } />

              <Route path="/members" element={
                <ProtectedStudentRoute><Members /></ProtectedStudentRoute>
              } />
              <Route path="/members/:username" element={
                <ProtectedStudentRoute><MemberProfile /></ProtectedStudentRoute>
              } />
              <Route path="/members/:username/edit" element={
                <ProtectedStudentRoute><MemberEdit /></ProtectedStudentRoute>
              } />

              {/* ── Admin-only ───────────────────── */}
              <Route path="/admin" element={
                <ProtectedRoute requireAdmin>
                  {({ userRole }) => <Admin userRole={userRole} />}
                </ProtectedRoute>
              } />

              {/* ── Super Admin Portal ────────────── */}
              <Route path="/superadmin" element={<SuperAdmin />} />
              <Route path="/super-admin" element={<SuperAdmin />} />

              {/* ── 404 ──────────────────────────── */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </StudentAuthProvider>
  </ThemeProvider>
  </ErrorBoundary>
);

export default App;
