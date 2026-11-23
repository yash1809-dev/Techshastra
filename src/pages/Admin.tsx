/**
 * Admin Dashboard Page
 * 
 * The central management interface for TECHSHASTRA admins.
 * This page allows managing:
 * - Projects: Add/Remove technical projects
 * - Blog: Create and publish articles
 * - Events: Schedule club activities
 * - Gallery: Upload campus and event photos
 * - Research: Manage publications and books
 * - Super Admin: System-wide visibility toggles and user management
 * 
 * It uses local state for form management and persists data via custom stores in src/lib/.
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, FileText, Calendar, Image, Trophy, HelpCircle, MessageSquare, Users, Plus, Trash2, Github, Globe, Terminal, Loader2, Award, Newspaper, Eye, EyeOff, Book, ShieldCheck, LogOut, Ban, UserCheck, UserX, ToggleLeft, ToggleRight, UserPlus, Phone, CalendarDays, Copy, Key, Mail, RotateCcw, ClipboardList, X, Check, ShieldAlert, CheckCircle2, Instagram, Linkedin, Twitter, Facebook, Link, Hash, Upload, Download, Code2, BookOpen, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { parseGitHubUrl } from "@/lib/projectStore";
import { generateSlug } from "@/lib/blogStore";
import { getAdminUsers, blockAdmin, unblockAdmin, getAllPageVisibility, togglePageVisibility, createAdminCredential, getStoredCredentials, deleteAdminCredential, setSuperAdminCredentials, isSuperAdminDefault, updateAdminRole, type AdminCredential, type PageVisibility, type AdminRole, subscribeToAdminLoginRequests, approveAdminLoginRequest, rejectAdminLoginRequest, type AdminLoginRequest } from "@/lib/adminStore";
import { addLogEntry, clearLog, getLogEntries, revertEntry, saveCredentialsRaw, type LogEntry } from "@/lib/activityLogStore";
import { useAdminPresence } from "@/hooks/use-admin-presence";
import { Badge } from "@/components/ui/badge";
import CertificateSender from "@/components/CertificateSender";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { exportAllData, importAllData, clearAllData, getStorageSize } from "@/lib/dataBackup";
// ── Supabase Service Layer (replaces all localStorage stores) ─────────────────
import * as projectService from "@/lib/services/projectService";
import * as blogService from "@/lib/services/blogService";
import * as galleryService from "@/lib/services/galleryService";
import * as eventService from "@/lib/services/eventService";
import * as achievementService from "@/lib/services/achievementService";
import * as faqService from "@/lib/services/faqService";
import * as messageService from "@/lib/services/messageService";
import * as socialService from "@/lib/services/socialService";
import * as publicationService from "@/lib/services/publicationService";
import type { Project } from "@/lib/services/projectService";
import type { BlogPost } from "@/lib/services/blogService";
import type { GalleryPhoto as GalleryImage } from "@/lib/services/galleryService";
import type { Event } from "@/lib/services/eventService";
import type { Achievement } from "@/lib/services/achievementService";
import type { FAQ } from "@/lib/services/faqService";
import type { ContactMessage } from "@/lib/services/messageService";
import type { SocialLink as SocialPost } from "@/lib/services/socialService";
import type { Publication } from "@/lib/services/publicationService";
import * as studentService from "@/lib/services/studentService";
import { addSocialPost as addLocalSocialPost, deleteSocialPost as deleteLocalSocialPost } from "@/lib/stores/socialStore";
import { addProject as addLocalProject } from "@/lib/projectStore";
import { getAllStudents, updateStudent as updateStudentStore, type StudentProfile } from "@/lib/studentStore";
import AdminProblemsTab from "@/components/admin/AdminProblemsTab";
import { AcademicQuestionBankTab } from "@/components/admin/academic/AcademicQuestionBankTab";
import AdminRolePromotionsTab from "@/components/admin/AdminRolePromotionsTab";
import AdminLeadersTab from "@/components/admin/AdminLeadersTab";
import AdminDignitariesTab from "@/components/admin/AdminDignitariesTab";
import { canPromoteRoles } from "@/lib/services/hierarchyService";

// Legacy type aliases for shapes not yet fully migrated
type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
type BlogCategory = 'blog' | 'news' | 'announcement';
type PublicationType = 'paper' | 'book' | 'thesis' | 'article';

// ── Shared Configuration ───────────────────────────────────────────────────
const CATEGORY_LABELS: Record<BlogCategory, string> = {
  blog: "Blog",
  news: "News",
  announcement: "Announcement",
};

const CATEGORY_COLORS: Record<BlogCategory, string> = {
  blog: "default",
  news: "secondary",
  announcement: "outline",
};

interface AdminProps {
  userRole: AdminRole;
}

// ── Change Super Admin Credentials Card ───────────────────────────────────────

const ChangeSuperAdminCard = ({
  actor,
  onChanged,
}: {
  actor: string;
  onChanged: () => void;
}) => {
  const { toast } = useToast();
  const [name, setName]       = useState("");
  const [mobile, setMobile]   = useState("");
  const [dob, setDob]         = useState("");
  const [confirm, setConfirm] = useState("");
  const [open, setOpen]       = useState(false);

  const isDefault = isSuperAdminDefault();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || !dob) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    if (name.trim().toLowerCase() !== confirm.trim().toLowerCase()) {
      toast({ title: "Name confirmation doesn't match", variant: "destructive" }); return;
    }
    setSuperAdminCredentials(name.trim(), mobile.trim(), dob).then(() => {
      addLogEntry({ actor, action: "Changed super admin credentials", type: "create_credential", revertible: false });
      toast({ title: "Super admin credentials updated ✓", description: "Use your new Name + Mobile + DOB to log in next time." });
      setName(""); setMobile(""); setDob(""); setConfirm(""); setOpen(false);
      onChanged();
    }).catch(() => {
      // Still update locally even if Supabase sync fails
      addLogEntry({ actor, action: "Changed super admin credentials", type: "create_credential", revertible: false });
      toast({ title: "Super admin credentials updated ✓", description: "Use your new Name + Mobile + DOB to log in next time." });
      setName(""); setMobile(""); setDob(""); setConfirm(""); setOpen(false);
      onChanged();
    });
  };

  return (
    <Card className={isDefault ? "border-amber-500/40 bg-amber-500/5" : "border-primary/20"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Key className="w-4 h-4 text-amber-500" />
          Super Admin Credentials
          {isDefault && (
            <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-[10px] ml-1">
              ⚠ Default — change now
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Change the Name, Mobile, and Date of Birth used to log in as Super Admin.
          {isDefault && " Default credentials are insecure — update them immediately."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button variant={isDefault ? "default" : "outline"} size="sm"
            className="gap-2" onClick={() => setOpen(true)}>
            <Key className="w-3.5 h-3.5" />
            {isDefault ? "Set New Credentials (Required)" : "Change Credentials"}
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="New name" required autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mobile</Label>
                <Input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="10-digit" required autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date of Birth</Label>
                <Input type="date" value={dob} onChange={e => setDob(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Confirm — re-type your name</Label>
              <Input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Type name again" required autoComplete="off" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">Save New Credentials</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

// ── Students Tab ──────────────────────────────────────────────────────────────

const StudentsTab = () => {
  const [students, setStudents] = useState<any[]>([]);
  const { toast } = useToast();

  const loadStudents = async () => {
    try {
      const data = await studentService.getAllStudents(true);
      if (data && data.length > 0) {
        setStudents(data);
        return;
      }
    } catch (_err) {
      // Fallback
    }
    setStudents(getAllStudents());
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const toggleActive = async (s: any) => {
    const newStatus = !s.is_active;
    try {
      await studentService.updateStudentProfile(s.id, { is_active: newStatus });
    } catch (_err) {
      // Fallback
    }
    updateStudentStore(s.id, { is_active: newStatus });
    setStudents((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: newStatus } : x)));
    toast({ title: newStatus ? `${s.name || s.username} reactivated` : `${s.name || s.username} deactivated` });
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" /> Registered Students
          </CardTitle>
          <CardDescription>{students.length} members · deactivating hides the profile from other students</CardDescription>
        </CardHeader>
      </Card>

      {students.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground font-light">No students have signed up yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {students.map((s) => {
            const handle = s.githubUsername || s.github_username || s.username || "user";
            const displayName = s.name || s.username || "Student";
            return (
              <Card key={s.id} className={`border-primary/10 transition-opacity ${s.is_active ? "" : "opacity-60"}`}>
                <CardContent className="py-4 flex items-center gap-4 flex-wrap">
                  <img
                    src={s.avatar || s.avatar_url || (s.profiles?.avatar_url) || `https://avatars.githubusercontent.com/${handle}?s=40`}
                    alt={displayName}
                    className="w-10 h-10 rounded-xl ring-2 ring-primary/20 flex-shrink-0 object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{displayName}</span>
                      <Badge variant={s.is_active ? "default" : "destructive"} className="text-[10px] font-light">
                        {s.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-3">
                      {s.email && <span>{s.email}</span>}
                      <span>@{handle}</span>
                      {s.course && <span>{s.course}{s.year ? ` · ${s.year}` : ""}</span>}
                      <span>Joined {new Date(s.created_at || Date.now()).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={`/members/${handle}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="rounded-full gap-1 text-xs">
                        <Github className="w-3 h-3" /> View
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant={s.is_active ? "destructive" : "outline"}
                      className="rounded-full text-xs"
                      onClick={() => toggleActive(s)}
                    >
                      {s.is_active ? <><UserX className="w-3 h-3 mr-1" />Deactivate</> : <><UserCheck className="w-3 h-3 mr-1" />Reactivate</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Admin = ({ userRole }: AdminProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isSuperAdmin = userRole === "super_admin";
  const isFaculty = !isSuperAdmin && userRole === "faculty";
  const isMember = !isSuperAdmin && !isFaculty;

  // Default tab depends on role: faculty lands on problems, others on overview
  const defaultTab = isFaculty ? "problems" : "overview";
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || defaultTab);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Admin");

  // Live students for Overview card
  const [liveStudents, setLiveStudents] = useState<any[]>([]);

  // Get current user info on mount - using sessionStorage from custom auth
  useEffect(() => {
    const raw = sessionStorage.getItem("ts_admin_session");
    if (raw) {
      try {
        const session = JSON.parse(raw);
        setCurrentUserId(session.role); // Use role as ID for presence
        setCurrentUserName(session.name || "Admin");
      } catch (_e) {
        setCurrentUserName("Admin");
      }
    }
  }, []);

  // Sync tab from URL param changes (e.g. navigating to /admin?tab=super-admin)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  // Load live students for overview stats
  useEffect(() => {
    studentService.getAllStudents(true).then(data => {
      if (data && data.length > 0) setLiveStudents(data);
      else setLiveStudents(getAllStudents());
    }).catch(() => setLiveStudents(getAllStudents()));
  }, []);

  // Presence tracking (only active when Super Admin or for all admins to broadcast)
  const { onlineAdmins, activityLog, broadcastAction: trackAction } = useAdminPresence(
    currentUserId,
    currentUserName,
    activeTab
  );

  // ── Admin Login Approvals (Super Admin Only) ──────────────────────────────
  const [pendingRequests, setPendingRequests] = useState<AdminLoginRequest[]>([]);
  const [allRequests, setAllRequests] = useState<AdminLoginRequest[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsubscribe = subscribeToAdminLoginRequests((reqs) => {
      setAllRequests(reqs);
      setPendingRequests(reqs.filter((r) => r.status === "pending"));
    });
    return () => unsubscribe();
  }, [isSuperAdmin]);

  const handleApproveAdminLogin = (requestId: string) => {
    const req = allRequests.find((r) => r.id === requestId);
    const updated = approveAdminLoginRequest(requestId, currentUserName);
    if (updated) {
      // If this was a NEW registration request, create the admin credential now
      if (req?.isNewRegistration) {
        const reqRole: AdminRole = req.role === "faculty" ? "faculty" : "member";
        try {
          createAdminCredential(
            updated.adminName,
            updated.mobile,
            updated.dob,
            reqRole
          );
        } catch (_e) {
          console.warn("Failed to auto-create admin credential on approval:", _e);
        }
        toast({
          title: "Admin Registered ✓",
          description: `${updated.adminName} has been registered as an admin and their session is now active.`,
        });
        trackAction(`Registered new admin: ${updated.adminName}`);
      } else {
        toast({
          title: "Access Confirmed ✓",
          description: `Approved login for ${updated.adminName}.`,
        });
        trackAction(`Approved admin login: ${updated.adminName}`);
      }
    }
  };

  const handleRejectAdminLogin = (requestId: string) => {
    const updated = rejectAdminLoginRequest(requestId, currentUserName);
    if (updated) {
      toast({
        title: "Access Rejected",
        description: `Rejected login for ${updated.adminName}.`,
        variant: "destructive",
      });
      trackAction(`Rejected admin login: ${updated.adminName}`);
    }
  };

  // ── Projects state ──────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    github: string;
    demo: string;
    image: string;
    tags: string;
    lead: string;
    designer: string;
    status: "Completed" | "In Progress";
    language: "javascript" | "python" | "other";
  }>({
    title: "",
    description: "",
    github: "",
    demo: "",
    image: "",
    tags: "",
    lead: "",
    designer: "",
    status: "Completed",
    language: "javascript"
  });

  // ── Blog state ───────────────────────────────────────────────────────────────
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogForm, setBlogForm] = useState<{
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    image_url: string;
    category: BlogCategory;
    author: string;
    published: boolean;
  }>({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    image_url: "",
    category: "blog",
    author: "",
    published: true,
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // ── Gallery state ────────────────────────────────────────────────────────────
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryForm, setGalleryForm] = useState<{
    title: string;
    description: string;
    image_url: string;
  }>({
    title: "",
    description: "",
    image_url: "",
  });

  // ── Publications state ───────────────────────────────────────────────────────
  const [publications, setPublications] = useState<Publication[]>([]);
  const [pubForm, setPubForm] = useState<{
    title: string;
    authors: string;
    description: string;
    type: PublicationType;
    link_url: string;
    file_url: string;
  }>({
    title: "",
    authors: "",
    description: "",
    type: "paper",
    link_url: "",
    file_url: "",
  });

  // ── Events state ─────────────────────────────────────────────────────────────
  const [events, setEvents] = useState<Event[]>([]);
  const [eventForm, setEventForm] = useState<{
    title: string;
    description: string;
    date: string;
    location: string;
    image_url: string;
    status: EventStatus;
  }>({
    title: "",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    location: "Main Campus",
    image_url: "",
    status: "upcoming",
  });

  // ── Achievements state ───────────────────────────────────────────────────────
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achievementForm, setAchievementForm] = useState<{
    title: string;
    description: string;
    date: string;
    image_url: string;
  }>({
    title: "",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    image_url: "",
  });

  // ── FAQ state ────────────────────────────────────────────────────────────────
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [faqForm, setFaqForm] = useState<{
    question: string;
    answer: string;
    category: string;
  }>({
    question: "",
    answer: "",
    category: "General",
  });

  // ── Socials state ───────────────────────────────────────────────────────────
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [socialForm, setSocialForm] = useState<{
    platform: string;
    post_url: string;
    content: string;
    image_url: string;
    username: string;
  }>({
    platform: "instagram",
    post_url: "",
    content: "",
    image_url: "",
    username: "",
  });
  const [isFetchingSocial, setIsFetchingSocial] = useState(false);

  // ── Messages state ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ContactMessage[]>([]);

  // ── Super Admin state ─────────────────────────────────────────────────────────
  const [adminUsers, setAdminUsers] = useState<AdminCredential[]>([]);
  const [newCredRole, setNewCredRole] = useState<"member" | "faculty">("member");
  const [pages, setPages] = useState<PageVisibility[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [superAdminLoading, setSuperAdminLoading] = useState(false);
  // credential list is kept in state so changes re-render without page refresh
  const [credsList, setCredsList] = useState(() => getStoredCredentials());
  // persistent activity log
  const [logEntries, setLogEntries] = useState<LogEntry[]>(() => getLogEntries());

  const refreshCredsAndLog = () => {
    setCredsList(getStoredCredentials());
    setLogEntries(getLogEntries());
  };

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadSupabaseData();
    if (isSuperAdmin) {
      loadSuperAdminData();
    }
  }, []);

  const loadSupabaseData = async () => {
    try {
      const [evts, achs, fqs, msgs, projs, posts, imgs, socials, pubs] = await Promise.all([
        eventService.getEvents(),
        achievementService.getAchievements(),
        faqService.getFAQs(),
        messageService.getContactMessages(),
        projectService.getProjects(),
        blogService.getBlogPosts(),
        galleryService.getGalleryPhotos(),
        socialService.getSocialLinks(),
        publicationService.getPublications(),
      ]);
      setEvents(evts);
      setAchievements(achs);
      setFaqs(fqs);
      setMessages(msgs);
      setProjects(projs);
      setBlogPosts(posts);
      setGalleryImages(imgs);
      setSocialPosts(socials);
      setPublications(pubs);
    } catch (err: any) {
      console.error("Failed to load data from Supabase", err);
    }
  };

  const loadSuperAdminData = async () => {
    setSuperAdminLoading(true);
    const [users, pageData] = await Promise.all([
      getAdminUsers(),
      getAllPageVisibility(),
    ]);
    setAdminUsers(users);
    setPages(pageData);
    setSuperAdminLoading(false);
  };

  const handleRemoveAdmin = async (userId: string, name?: string) => {
    deleteAdminCredential(userId);
    setAdminUsers(prev => prev.filter(u => u.id !== userId));
    toast({ title: "Admin Removed", description: `${name || "User"} has been removed from admin roster.` });
  };

  const handleBlockAdmin = async (userId: string, name?: string) => {
    blockAdmin(userId, blockReason || undefined);
    setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: true, block_reason: blockReason || undefined } : u));
    setBlockReason("");
    toast({ title: "Admin Blocked", description: `${name || "User"} has been blocked from accessing the admin panel.` });
  };

  const handleUnblockAdmin = async (userId: string, name?: string) => {
    unblockAdmin(userId);
    setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: false, block_reason: undefined } : u));
    toast({ title: "Admin Unblocked", description: `${name || "User"} can now access the admin panel again.` });
  };

  const handleTogglePage = async (page: PageVisibility) => {
    await togglePageVisibility(page.id);
    setPages(prev => prev.map(p => p.id === page.id ? { ...p, is_visible: !p.is_visible } : p));
    toast({ title: page.is_visible ? "Page Hidden" : "Page Visible", description: `${page.page_name} is now ${page.is_visible ? "hidden from" : "visible to"} visitors.` });
  };

  // ── Project helpers ──────────────────────────────────────────────────────────
  const generateProjectImage = (title: string, description: string, tags: string) => {
    const encodedTitle = encodeURIComponent(title.slice(0, 60));
    const encodedText = encodeURIComponent((description || tags || 'A TECHSHASTRA project').slice(0, 100));
    return `https://og.tailgraph.com/og?fontFamily=Inter&title=${encodedTitle}&text=${encodedText}&bgColor=0f172a&titleColor=a855f7&textColor=94a3b8&bgImage=&logoText=TECHSHASTRA`;
  };

  const fetchRepoMetadata = async (url: string) => {
    const gitInfo = parseGitHubUrl(url);
    if (!gitInfo) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo)",
        variant: "destructive"
      });
      return;
    }

    setIsFetching(true);
    try {
      const [repoRes, readmeRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${gitInfo.owner}/${gitInfo.repo}`),
        fetch(`https://api.github.com/repos/${gitInfo.owner}/${gitInfo.repo}/readme`).catch(() => null),
      ]);

      const inferredTitle = gitInfo.repo
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

      if (!repoRes.ok) {
        // Fallback gracefully (e.g. GitHub unauthenticated rate limit or public repo)
        const autoImage = generateProjectImage(inferredTitle, `A project by ${gitInfo.owner}`, "GitHub");
        setFormData(prev => ({
          ...prev,
          github: url,
          title: prev.title || inferredTitle,
          description: prev.description || `Open source project "${inferredTitle}" by ${gitInfo.owner}.`,
          image: prev.image || autoImage,
        }));
        toast({
          title: "Repo Parsed",
          description: `Imported project "${inferredTitle}". (GitHub API rate-limited; fields populated from repo name).`
        });
        return;
      }

      const data = await repoRes.json();

      let readmeDescription = "";
      if (readmeRes && readmeRes.ok) {
        try {
          const readmeData = await readmeRes.json();
          let decoded = "";
          try {
            const binaryString = atob((readmeData.content || "").replace(/\s/g, ""));
            const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
            decoded = new TextDecoder().decode(bytes);
          } catch (_e) {
            decoded = atob((readmeData.content || "").replace(/\s/g, ""));
          }
          const plainText = decoded
            .replace(/#{1,6}\s+.*/g, "")
            .replace(/!\[.*?\]\(.*?\)/g, "")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .replace(/[`*_~]/g, "")
            .replace(/<!--[\s\S]*?-->/g, "")
            .trim();
          const firstParagraph = plainText.split(/\n{2,}/).find((p: string) => p.trim().length > 30);
          if (firstParagraph) readmeDescription = firstParagraph.trim().replace(/\n/g, " ").slice(0, 300);
        } catch (_readmeErr) {
          // ignore readme parse error, data.description is still available
        }
      }

      let detectedLang: "javascript" | "python" | "other" = "other";
      const ghLang = data.language?.toLowerCase() || "";
      if (["javascript", "typescript", "typescriptreact", "javascriptreact"].includes(ghLang)) {
        detectedLang = "javascript";
      } else if (ghLang === "python") {
        detectedLang = "python";
      }

      const finalTitle = data.name
        ? data.name
            .replace(/-/g, " ")
            .replace(/_/g, " ")
            .replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
        : inferredTitle;

      const finalDescription = readmeDescription || data.description || `A project by ${gitInfo.owner}.`;
      const finalTags = data.topics?.length ? data.topics.join(", ") : (data.language ? data.language : "Web, Open Source");
      const autoImage = generateProjectImage(finalTitle, finalDescription, finalTags);

      setFormData(prev => ({
        ...prev,
        github: url,
        title: prev.title || finalTitle,
        description: prev.description || finalDescription,
        language: detectedLang,
        tags: prev.tags || finalTags,
        image: prev.image || autoImage,
      }));

      toast({
        title: "✅ Metadata Fetched",
        description: `Imported details for "${finalTitle}"${readmeDescription ? " (including README)" : ""}. Image auto-generated.`
      });
    } catch (err: any) {
      console.error("Fetch metadata error", err);
      const fallbackTitle = gitInfo.repo
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
      setFormData(prev => ({
        ...prev,
        github: url,
        title: prev.title || fallbackTitle,
        image: prev.image || generateProjectImage(fallbackTitle, "Project", "GitHub"),
      }));
      toast({
        title: "Repo Parsed",
        description: `Populated project title from "${gitInfo.repo}". Please verify fields.`
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    // Auto-fetch removed: use the "Fetch" button instead to avoid GitHub API rate limits
    // and partial-URL errors from keystroke-level triggers.
  };

  const handleSelectChange = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid File", description: "Please upload an image file.", variant: "destructive" });
        return;
      }
      // Compress image via canvas before storing as base64 to avoid localStorage quota issues
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = document.createElement('img') as HTMLImageElement;
        img.onload = () => {
          const MAX_W = 800;
          const MAX_H = 450;
          let { width, height } = img;
          if (width > MAX_W || height > MAX_H) {
            const ratio = Math.min(MAX_W / width, MAX_H / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          setFormData(prev => ({ ...prev, image: compressed }));
          toast({ title: "Image Uploaded", description: "Project preview image compressed and uploaded successfully." });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.github) {
      toast({ title: "Missing GitHub URL", description: "Please provide a GitHub repository URL.", variant: "destructive" });
      return;
    }
    const gitInfo = parseGitHubUrl(formData.github);
    const finalTitle = formData.title || (gitInfo ? gitInfo.repo.replace(/-/g, " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) : "Untitled Project");

    try {
      let newProj: any = null;
      try {
        newProj = await projectService.createProject({
          title: finalTitle,
          description: formData.description || "A project by TECHSHASTRA member.",
          github_url: formData.github,
          demo_url: formData.demo?.trim() || null,
          image_url: formData.image || generateProjectImage(finalTitle, formData.description || "", formData.tags),
          tags: formData.tags.split(",").map(t => t.trim()).filter(t => t),
          lead_name: formData.lead || "TECHSHASTRA Team",
          designer_name: formData.designer || "Design Team",
          status: formData.status,
          language: formData.language,
          is_published: true,
        });
      } catch (err) {
        console.warn("Supabase project insert failed, saving to local store:", err);
      }

      if (!newProj) {
        // Fallback to local projectStore
        const local = addLocalProject({
          title: finalTitle,
          description: formData.description || "A project by TECHSHASTRA member.",
          github: formData.github,
          demo: formData.demo?.trim() || "",
          image: formData.image || generateProjectImage(finalTitle, formData.description || "", formData.tags),
          tags: formData.tags.split(",").map(t => t.trim()).filter(t => t),
          team: { lead: formData.lead || "TECHSHASTRA Team", designer: formData.designer || "Design Team" },
          status: formData.status,
          language: formData.language,
        });
        newProj = {
          ...local,
          github_url: local.github,
          demo_url: local.demo,
          image_url: local.image,
          lead_name: local.team.lead,
          designer_name: local.team.designer,
          is_published: true,
          created_at: new Date(local.createdAt).toISOString(),
          updated_at: new Date(local.createdAt).toISOString(),
        };
      }

      if (newProj) {
        setProjects(prev => [newProj, ...prev]);
        setFormData({ title: "", description: "", github: "", demo: "", image: "", tags: "", lead: "", designer: "", status: "Completed", language: "javascript" });
        toast({ title: "Project Published ✓", description: `"${newProj.title}" is now live on the projects page.` });
        trackAction(`Added project: ${newProj.title}`);
      }
    } catch (err: any) {
      console.error("Submission failed", err);
      toast({
        title: "Submission Failed",
        description: err.message || "An error occurred while saving. Check console for details.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await projectService.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      toast({ title: "Project Deleted", description: "The project has been removed." });
      trackAction("Deleted a project");
    } catch (err: any) {
      toast({ title: "Delete Failed", description: "Could not remove project.", variant: "destructive" });
    }
  };

  // ── Blog helpers ─────────────────────────────────────────────────────────────
  const handleBlogInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    if (id === "blog-title") {
      setBlogForm(prev => ({
        ...prev,
        title: value,
        slug: slugManuallyEdited ? prev.slug : generateSlug(value),
      }));
    } else if (id === "blog-slug") {
      setSlugManuallyEdited(true);
      setBlogForm(prev => ({ ...prev, slug: value }));
    } else {
      const key = id.replace("blog-", "") as keyof typeof blogForm;
      setBlogForm(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleBlogImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid File", description: "Please upload an image file.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setBlogForm(prev => ({ ...prev, image_url: reader.result as string }));
        toast({ title: "Image Uploaded", description: "Cover image uploaded successfully." });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBlogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blogForm.title.trim()) {
      toast({ title: "Missing Title", description: "Please enter a post title.", variant: "destructive" });
      return;
    }
    if (!blogForm.excerpt.trim()) {
      toast({ title: "Missing Excerpt", description: "Please enter a short excerpt/summary.", variant: "destructive" });
      return;
    }
    if (!blogForm.content.trim()) {
      toast({ title: "Missing Content", description: "Please enter the post content.", variant: "destructive" });
      return;
    }
    try {
      const newPost = await blogService.createBlogPost({
        title: blogForm.title.trim(),
        slug: blogForm.slug || generateSlug(blogForm.title),
        excerpt: blogForm.excerpt.trim(),
        content: blogForm.content.trim(),
        image_url: blogForm.image_url || null,
        published: blogForm.published,
        published_at: new Date().toISOString(),
        category: blogForm.category,
        author_name: blogForm.author || currentUserName || "TechShastra Team",
        author_id: null,
      });

      if (newPost) {
        setBlogPosts(prev => [newPost, ...prev]);
        setBlogForm({ title: "", slug: "", excerpt: "", content: "", image_url: "", category: "blog", author: "", published: true });
        setSlugManuallyEdited(false);
        toast({ title: "✅ Post Published!", description: `"${newPost.title}" is now live.` });
        trackAction(`Published blog: ${newPost.title}`);
      }
    } catch (err: any) {
      console.error("Blog submission failed", err);
      toast({
        title: "Publish Failed",
        description: err.message || "An error occurred while saving the post.",
        variant: "destructive"
      });
    }
  };

  const handleBlogDelete = async (id: string) => {
    try {
      await blogService.deleteBlogPost(id);
      setBlogPosts(prev => prev.filter(p => p.id !== id));
      toast({ title: "Post Deleted", description: "The post has been removed." });
      trackAction("Deleted a blog post");
    } catch (err: any) {
      toast({ title: "Delete Failed", description: "Could not remove post.", variant: "destructive" });
    }
  };

  const handleTogglePublish = async (post: BlogPost) => {
    try {
      await blogService.updateBlogPost(post.id, { published: !post.published });
      setBlogPosts(prev => prev.map(p => p.id === post.id ? { ...p, published: !post.published } : p));
      toast({ title: post.published ? "Post Unpublished" : "Post Published", description: `"${post.title}" visibility updated.` });
    } catch (err: any) {
      toast({ title: "Update Failed", description: "Could not update publish status.", variant: "destructive" });
    }
  };

  // ── Gallery helpers ──────────────────────────────────────────────────────────
  const handleGalleryInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    const key = id.replace("gallery-", "") as keyof typeof galleryForm;
    setGalleryForm(prev => ({ ...prev, [key]: value }));
  };

  const handleGalleryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid File", description: "Please upload an image file.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setGalleryForm(prev => ({ ...prev, image_url: reader.result as string }));
        toast({ title: "Image Uploaded", description: "Gallery image uploaded successfully." });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGallerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryForm.title.trim()) {
      toast({ title: "Missing Title", description: "Please enter an image title.", variant: "destructive" });
      return;
    }
    if (!galleryForm.image_url) {
      toast({ title: "Missing Image", description: "Please upload an image or provide a URL.", variant: "destructive" });
      return;
    }
    try {
      const newImage = await galleryService.createGalleryPhoto({
        title: galleryForm.title.trim(),
        description: galleryForm.description.trim() || null,
        image_url: galleryForm.image_url,
        category: "General",
      });

      if (newImage) {
        setGalleryImages(prev => [newImage, ...prev]);
        setGalleryForm({ title: "", description: "", image_url: "" });
        toast({ title: "✅ Image Added!", description: "The image is now live." });
        trackAction("Added gallery image");
      }
    } catch (err: any) {
      console.error("Gallery upload failed", err);
      toast({
        title: "Upload Failed",
        description: err.message || "An error occurred while saving the image.",
        variant: "destructive"
      });
    }
  };

  const handleGalleryDelete = async (id: string) => {
    try {
      await galleryService.deleteGalleryPhoto(id);
      setGalleryImages(prev => prev.filter(img => img.id !== id));
      toast({ title: "Image Deleted", description: "The image has been removed." });
      trackAction("Deleted gallery image");
    } catch (err: any) {
      toast({ title: "Delete Failed", description: "Could not remove image.", variant: "destructive" });
    }
  };

  // ── Publications helpers ────────────────────────────────────────────────────
  const handlePubInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    const key = id.replace("pub-", "") as keyof typeof pubForm;
    setPubForm(prev => ({ ...prev, [key]: value }));
  };

  const handlePubSelectChange = (value: string) => {
    setPubForm(prev => ({ ...prev, type: value as PublicationType }));
  };

  const handlePubFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({ title: "Invalid File", description: "Please upload a PDF file.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPubForm(prev => ({ ...prev, file_url: reader.result as string }));
        toast({ title: "File Uploaded", description: "PDF file saved locally." });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubForm.title.trim() || !pubForm.authors.trim()) {
      toast({ title: "Missing Fields", description: "Title and Authors are required.", variant: "destructive" });
      return;
    }
    if (!pubForm.link_url && !pubForm.file_url) {
      toast({ title: "Missing Resource", description: "Provide either a link or upload a PDF.", variant: "destructive" });
      return;
    }
    try {
      const newPub = await publicationService.createPublication({
        title: pubForm.title.trim(),
        authors: pubForm.authors.trim(),
        description: pubForm.description.trim() || "Research publication by TECHSHASTRA member.",
        type: (pubForm.type as any) || "paper",
        link_url: pubForm.link_url.trim() || null,
        file_url: pubForm.file_url || null,
        published_at: new Date().toISOString(),
      });
      if (newPub) {
        setPublications(prev => [newPub, ...prev]);
        setPubForm({ title: "", authors: "", description: "", type: "paper", link_url: "", file_url: "" });
        toast({ title: "✅ Publication Added!", description: "It is now visible in the Research & Books section." });
        trackAction(`Added publication: ${pubForm.title}`);
      }
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message || "Could not save the publication.", variant: "destructive" });
    }
  };

  const handlePubDelete = async (id: string) => {
    try {
      await publicationService.deletePublication(id);
      setPublications(prev => prev.filter(p => p.id !== id));
      toast({ title: "Publication Deleted", description: "Removed from the records." });
      trackAction("Deleted a publication");
    } catch (err: any) {
      toast({ title: "Delete Failed", description: "Could not remove publication.", variant: "destructive" });
    }
  };

  // ── Events handlers ──────────────────────────────────────────────────────────
  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim()) {
      toast({ title: "Missing Title", description: "Event title is required.", variant: "destructive" });
      return;
    }
    try {
      const newEvent = await eventService.createEvent({
        title: eventForm.title.trim(),
        description: eventForm.description.trim() || "TECHSHASTRA event",
        event_date: new Date(eventForm.date).toISOString(),
        location: eventForm.location || "Main Campus",
        image_url: eventForm.image_url || null,
        status: eventForm.status,
        featured: false,
      });
      if (newEvent) {
        setEvents(prev => [newEvent, ...prev]);
        setEventForm({ title: "", description: "", date: format(new Date(), "yyyy-MM-dd"), location: "Main Campus", image_url: "", status: "upcoming" });
        toast({ title: "Event Added", description: `"${newEvent.title}" has been scheduled.` });
        trackAction(`Added event: ${newEvent.title}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add event.", variant: "destructive" });
    }
  };

  const handleEventDelete = async (id: string) => {
    try {
      await eventService.deleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
      toast({ title: "Event Deleted", description: "Event has been removed." });
      trackAction("Deleted an event");
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to delete event.", variant: "destructive" });
    }
  };

  // ── Achievements handlers ────────────────────────────────────────────────────
  const handleAchievementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!achievementForm.title.trim()) {
      toast({ title: "Missing Title", description: "Achievement title is required.", variant: "destructive" });
      return;
    }
    try {
      const newAchievement = await achievementService.createAchievement({
        title: achievementForm.title.trim(),
        description: achievementForm.description.trim() || "Achievement milestone",
        achievement_date: achievementForm.date || format(new Date(), "yyyy-MM-dd"),
        image_url: achievementForm.image_url || null,
      });
      if (newAchievement) {
        setAchievements(prev => [newAchievement, ...prev]);
        setAchievementForm({ title: "", description: "", date: format(new Date(), "yyyy-MM-dd"), image_url: "" });
        toast({ title: "Achievement Added", description: `"${newAchievement.title}" added to the trophy case.` });
        trackAction(`Added achievement: ${newAchievement.title}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add achievement.", variant: "destructive" });
    }
  };

  const handleAchievementDelete = async (id: string) => {
    try {
      await achievementService.deleteAchievement(id);
      setAchievements(prev => prev.filter(a => a.id !== id));
      toast({ title: "Achievement Deleted", description: "Removed from trophy case." });
      trackAction("Deleted an achievement");
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to delete achievement.", variant: "destructive" });
    }
  };

  // ── Socials handlers ─────────────────────────────────────────────────────────
  const handleSocialImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid File", description: "Please upload an image file (PNG/JPG).", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = document.createElement('img') as HTMLImageElement;
        img.onload = () => {
          const MAX_W = 800;
          const MAX_H = 800;
          let { width, height } = img;
          if (width > MAX_W || height > MAX_H) {
            const ratio = Math.min(MAX_W / width, MAX_H / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.75);
          setSocialForm(prev => ({ ...prev, image_url: compressed }));
          toast({ title: "Image Uploaded ✓", description: "Attached post photo successfully." });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchSocialMetadata = async (url: string) => {
    if (!url || !url.includes("http")) return;
    setIsFetchingSocial(true);
    try {
      let platform = "instagram";
      if (url.includes("linkedin.com")) platform = "linkedin";
      if (url.includes("twitter.com") || url.includes("x.com")) platform = "twitter";
      if (url.includes("facebook.com")) platform = "facebook";

      let detectedUsername = "techshastra_utu";
      const instaMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i);
      if (instaMatch) {
        platform = "instagram";
        detectedUsername = "techshastra_utu";
      } else {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split("/").filter(p => p && p !== "p" && p !== "reel" && p !== "in");
        if (pathParts[0]) detectedUsername = pathParts[0];
      }

      setSocialForm(prev => ({
        ...prev,
        platform,
        username: prev.username || detectedUsername,
        content: prev.content || `New update from TECHSHASTRA on ${platform.charAt(0).toUpperCase() + platform.slice(1)}!`,
        // Do NOT set defunct source.unsplash.com! Preserve image if already set
        image_url: prev.image_url || "",
      }));

      toast({ title: "Link Detected", description: `Identified ${platform} post. You can also upload the post photo directly.` });
    } catch (err) {
      console.error("Failed to parse social URL", err);
    } finally {
      setIsFetchingSocial(false);
    }
  };

  const handleSocialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialForm.post_url.trim()) {
      toast({ title: "Missing URL", description: "Social post URL is required.", variant: "destructive" });
      return;
    }
    try {
      let finalImageUrl = socialForm.image_url?.trim() || null;
      // If user accidentally pasted the instagram post URL as the image URL, clear it so it doesn't break
      if (finalImageUrl && (finalImageUrl.includes("instagram.com/p/") || finalImageUrl.includes("instagram.com/reel/"))) {
        finalImageUrl = null;
      }

      let newPost: any = null;
      try {
        newPost = await socialService.createSocialLink({
          platform: (socialForm.platform as any) || 'instagram',
          url: socialForm.post_url.trim(),
          content: socialForm.content.trim() || "",
          image_url: finalImageUrl,
          author: socialForm.username.trim() || null,
          posted_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Supabase social insert failed, saving to local store:", err);
      }

      if (!newPost) {
        // Fallback to local store
        newPost = await addLocalSocialPost({
          platform: (socialForm.platform as any) || 'instagram',
          url: socialForm.post_url.trim(),
          content: socialForm.content.trim() || "",
          image_url: finalImageUrl || undefined,
          author: socialForm.username.trim() || "techshastra_utu",
          posted_at: new Date().toISOString(),
        });
      }

      if (newPost) {
        setSocialPosts(prev => [newPost, ...prev]);
        setSocialForm({ platform: "instagram", post_url: "", content: "", image_url: "", username: "" });
        toast({ title: "Social Post Added ✓", description: "The post is now live on the Socials page." });
        trackAction(`Added social post: ${newPost.platform}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add social post.", variant: "destructive" });
    }
  };

  const handleSocialDelete = async (id: string) => {
    try {
      try {
        await socialService.deleteSocialLink(id);
      } catch (_) {}
      try {
        await deleteLocalSocialPost(id);
      } catch (_) {}
      setSocialPosts(prev => prev.filter(p => p.id !== id));
      toast({ title: "Post Deleted", description: "Social post removed." });
      trackAction("Deleted a social post");
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to delete social post.", variant: "destructive" });
    }
  };

  // ── FAQ handlers ─────────────────────────────────────────────────────────────
  const handleFAQSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      toast({ title: "Missing Fields", description: "Question and Answer are required.", variant: "destructive" });
      return;
    }
    try {
      const newFAQ = await faqService.createFAQ({
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        category: faqForm.category.trim(),
        order_index: faqs.length,
      });
      if (newFAQ) {
        setFaqs(prev => [...prev, newFAQ]);
        setFaqForm({ question: "", answer: "", category: "General" });
        toast({ title: "FAQ Added", description: "Question added to FAQ list." });
        trackAction("Added FAQ entry");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add FAQ.", variant: "destructive" });
    }
  };

  const handleFAQDelete = async (id: string) => {
    try {
      await faqService.deleteFAQ(id);
      setFaqs(prev => prev.filter(f => f.id !== id));
      toast({ title: "FAQ Deleted", description: "Entry removed." });
      trackAction("Deleted FAQ entry");
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to delete FAQ.", variant: "destructive" });
    }
  };

  // ── Messages handlers ────────────────────────────────────────────────────────
  const handleMessageDelete = async (id: string) => {
    try {
      await messageService.deleteContactMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      toast({ title: "Message Deleted", description: "Message removed from inbox." });
      trackAction("Deleted a message");
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to delete message.", variant: "destructive" });
    }
  };

  const handleMarkAsRead = async (id: string, read: boolean) => {
    try {
      await messageService.updateMessageStatus(id, read ? 'read' : 'new');
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: read ? 'read' : 'new' } : m));
    } catch (err: any) {
      console.error("Failed to update message status", err);
    }
  };

  const publishedBlogCount = blogPosts.filter(p => p.published).length;

  const handleSignOut = () => {
    sessionStorage.removeItem("ts_admin_session");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />

      <main className="container mx-auto px-4 py-24">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3 mb-1.5">
              <h1 className="text-2xl sm:text-4xl font-bold">Admin Dashboard</h1>
              <Badge variant={isSuperAdmin ? "default" : isFaculty ? "outline" : "secondary"} className="text-[10px] sm:text-xs">
                {isSuperAdmin ? "⭐ Super Admin" : isFaculty ? "🎓 Faculty" : "👥 Member"}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isFaculty ? "Manage student problems & coding tasks" : "Manage your tech club content and settings"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2 self-start sm:self-auto h-9">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>

        {/* ── Top Floating Pending Requests Banner for Super Admin ── */}
        {isSuperAdmin && pendingRequests.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 shadow-lg backdrop-blur animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="relative flex h-3.5 w-3.5 mt-1 sm:mt-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm sm:text-base">
                      {pendingRequests.some(r => r.isNewRegistration) ? "Admin Access Request" : "Admin Login Confirmation Required"}
                    </h3>
                    <Badge variant="outline" className="text-amber-600 border-amber-500/50 bg-amber-500/10 text-[11px]">
                      {pendingRequests.length} pending
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pendingRequests.some(r => r.isNewRegistration)
                      ? "Someone is requesting admin access. Approve to create their account, or reject to deny."
                      : "An admin has entered valid credentials and is waiting for your authorization to access the panel."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pendingRequests.slice(0, 2).map((req) => (
                  <div key={req.id} className="flex items-center gap-2 bg-background/90 p-1.5 px-3 rounded-lg border border-amber-500/30 text-xs shadow-sm">
                    <span className="font-medium text-foreground">{req.adminName}</span>
                    {req.isNewRegistration && <Badge className="text-[9px] h-4 px-1.5 bg-blue-500/20 text-blue-600 border-blue-500/30" variant="outline">NEW</Badge>}
                    <span className="text-[10px] text-muted-foreground hidden lg:inline">({req.device})</span>
                    <Button
                      size="sm"
                      className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                      onClick={() => handleApproveAdminLogin(req.id)}
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => handleRejectAdminLogin(req.id)}
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                ))}
                {pendingRequests.length > 2 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-amber-600 hover:text-amber-700"
                    onClick={() => setActiveTab("super-admin")}
                  >
                    View all ({pendingRequests.length})
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="w-full flex overflow-x-auto no-scrollbar scroll-smooth md:flex-wrap h-auto glass bg-white/40 dark:bg-white/5 p-1.5 gap-1.5 rounded-2xl border border-white/30 dark:border-white/10">
            {/* Members & SuperAdmin see overview/club tabs */}
            {!isFaculty && (<TabsTrigger value="overview" className="shrink-0 text-xs py-2 px-3 rounded-xl"><LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />Overview</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="projects" className="shrink-0 text-xs py-2 px-3 rounded-xl"><FileText className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Projects</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="events" className="shrink-0 text-xs py-2 px-3 rounded-xl"><Calendar className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Events</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="blog" className="shrink-0 text-xs py-2 px-3 rounded-xl"><Newspaper className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Blog</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="gallery" className="shrink-0 text-xs py-2 px-3 rounded-xl"><Image className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Gallery</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="socials" className="shrink-0 text-xs py-2 px-3 rounded-xl"><Hash className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Socials</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="publications" className="shrink-0 text-xs py-2 px-3 rounded-xl"><Book className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Research</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="awards" className="shrink-0 text-xs py-2 px-3 rounded-xl"><Trophy className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Awards</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="faq" className="shrink-0 text-xs py-2 px-3 rounded-xl"><HelpCircle className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />FAQ</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="messages" className="shrink-0 text-xs py-2 px-3 rounded-xl"><MessageSquare className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Messages</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="certificates" className="shrink-0 text-xs py-2 px-3 rounded-xl"><Award className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Certs</TabsTrigger>)}
            {!isFaculty && (<TabsTrigger value="students" className="shrink-0 text-xs py-2 px-3 rounded-xl"><Users className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Students</TabsTrigger>)}
            {/* Faculty & SuperAdmin see Problems & Academic Question Bank tabs */}
            {(isFaculty || isSuperAdmin) && (
              <>
                <TabsTrigger value="problems" className="shrink-0 text-xs py-2 px-3 rounded-xl"><Code2 className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Coding Challenges</TabsTrigger>
                <TabsTrigger value="academic-questions" className="shrink-0 text-xs py-2 px-3 rounded-xl"><BookOpen className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Academic Question Bank</TabsTrigger>
              </>
            )}
            {(isSuperAdmin || canPromoteRoles(userRole, currentUserName)) && (
              <TabsTrigger value="promotions" className="shrink-0 text-xs py-2 px-3 rounded-xl bg-amber-500/10 text-amber-500 font-medium relative">
                <Crown className="w-3.5 h-3.5 mr-1.5" />Leadership & Promotions
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="super-admin" className="shrink-0 text-xs py-2 px-3 rounded-xl bg-primary/10 text-primary relative">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Super Admin
                {pendingRequests.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-white font-semibold">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
            )}
            {!isFaculty && (
              <TabsTrigger value="dignitaries" className="shrink-0 text-xs py-2 px-3 rounded-xl">
                <Crown className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />Home Dignitaries
              </TabsTrigger>
            )}
            {!isFaculty && (
              <TabsTrigger value="leaders" className="shrink-0 text-xs py-2 px-3 rounded-xl">
                <Users className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />About Mentors
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Registered Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{liveStudents.filter(s => s.is_active).length}</div>
                  <p className="text-xs text-muted-foreground">{liveStudents.length} total · {liveStudents.filter(s => !s.is_active).length} inactive</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Projects</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{projects.length}</div>
                  <p className="text-xs text-muted-foreground">In showcase</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{events.filter(ev => ev.status === "upcoming").length}</div>
                  <p className="text-xs text-muted-foreground">{events.length} total events</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Blog Posts</CardTitle>
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{publishedBlogCount}</div>
                  <p className="text-xs text-muted-foreground">{blogPosts.length - publishedBlogCount} drafts</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Projects ── */}
          <TabsContent value="projects">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 h-fit glass border-white/30 dark:border-white/10 shadow-glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground font-heading">
                    <Plus className="w-5 h-5 text-primary" />
                    Add New Project
                  </CardTitle>
                  <CardDescription className="text-foreground/70">Enter GitHub repository details to add a live project.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="github" className="text-foreground font-medium text-xs">GitHub Repository URL</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            {isFetching ? (
                              <Loader2 className="absolute left-3 top-3 w-4 h-4 text-primary animate-spin" />
                            ) : (
                              <Github className="absolute left-3 top-3 w-4 h-4 text-foreground/50" />
                            )}
                            <Input
                              id="github"
                              placeholder="https://github.com/user/repo"
                              className="pl-10 h-11 bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground placeholder:text-foreground/40 shadow-xs focus-visible:ring-primary/20"
                              value={formData.github}
                              onChange={handleInputChange}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isFetching || !formData.github.includes("github.com")}
                            onClick={() => fetchRepoMetadata(formData.github)}
                            className="h-11 px-4 glass border-white/30 dark:border-white/10 font-medium"
                          >
                            Fetch
                          </Button>
                        </div>
                        <p className="text-[11px] text-foreground/60 italic font-light px-1">
                          * Paste URL and click Fetch to auto-populate title, description and tech
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-foreground font-medium text-xs">Project Title</Label>
                      <Input
                        id="title"
                        placeholder="Project Name"
                        value={formData.title}
                        onChange={handleInputChange}
                        className="bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground placeholder:text-foreground/40 shadow-xs focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-foreground font-medium text-xs">Short Description</Label>
                      <Textarea
                        id="description"
                        placeholder="What does this project do?"
                        value={formData.description}
                        onChange={handleInputChange}
                        className="bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground placeholder:text-foreground/40 shadow-xs focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="demo" className="text-foreground font-medium text-xs">
                        Live Demo / Deployment URL (Optional)
                      </Label>
                      <Input
                        id="demo"
                        placeholder="e.g. https://myproject.vercel.app or https://myproject.netlify.app"
                        value={formData.demo}
                        onChange={handleInputChange}
                        className="bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground placeholder:text-foreground/40 text-xs shadow-xs focus-visible:ring-primary/20"
                      />
                      <p className="text-[11px] text-foreground/60 italic font-light px-1">
                        * When provided, visitors can run and interact with the deployed live demo directly in the viewer!
                      </p>
                    </div>

                    <div className="space-y-2 p-4 rounded-2xl glass border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/5">
                      <Label htmlFor="image" className="flex items-center gap-2 text-foreground font-medium text-xs">
                        Project Preview Image
                        <span className="text-[10px] text-foreground/60 font-normal bg-foreground/5 px-2 py-0.5 rounded-full">auto-generated if empty</span>
                      </Label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input type="file" accept="image/*" onChange={handleImageUpload} className="flex-1 bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-xs" />
                          <span className="text-xs text-foreground/60 whitespace-nowrap">or</span>
                        </div>
                        <Input
                          id="image"
                          placeholder="Paste image URL here"
                          value={formData.image}
                          onChange={handleInputChange}
                          className="bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground placeholder:text-foreground/40 text-xs shadow-xs"
                        />
                        {formData.image && (
                          <div className="relative w-full h-32 rounded-xl overflow-hidden glass border-white/30 dark:border-white/10">
                            <img
                              src={formData.image}
                              alt="Preview"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/400x200?text=Invalid+Image"; }}
                            />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-foreground/60">
                        Optional — if left blank, an image will be auto-generated from the repo name and description.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="language" className="text-foreground font-medium text-xs">Execution Tech</Label>
                        <Select value={formData.language} onValueChange={(v) => handleSelectChange("language", v)}>
                          <SelectTrigger className="bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground shadow-xs">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="glass border-white/30 dark:border-white/10">
                            <SelectItem value="javascript">JS / React (StackBlitz)</SelectItem>
                            <SelectItem value="python">Python (Pyodide)</SelectItem>
                            <SelectItem value="other">Other (Static)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status" className="text-foreground font-medium text-xs">Status</Label>
                        <Select value={formData.status} onValueChange={(v) => handleSelectChange("status", v)}>
                          <SelectTrigger className="bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground shadow-xs">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="glass border-white/30 dark:border-white/10">
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lead" className="text-foreground font-medium text-xs">Team Lead</Label>
                        <Input
                          id="lead"
                          placeholder="Lead name"
                          value={formData.lead}
                          onChange={handleInputChange}
                          className="bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground shadow-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="designer" className="text-foreground font-medium text-xs">UI Designer</Label>
                        <Input
                          id="designer"
                          placeholder="Designer name"
                          value={formData.designer}
                          onChange={handleInputChange}
                          className="bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tags" className="text-foreground font-medium text-xs">Tags (comma separated)</Label>
                      <Input
                        id="tags"
                        placeholder="React, AI, IoT"
                        value={formData.tags}
                        onChange={handleInputChange}
                        className="bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground shadow-xs"
                      />
                    </div>

                    <Button type="submit" className="w-full shadow-md font-medium tracking-wide">Publish Project</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 glass border-white/30 dark:border-white/10 shadow-glass">
                <CardHeader>
                  <CardTitle className="text-foreground font-heading">Currently Published Projects</CardTitle>
                  <CardDescription className="text-foreground/70">A list of projects added by admins via this dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.length === 0 ? (
                      <div className="text-center py-12 glass border-dashed border-white/30 rounded-2xl">
                        <p className="text-foreground/60 italic font-light">No admin-added projects yet.</p>
                      </div>
                    ) : (
                      projects.map((project) => (
                        <div key={project.id} className="flex items-center justify-between p-4 glass rounded-2xl border-white/25 dark:border-white/10 hover:bg-white/40 dark:hover:bg-white/5 transition-all">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 border-white/20 flex items-center justify-center text-primary">
                              {project.github_url?.includes("python") ? <Terminal className="w-6 h-6 text-primary" /> : <Globe className="w-6 h-6 text-primary" />}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-foreground">{project.title}</h4>
                              <p className="text-xs text-foreground/60 truncate max-w-[300px]">{project.github_url}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="default" className="text-[10px] px-2 py-0 font-medium">
                                  {project.tags?.[0] || 'Project'}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-2 py-0 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10 font-semibold">
                                  Supabase Persistent
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(project.id)} className="text-destructive hover:bg-destructive/10 rounded-xl">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Events ── */}
          <TabsContent value="events">
            <div className="grid lg:grid-cols-5 gap-6">
              <Card className="lg:col-span-2 h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Schedule New Event
                  </CardTitle>
                  <CardDescription>Add workshops, hackathons or seminars.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleEventSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="event-title">Event Title *</Label>
                      <Input
                        id="event-title"
                        placeholder="e.g. AI Bootcamp 2025"
                        value={eventForm.title}
                        onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="event-date">Date</Label>
                        <Input
                          id="event-date"
                          type="date"
                          value={eventForm.date}
                          onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="event-status">Status</Label>
                        <Select value={eventForm.status} onValueChange={(v) => setEventForm(prev => ({ ...prev, status: v as any }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="upcoming">Upcoming</SelectItem>
                            <SelectItem value="ongoing">Ongoing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-location">Location</Label>
                      <Input
                        id="event-location"
                        placeholder="e.g. Seminar Hall A"
                        value={eventForm.location}
                        onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-description">Short Description</Label>
                      <Textarea
                        id="event-description"
                        placeholder="Brief summary of the event..."
                        rows={3}
                        value={eventForm.description}
                        onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-image">Image URL</Label>
                      <Input
                        id="event-image"
                        placeholder="https://..."
                        value={eventForm.image_url}
                        onChange={(e) => setEventForm(prev => ({ ...prev, image_url: e.target.value }))}
                      />
                    </div>
                    <Button type="submit" className="w-full">Create Event</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Upcoming & Past Events</CardTitle>
                  <CardDescription>Manage your club's activity calendar.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {events.length === 0 ? (
                      <div className="text-center py-12 border border-dashed rounded-xl">
                        <p className="text-muted-foreground italic">No events found in Supabase.</p>
                      </div>
                    ) : (
                      events.map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium text-sm">{event.title}</h4>
                              <p className="text-xs text-muted-foreground">{format(new Date(event.event_date), "MMM d, yyyy")} • {event.location}</p>
                              <Badge variant="outline" className="text-[9px] mt-1 h-4">
                                {event.status.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleEventDelete(event.id)} className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Blog & News ── */}
          <TabsContent value="blog">
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Add Post Form */}
              <Card className="lg:col-span-2 h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    New Blog / News Post
                  </CardTitle>
                  <CardDescription>Write and publish posts that appear on the Blog & News page.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleBlogSubmit} className="space-y-4">
                    {/* Category */}
                    <div className="space-y-2">
                      <Label>Post Type</Label>
                      <Select value={blogForm.category} onValueChange={(v) => setBlogForm(prev => ({ ...prev, category: v as BlogCategory }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blog">📝 Blog Post</SelectItem>
                          <SelectItem value="news">📰 News</SelectItem>
                          <SelectItem value="announcement">📢 Announcement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="blog-title">Title *</Label>
                      <Input
                        id="blog-title"
                        placeholder="Enter post title..."
                        value={blogForm.title}
                        onChange={handleBlogInputChange}
                      />
                    </div>

                    {/* Slug */}
                    <div className="space-y-2">
                      <Label htmlFor="blog-slug" className="flex items-center gap-2">
                        URL Slug
                        <span className="text-[10px] text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-full">auto-generated</span>
                      </Label>
                      <Input
                        id="blog-slug"
                        placeholder="url-friendly-slug"
                        value={blogForm.slug}
                        onChange={handleBlogInputChange}
                      />
                      <p className="text-[10px] text-muted-foreground px-1">
                        /blog/<span className="text-primary">{blogForm.slug || "your-slug-here"}</span>
                      </p>
                    </div>

                    {/* Author */}
                    <div className="space-y-2">
                      <Label htmlFor="blog-author">Author Name</Label>
                      <Input
                        id="blog-author"
                        placeholder="TECHSHASTRA Team"
                        value={blogForm.author}
                        onChange={handleBlogInputChange}
                      />
                    </div>

                    {/* Excerpt */}
                    <div className="space-y-2">
                      <Label htmlFor="blog-excerpt">Excerpt / Summary *</Label>
                      <Textarea
                        id="blog-excerpt"
                        placeholder="A short summary shown on the blog listing page..."
                        rows={2}
                        value={blogForm.excerpt}
                        onChange={handleBlogInputChange}
                      />
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                      <Label htmlFor="blog-content">Full Content *</Label>
                      <Textarea
                        id="blog-content"
                        placeholder="Write your full post here. Use blank lines to separate paragraphs..."
                        rows={8}
                        value={blogForm.content}
                        onChange={handleBlogInputChange}
                        className="font-mono text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground px-1">
                        Tip: Leave a blank line between paragraphs for proper formatting.
                      </p>
                    </div>

                    {/* Cover Image */}
                    <div className="space-y-2 p-4 rounded-lg bg-muted/30 border border-primary/20">
                      <Label className="flex items-center gap-2">
                        Cover Image
                        <span className="text-[10px] text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-full">optional</span>
                      </Label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input type="file" accept="image/*" onChange={handleBlogImageUpload} className="flex-1" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">or</span>
                        </div>
                        <Input
                          id="blog-image_url"
                          placeholder="Paste image URL here"
                          value={blogForm.image_url}
                          onChange={handleBlogInputChange}
                        />
                        {blogForm.image_url && (
                          <div className="relative w-full h-28 rounded-lg overflow-hidden border border-primary/20">
                            <img
                              src={blogForm.image_url}
                              alt="Cover preview"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/400x200?text=Invalid+Image"; }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Publish toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">Publish immediately</p>
                        <p className="text-xs text-muted-foreground">Toggle off to save as draft</p>
                      </div>
                      <Switch
                        checked={blogForm.published}
                        onCheckedChange={(v) => setBlogForm(prev => ({ ...prev, published: v }))}
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      {blogForm.published ? "🚀 Publish Post" : "💾 Save as Draft"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Posts List */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>All Posts</span>
                    <div className="flex gap-2 text-sm font-normal">
                      <Badge variant="default">{publishedBlogCount} Published</Badge>
                      <Badge variant="secondary">{blogPosts.length - publishedBlogCount} Drafts</Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>Manage all blog posts, news, and announcements.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {blogPosts.length === 0 ? (
                      <div className="text-center py-16 border border-dashed rounded-xl">
                        <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-muted-foreground italic">No posts yet. Create your first post!</p>
                      </div>
                    ) : (
                      blogPosts.map((post) => (
                        <div
                          key={post.id}
                          className={`flex items-start justify-between p-4 border rounded-xl transition-colors ${post.published ? "hover:bg-primary/5" : "opacity-60 bg-muted/20"}`}
                        >
                          <div className="flex gap-3 flex-1 min-w-0">
                            {post.image_url ? (
                              <img
                                src={post.image_url}
                                alt={post.title}
                                className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-6 h-6 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge variant="secondary" className="text-[9px] px-2 py-0">
                                  Post
                                </Badge>
                                {!post.published && (
                                  <Badge variant="outline" className="text-[9px] px-2 py-0 text-amber-600 border-amber-600">
                                    Draft
                                  </Badge>
                                )}
                                {post.id.startsWith('sample-') && (
                                  <Badge variant="outline" className="text-[9px] px-2 py-0 border-blue-400 text-blue-500">
                                    Sample
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-medium text-sm leading-tight truncate">{post.title}</h4>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{post.excerpt}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {post.published_at ? format(new Date(post.published_at), "MMM d, yyyy") : "Draft"} · Supabase
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            {!post.id.startsWith('sample-') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleTogglePublish(post)}
                                  className={post.published ? "text-green-600 hover:bg-green-50" : "text-muted-foreground hover:bg-muted"}
                                  title={post.published ? "Unpublish" : "Publish"}
                                >
                                  {post.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleBlogDelete(post.id)}
                                  className="text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Certificates ── */}
          {/* ── Publications ── */}
          <TabsContent value="publications">
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Add Publication Form */}
              <Card className="lg:col-span-2 h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Book className="w-5 h-5 text-primary" />
                    Add Research / Book
                  </CardTitle>
                  <CardDescription>Share research papers and books with the community.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePubSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="pub-title">Publication Title *</Label>
                        <Input
                          id="pub-title"
                          placeholder="Project name or book title..."
                          value={pubForm.title}
                          onChange={handlePubInputChange}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="pub-authors">Authors *</Label>
                        <Input
                          id="pub-authors"
                          placeholder="List of contributors..."
                          value={pubForm.authors}
                          onChange={handlePubInputChange}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pub-type">Type</Label>
                      <Select value={pubForm.type} onValueChange={handlePubSelectChange}>
                        <SelectTrigger id="pub-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paper">Research Paper</SelectItem>
                          <SelectItem value="book">Book</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pub-description">Description</Label>
                      <Textarea
                        id="pub-description"
                        placeholder="Abstract or summary..."
                        rows={3}
                        value={pubForm.description}
                        onChange={handlePubInputChange}
                      />
                    </div>

                    <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-primary/10">
                      <div className="space-y-2">
                        <Label htmlFor="pub-link_url">External Link</Label>
                        <Input
                          id="pub-link_url"
                          placeholder="https://..."
                          value={pubForm.link_url}
                          onChange={handlePubInputChange}
                        />
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">or upload PDF</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Input type="file" accept="application/pdf" onChange={handlePubFileUpload} />
                        {pubForm.file_url && (
                          <p className="text-[10px] text-green-600 font-medium">✅ PDF Ready to save</p>
                        )}
                      </div>
                    </div>

                    <Button type="submit" className="w-full">💾 Save Publication</Button>
                  </form>
                </CardContent>
              </Card>

              {/* Publications List */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Directory</CardTitle>
                  <CardDescription>Manage published papers and books.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {publications.length === 0 ? (
                      <div className="text-center py-12 border border-dashed rounded-xl">
                        <p className="text-muted-foreground italic">No publications yet.</p>
                      </div>
                    ) : (
                      publications.map((pub) => (
                        <div key={pub.id} className="flex items-start justify-between p-4 rounded-xl border bg-card hover:border-primary/50 transition-all group">
                          <div className="flex gap-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${pub.type === 'book' ? 'bg-blue-500/10 text-blue-500' : 'bg-primary/10 text-primary'}`}>
                              {pub.type === 'book' ? <Book className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors">{pub.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1 font-medium">{Array.isArray(pub.authors) ? pub.authors.join(', ') : pub.authors}</p>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">{pub.description}</p>
                              <div className="flex gap-2 mt-2">
                                {pub.link_url && (
                                  <Badge variant="outline" className="text-[9px] h-5">Link Attached</Badge>
                                )}
                                {pub.file_url && (
                                  <Badge variant="outline" className="text-[9px] h-5 border-green-500 text-green-600">PDF Hosted</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {!pub.id.startsWith('pub-sample-') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePubDelete(pub.id)}
                              className="text-destructive hover:bg-destructive/10 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Gallery ── */}
          <TabsContent value="gallery">
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Add Image Form */}
              <Card className="lg:col-span-2 h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Add Gallery Image
                  </CardTitle>
                  <CardDescription>Upload images from events and workshops.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleGallerySubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="gallery-title">Image Title *</Label>
                      <Input
                        id="gallery-title"
                        placeholder="Event name or activity..."
                        value={galleryForm.title}
                        onChange={handleGalleryInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gallery-description">Description</Label>
                      <Textarea
                        id="gallery-description"
                        placeholder="Briefly describe the moment..."
                        rows={3}
                        value={galleryForm.description}
                        onChange={handleGalleryInputChange}
                      />
                    </div>

                    <div className="space-y-2 p-4 rounded-lg bg-muted/30 border border-primary/20">
                      <Label className="flex items-center gap-2">
                        Image *
                      </Label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input type="file" accept="image/*" onChange={handleGalleryImageUpload} className="flex-1" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">or</span>
                          <Input
                            id="gallery-image_url"
                            placeholder="Paste image URL here"
                            value={galleryForm.image_url}
                            onChange={handleGalleryInputChange}
                          />
                        </div>
                        {galleryForm.image_url && (
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-primary/20">
                            <img
                              src={galleryForm.image_url}
                              alt="Preview"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/400x200?text=Invalid+Image"; }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <Button type="submit" className="w-full">✨ Add to Gallery</Button>
                  </form>
                </CardContent>
              </Card>

              {/* Gallery List */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Currently in Gallery</CardTitle>
                  <CardDescription>All images shown on the public gallery page.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {galleryImages.length === 0 ? (
                      <div className="col-span-full text-center py-12 border border-dashed rounded-xl">
                        <p className="text-muted-foreground italic">No images yet.</p>
                      </div>
                    ) : (
                      galleryImages.map((image) => (
                        <div key={image.id} className="group relative aspect-square rounded-xl overflow-hidden border hover:border-primary/50 transition-all">
                          <img
                            src={image.image_url}
                            alt={image.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                            <p className="text-white text-xs font-medium mb-1 line-clamp-2">{image.title}</p>
                            {!image.id.startsWith('gallery-sample-') && (
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleGalleryDelete(image.id)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                            {image.id.startsWith('gallery-sample-') && (
                              <Badge variant="secondary" className="text-[10px]">Sample Content</Badge>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Awards / Achievements ── */}
          <TabsContent value="awards">
            <div className="grid lg:grid-cols-5 gap-6">
              <Card className="lg:col-span-2 h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    New Achievement
                  </CardTitle>
                  <CardDescription>Add a new milestone to the club's trophy case.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAchievementSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ach-title">Title *</Label>
                      <Input
                        id="ach-title"
                        placeholder="e.g. Winner of Smart India Hackathon"
                        value={achievementForm.title}
                        onChange={(e) => setAchievementForm(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ach-date">Date *</Label>
                      <Input
                        id="ach-date"
                        type="date"
                        value={achievementForm.date}
                        onChange={(e) => setAchievementForm(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ach-description">Brief Description</Label>
                      <Textarea
                        id="ach-description"
                        placeholder="What was achieved..."
                        rows={4}
                        value={achievementForm.description}
                        onChange={(e) => setAchievementForm(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ach-image">Image URL (Optional)</Label>
                      <Input
                        id="ach-image"
                        placeholder="https://..."
                        value={achievementForm.image_url}
                        onChange={(e) => setAchievementForm(prev => ({ ...prev, image_url: e.target.value }))}
                      />
                    </div>
                    <Button type="submit" className="w-full">🏆 Add Achievement</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Trophy Case</CardTitle>
                  <CardDescription>Managing {achievements.length} accomplishments.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {achievements.length === 0 ? (
                      <div className="text-center py-12 border border-dashed rounded-xl">
                        <p className="text-muted-foreground italic">No achievements recorded in Supabase.</p>
                      </div>
                    ) : (
                      achievements.map((ach) => (
                        <div key={ach.id} className="flex gap-4 p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Trophy className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm truncate">{ach.title}</h4>
                              <Button variant="ghost" size="icon" onClick={() => handleAchievementDelete(ach.id)} className="text-destructive h-8 w-8">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground mb-2">
                              {(() => {
                                const d = ach.achievement_date || (ach as any).date;
                                return d ? format(new Date(d), "MMMM d, yyyy") : "";
                              })()}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{ach.description}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── FAQ ── */}
          <TabsContent value="faq">
            <div className="grid lg:grid-cols-5 gap-6">
              <Card className="lg:col-span-2 h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    Add FAQ Item
                  </CardTitle>
                  <CardDescription>Answer common questions from members.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleFAQSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="faq-cat">Category</Label>
                      <Input
                        id="faq-cat"
                        placeholder="e.g. General, Members, Technical"
                        value={faqForm.category}
                        onChange={(e) => setFaqForm(prev => ({ ...prev, category: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="faq-q">Question *</Label>
                      <Input
                        id="faq-q"
                        placeholder="The question..."
                        value={faqForm.question}
                        onChange={(e) => setFaqForm(prev => ({ ...prev, question: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="faq-a">Answer *</Label>
                      <Textarea
                        id="faq-a"
                        placeholder="The detailed answer..."
                        rows={6}
                        value={faqForm.answer}
                        onChange={(e) => setFaqForm(prev => ({ ...prev, answer: e.target.value }))}
                      />
                    </div>
                    <Button type="submit" className="w-full">➕ Add to FAQ</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>FAQ List</CardTitle>
                  <CardDescription>Showing {faqs.length} entries.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {faqs.length === 0 ? (
                      <div className="text-center py-12 border border-dashed rounded-xl">
                        <p className="text-muted-foreground italic">No FAQs found.</p>
                      </div>
                    ) : (
                      faqs.map((faq) => (
                        <div key={faq.id} className="p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Badge variant="secondary" className="text-[9px] mb-2 uppercase">{faq.category || "General"}</Badge>
                              <h4 className="font-semibold text-sm leading-tight">{faq.question}</h4>
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{faq.answer}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleFAQDelete(faq.id)} className="text-destructive h-8 w-8 ml-2">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Messages / Inbox ── */}
          <TabsContent value="messages">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    Contact Inbox
                  </CardTitle>
                  <CardDescription>Messages received via the contact form.</CardDescription>
                </div>
                <Badge variant="outline" className="h-6">
                  {messages.filter(m => m.status === 'new').length} Unread
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-24 border border-dashed rounded-2xl">
                      <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                      <p className="text-muted-foreground italic">Your inbox is empty.</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-5 rounded-2xl border transition-all ${msg.status !== 'new' ? "bg-background border-border hover:border-primary/30" : "bg-primary/5 border-primary/20 shadow-sm"}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.status !== 'new' ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                              {(msg.name || (msg as any).sender_name || msg.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className={`text-sm ${msg.status !== 'new' ? "font-medium" : "font-bold"}`}>{msg.name || (msg as any).sender_name || "Anonymous"}</h4>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <span className="text-[10px] text-muted-foreground">{format(new Date(msg.created_at), "MMM d, h:mm a")}</span>
                              </div>
                              <p className="text-xs font-semibold mb-1">{msg.subject}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 pl-3 border-primary/20 my-2">"{msg.message || (msg as any).body}"</p>
                              <div className="flex items-center gap-4 mt-3">
                                <a href={`mailto:${msg.email}`} className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1">
                                  <Mail className="w-3 h-3" /> {msg.email}
                                </a>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(msg.id, msg.status === 'new')}
                              className="text-[10px] h-8"
                            >
                              {msg.status !== 'new' ? "Mark Unread" : "Mark Read"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMessageDelete(msg.id)}
                              className="text-destructive h-8 w-8 hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="certificates">
            <CertificateSender />
          </TabsContent>

          {/* ── Students ── */}
          <TabsContent value="students">
            <StudentsTab />
          </TabsContent>

          {/* ── Problems & Tasks ── */}
          <TabsContent value="problems">
            <AdminProblemsTab currentAdminName={currentUserName} isSuperAdmin={false} />
          </TabsContent>

          {/* ── Academic Question Bank (Theory & Numericals) ── */}
          <TabsContent value="academic-questions">
            <AcademicQuestionBankTab />
          </TabsContent>

          {/* ── Leadership & Role Promotions ── */}
          <TabsContent value="promotions">
            <AdminRolePromotionsTab
              currentAdminName={currentUserName}
              isSuperAdmin={isSuperAdmin}
            />
          </TabsContent>

          {/* ── Socials ── */}
          <TabsContent value="socials">
            <div className="grid lg:grid-cols-5 gap-6">
              <Card className="lg:col-span-2 h-fit border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Add Social Post
                  </CardTitle>
                  <CardDescription>Share recent updates from Instagram, LinkedIn, or Twitter.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSocialSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="social-url">Post URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="social-url"
                          placeholder="https://instagram.com/p/..."
                          value={socialForm.post_url}
                          onChange={(e) => {
                            setSocialForm(prev => ({ ...prev, post_url: e.target.value }));
                            if (e.target.value.length > 20) fetchSocialMetadata(e.target.value);
                          }}
                        />
                        {isFetchingSocial && <Loader2 className="w-4 h-4 animate-spin self-center" />}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Platform</Label>
                        <Select value={socialForm.platform} onValueChange={(v) => setSocialForm(prev => ({ ...prev, platform: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="twitter">Twitter / X</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          placeholder="@techshastra"
                          value={socialForm.username}
                          onChange={(e) => setSocialForm(prev => ({ ...prev, username: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Caption / Content</Label>
                      <Textarea
                        placeholder="What's this post about?"
                        value={socialForm.content}
                        onChange={(e) => setSocialForm(prev => ({ ...prev, content: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2 p-3.5 rounded-2xl glass border-primary/20 bg-primary/5">
                      <Label className="flex items-center justify-between text-xs font-semibold">
                        <span>Post Image / Photo</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Upload or paste URL</span>
                      </Label>
                      <div className="space-y-2.5">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleSocialImageUpload}
                          className="text-xs bg-card/60 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-primary file:text-primary-foreground cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground uppercase font-mono shrink-0">or URL:</span>
                          <Input
                            placeholder="https://... direct image link"
                            value={socialForm.image_url}
                            onChange={(e) => setSocialForm(prev => ({ ...prev, image_url: e.target.value }))}
                            className="text-xs h-8 bg-card/60"
                          />
                        </div>
                        {socialForm.image_url && (
                          <div className="relative w-full h-32 rounded-xl overflow-hidden border border-primary/20 bg-black/20">
                            <img
                              src={socialForm.image_url}
                              alt="Preview"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x300/0f172a/a855f7?text=Preview+Image"; }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="absolute top-2 right-2 h-6 px-2 text-[10px] rounded-lg"
                              onClick={() => setSocialForm(prev => ({ ...prev, image_url: "" }))}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground italic">
                        Tip: Upload the actual photo posted on Instagram so it loads instantly with zero CORS blocks.
                      </p>
                    </div>

                    <Button type="submit" className="w-full">Sync to Socials Page</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Social Feed Management</CardTitle>
                  <CardDescription>Managing {socialPosts.length} posts currently shown on the site.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {socialPosts.length === 0 ? (
                      <div className="text-center py-12 border border-dashed rounded-xl">
                        <p className="text-muted-foreground italic">No social posts added yet.</p>
                      </div>
                    ) : (
                      socialPosts.map((post) => (
                        <div key={post.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                              {post.image_url ? (
                                <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Link className="w-6 h-6 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{post.author || (post as any).username || post.platform}</span>
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {post.platform}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{post.content}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <a href={post.url || (post as any).post_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon">
                                <Globe className="w-4 h-4" />
                              </Button>
                            </a>
                            <Button variant="ghost" size="icon" onClick={() => handleSocialDelete(post.id)} className="text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Home Dignitaries & Directors ── */}
          {!isFaculty && (
            <TabsContent value="dignitaries">
              <AdminDignitariesTab currentAdminName={currentUserName} />
            </TabsContent>
          )}

          {/* ── About Mentors & Leaders ── */}
          {!isFaculty && (
            <TabsContent value="leaders">
              <AdminLeadersTab currentAdminName={currentUserName} />
            </TabsContent>
          )}

          {/* ── Super Admin Panel ── */}
          {isSuperAdmin && (
            <TabsContent value="super-admin">
              <div className="space-y-8">
                {/* ── Change Super Admin Credentials ── */}
                <ChangeSuperAdminCard actor={currentUserName} onChanged={() => toast({ title: "Super admin credentials updated ✓" })} />

                {/* ── Admin Login Access Requests & Confirmations ── */}
                <Card className="border-amber-500/30">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                        Admin Access Requests & Confirmations
                      </CardTitle>
                      {pendingRequests.length > 0 ? (
                        <Badge className="bg-amber-500 text-white font-medium">
                          {pendingRequests.length} Pending Approval
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          All Caught Up
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      When an admin signs in with their credentials, access to the admin dashboard is held until you confirm or reject the login request.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Active pending requests */}
                    {pendingRequests.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                          Pending Approvals ({pendingRequests.length})
                        </h4>
                        <div className="divide-y divide-border rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
                          {pendingRequests.map((req) => (
                            <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">{req.adminName}</span>
                                  {req.isNewRegistration ? (
                                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30 font-medium">
                                      New Registration
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30 font-medium">
                                      Admin Login
                                    </Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    ID: {req.id.slice(-8).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <span>📱 {req.mobile}</span>
                                  <span>💻 {req.device}</span>
                                  <span>🕒 {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                                  onClick={() => handleApproveAdminLogin(req.id)}
                                >
                                  <Check className="w-4 h-4" /> {req.isNewRegistration ? "Approve & Register" : "Approve & Grant Access"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="gap-1.5"
                                  onClick={() => handleRejectAdminLogin(req.id)}
                                >
                                  <X className="w-4 h-4" /> Reject
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-lg border border-dashed border-border/80 bg-muted/20">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                        <p className="font-medium text-sm">No Pending Login Requests</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          When an admin attempts to log in, their confirmation request will appear here with instant Approve/Reject controls.
                        </p>
                      </div>
                    )}

                    {/* Recent Request History */}
                    {allRequests.filter(r => r.status !== 'pending').length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Recent Login Requests History
                        </h4>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {allRequests.filter(r => r.status !== 'pending').slice(0, 10).map((req) => (
                            <div key={req.id} className="p-2.5 rounded-md border border-border/60 bg-muted/30 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                {req.status === 'approved' ? (
                                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 bg-emerald-500/10 text-[10px]">
                                    Approved
                                  </Badge>
                                ) : req.status === 'rejected' ? (
                                  <Badge variant="outline" className="text-destructive border-destructive/40 bg-destructive/10 text-[10px]">
                                    Rejected
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                    {req.status}
                                  </Badge>
                                )}
                                <span className="font-medium">{req.adminName}</span>
                                <span className="text-[11px] text-muted-foreground hidden sm:inline">({req.device})</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {req.respondedAt ? new Date(req.respondedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(req.requestedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── Create Admin Credentials ── */}
                <Card className="border-green-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-green-500" />
                      Create Admin Credentials
                    </CardTitle>
                    <CardDescription>
                      Generate unique login credentials for a new admin. The system creates a username and password from their name, mobile, and date of birth.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Role selector for new credential */}
                    <div className="space-y-1.5 mb-4">
                      <Label className="text-xs font-semibold">Assign Role</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewCredRole("member")}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            newCredRole === "member"
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : "border-border/60 hover:border-border hover:bg-muted/40"
                          }`}
                        >
                          <p className="font-semibold text-xs text-foreground">👥 Club Member</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Events, projects, blog & club management</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewCredRole("faculty")}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            newCredRole === "faculty"
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : "border-border/60 hover:border-border hover:bg-muted/40"
                          }`}
                        >
                          <p className="font-semibold text-xs text-foreground">🎓 Faculty Member</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Creates & evaluates student problems</p>
                        </button>
                      </div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const name = (form.elements.namedItem("cred-name") as HTMLInputElement).value;
                        const mobile = (form.elements.namedItem("cred-mobile") as HTMLInputElement).value;
                        const dob = (form.elements.namedItem("cred-dob") as HTMLInputElement).value;
                        const email = (form.elements.namedItem("cred-email") as HTMLInputElement).value;
                        try {
                          const cred = createAdminCredential(name, mobile, dob, newCredRole, email || undefined);
                          const loginFormat = `${name},${mobile},${dob}`;
                          // Log creation
                          addLogEntry({
                            actor: currentUserName,
                            action: `Created ${newCredRole} credentials for ${cred.name}${email ? ` (${email})` : ""}`,
                            type: "create_credential",
                            revertible: true,
                            credentialSnapshot: cred,
                          });
                          // Send credentials via email
                          if (email) {
                            const subject = encodeURIComponent("Your TECHSHASTRA Admin Credentials");
                            const body = encodeURIComponent(
                              `Hello ${cred.name},\n\nYour admin credentials for the TECHSHASTRA Admin Panel have been created.\n\n` +
                              `🔑 Login: ${loginFormat}\n\n` +
                              `(Format: Name,Mobile,DateOfBirth — enter this in the login field)\n\n` +
                              `Please login at: ${window.location.origin}/auth\n\n` +
                              `Keep these credentials private. Do not share them with anyone.\n\n` +
                              `Regards,\nTECHSHASTRA Super Admin`
                            );
                            window.open(`mailto:${email}?subject=${subject}&body=${body}`);
                          }
                          toast({
                            title: "✅ Admin Created!",
                            description: email
                              ? `Credentials sent to ${email}. Login: ${loginFormat}`
                              : `Login: ${loginFormat}`,
                          });
                          trackAction(`Created admin: ${name}`);
                          form.reset();
                          refreshCredsAndLog();
                        } catch (err: any) {
                          toast({ title: "Failed", description: err.message, variant: "destructive" });
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cred-name" className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" /> Full Name
                          </Label>
                          <Input id="cred-name" name="cred-name" placeholder="Rahul Sharma" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cred-mobile" className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" /> Mobile Number
                          </Label>
                          <Input id="cred-mobile" name="cred-mobile" placeholder="9876543210" required pattern="[0-9]{10,}" title="Enter a valid mobile number" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cred-dob" className="flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" /> Date of Birth
                          </Label>
                          <Input id="cred-dob" name="cred-dob" type="date" required />
                        </div>
                      </div>
                      {/* Email field — full width */}
                      <div className="space-y-2">
                        <Label htmlFor="cred-email" className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" /> Email Address
                          <span className="text-[10px] text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-full">credentials sent here</span>
                        </Label>
                        <Input
                          id="cred-email"
                          name="cred-email"
                          type="email"
                          placeholder="admin@example.com"
                          className="w-full"
                        />
                        <p className="text-[10px] text-muted-foreground px-1">
                          If provided, your default mail app will open pre-filled with the credentials to send.
                        </p>
                      </div>
                      <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                        <Key className="w-4 h-4 mr-2" /> Generate & Save Credentials
                      </Button>
                    </form>

                    {/* Existing Credentials List */}
                    {credsList.length > 0 && (
                      <div className="mt-6 space-y-2">
                        <h4 className="text-sm font-semibold mb-3">Active Admin Accounts ({credsList.length})</h4>
                        {credsList.map(cred => (
                          <div
                            key={cred.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${cred.is_blocked ? "border-destructive/30 bg-destructive/5" : "border-border hover:bg-muted/30"
                              } transition-colors`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${cred.is_blocked ? "bg-destructive/20" : "bg-green-500/10"
                                }`}>
                                {cred.is_blocked ? (
                                  <Ban className="w-4 h-4 text-destructive" />
                                ) : (
                                  <UserCheck className="w-4 h-4 text-green-600" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm">{cred.name}</p>
                                  <Badge variant="outline" className={`text-[9px] ${
                                    cred.role === "faculty"
                                      ? "bg-purple-500/10 text-purple-600 border-purple-500/30"
                                      : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                  }`}>
                                    {cred.role === "faculty" ? "🎓 Faculty" : "👥 Member"}
                                  </Badge>
                                  {cred.is_blocked && (
                                    <Badge variant="destructive" className="text-[10px]">BLOCKED</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {cred.name},{cred.mobile}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(cred.dob).toLocaleDateString('en-IN')}
                                  </span>
                                </div>
                                {cred.email && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Mail className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">{cred.email}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Copy login credentials"
                                onClick={() => {
                                  const loginFormat = `${cred.name},${cred.mobile},${cred.dob}`;
                                  navigator.clipboard.writeText(`Login: ${loginFormat}`);
                                  toast({ title: "Copied!", description: "Login credentials copied to clipboard" });
                                }}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              {cred.email && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Resend credentials by email"
                                  onClick={() => {
                                    const loginFormat = `${cred.name},${cred.mobile},${cred.dob}`;
                                    const subject = encodeURIComponent("Your TECHSHASTRA Admin Credentials");
                                    const body = encodeURIComponent(
                                      `Hello ${cred.name},\n\nYour admin credentials for the TECHSHASTRA Admin Panel:\n\n` +
                                      `🔑 Login: ${loginFormat}\n\n` +
                                      `(Format: Name,Mobile,DateOfBirth)\n\n` +
                                      `Login at: ${window.location.origin}/auth\n\nKeep these private.\n\nRegards,\nTECHSHASTRA Super Admin`
                                    );
                                    window.open(`mailto:${cred.email}?subject=${subject}&body=${body}`);
                                    toast({ title: "Mail Opened", description: `Email draft opened for ${cred.email}` });
                                  }}
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={cred.is_blocked ? "default" : "outline"}
                                onClick={() => {
                                  const wasBlocked = cred.is_blocked;
                                  if (wasBlocked) {
                                    unblockAdmin(cred.id);
                                  } else {
                                    blockAdmin(cred.id);
                                  }
                                  addLogEntry({
                                    actor: currentUserName,
                                    action: `${wasBlocked ? "Unblocked" : "Blocked"} admin: ${cred.name}`,
                                    type: wasBlocked ? "unblock_credential" : "block_credential",
                                    revertible: true,
                                    credentialId: cred.id,
                                    credentialSnapshot: cred,
                                  });
                                  toast({
                                    title: wasBlocked ? "Unblocked" : "Blocked",
                                    description: `${cred.name} has been ${wasBlocked ? "unblocked" : "blocked"}.`,
                                  });
                                  trackAction(`${wasBlocked ? "Unblocked" : "Blocked"} admin: ${cred.name}`);
                                  refreshCredsAndLog();
                                }}
                              >
                                {cred.is_blocked ? "Unblock" : "Block"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  addLogEntry({
                                    actor: currentUserName,
                                    action: `Deleted admin credentials for ${cred.name}`,
                                    type: "delete_credential",
                                    revertible: true,
                                    credentialSnapshot: { ...cred },
                                  });
                                  deleteAdminCredential(cred.id);
                                  toast({ title: "Deleted", description: `${cred.name}'s credentials removed. You can revert this from the Activity Log.` });
                                  trackAction(`Deleted admin: ${cred.name}`);
                                  refreshCredsAndLog();
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── Admin User Management ── */}
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      Admin User Management
                    </CardTitle>
                    <CardDescription>
                      Manage who has admin access. You can add, remove, block, or unblock admins.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Current admins list */}
                    {superAdminLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {adminUsers.length === 0 ? (
                          <div className="text-center py-8 border border-dashed rounded-xl">
                            <p className="text-muted-foreground">No admin users configured yet.</p>
                          </div>
                        ) : (
                          adminUsers.map(user => {
                            const displayName = (user as any).full_name || user.name || (user.id ? user.id.slice(0, 8) : "Admin");
                            const userId = user.id || (user as any).user_id || "";
                            return (
                            <div
                              key={userId || user.mobile}
                              className={`flex items-center justify-between p-4 rounded-lg border ${user.is_blocked ? "border-destructive/30 bg-destructive/5" : "border-border hover:bg-muted/50"
                                } transition-colors`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === "super_admin" ? "bg-primary/20" : user.is_blocked ? "bg-destructive/20" : "bg-muted"
                                  }`}>
                                  {user.role === "super_admin" ? (
                                    <ShieldCheck className="w-5 h-5 text-primary" />
                                  ) : user.is_blocked ? (
                                    <Ban className="w-5 h-5 text-destructive" />
                                  ) : (
                                    <UserCheck className="w-5 h-5 text-muted-foreground" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-sm">{displayName}</p>
                                    {user.role === "super_admin" ? (
                                      <Badge variant="default" className="text-[10px]">⭐ Super Admin</Badge>
                                    ) : user.role === "faculty" ? (
                                      <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/30">🎓 Faculty</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">👥 Member</Badge>
                                    )}
                                    {user.is_blocked && (
                                      <Badge variant="destructive" className="text-[10px]">BLOCKED</Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">📱 {user.mobile}</p>
                                  {user.block_reason && (
                                    <p className="text-[11px] text-destructive mt-0.5">Reason: {user.block_reason}</p>
                                  )}
                                </div>
                              </div>

                              {/* Actions — can't modify own super_admin account */}
                              {user.role !== "super_admin" && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Role toggle */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1 text-xs"
                                    title="Toggle Member / Faculty role"
                                    onClick={async () => {
                                      const newRole: AdminRole = user.role === "faculty" ? "member" : "faculty";
                                      await updateAdminRole(userId, newRole);
                                      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
                                      toast({ title: `Role updated to ${newRole === "faculty" ? "Faculty" : "Member"}` });
                                    }}
                                  >
                                    {user.role === "faculty" ? <><Users className="w-3 h-3" /> → Member</> : <><UserCheck className="w-3 h-3" /> → Faculty</>}
                                  </Button>
                                  {user.is_blocked ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleUnblockAdmin(userId, displayName)}
                                      className="gap-1 text-xs"
                                    >
                                      <UserCheck className="w-3 h-3" /> Unblock
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleBlockAdmin(userId, displayName)}
                                      className="gap-1 text-xs text-orange-600 border-orange-600/30 hover:bg-orange-600/10"
                                    >
                                      <Ban className="w-3 h-3" /> Block
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveAdmin(userId, displayName)}
                                    className="gap-1 text-xs text-destructive hover:bg-destructive/10"
                                  >
                                    <UserX className="w-3 h-3" /> Remove
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── Page Visibility Controls ── */}
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-primary" />
                      Page Visibility Controls
                    </CardTitle>
                    <CardDescription>
                      Toggle pages on or off. Hidden pages will show a 404 to visitors and be removed from the navigation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {superAdminLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pages.map(page => (
                          <div
                            key={page.id}
                            className={`flex items-center justify-between p-4 rounded-lg border ${page.is_visible ? "border-border" : "border-orange-500/30 bg-orange-500/5"
                              } transition-colors`}
                          >
                            <div className="flex items-center gap-3">
                              {page.is_visible ? (
                                <Eye className="w-5 h-5 text-green-500" />
                              ) : (
                                <EyeOff className="w-5 h-5 text-orange-500" />
                              )}
                              <div>
                                <p className="font-medium text-sm">{page.page_name}</p>
                                <p className="text-[11px] text-muted-foreground">{page.page_path}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-medium ${page.is_visible ? "text-green-500" : "text-orange-500"}`}>
                                {page.is_visible ? "Visible" : "Hidden"}
                              </span>
                              <Switch
                                checked={page.is_visible}
                                onCheckedChange={() => handleTogglePage(page)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── Live Activity Monitor ── */}
                <Card className="border-green-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-500" />
                      Live Activity Monitor
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Real-time view of admin activity. See who's online, what tab they're on, and their last action.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Online Admins */}
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Currently Online ({onlineAdmins.length})
                      </h4>
                      {onlineAdmins.length === 0 ? (
                        <div className="text-center py-6 border border-dashed rounded-xl">
                          <p className="text-muted-foreground text-sm">No admins currently online</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {onlineAdmins.map(admin => (
                            <div
                              key={admin.user_id}
                              className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-green-600" />
                                  </div>
                                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background"></span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{admin.full_name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                      💻 {admin.current_tab}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">
                                      {admin.last_action}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant="default" className="bg-green-500 text-[10px]">
                                  🟢 LIVE
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Activity Feed */}
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Activity Feed</h4>
                      {activityLog.length === 0 ? (
                        <div className="text-center py-6 border border-dashed rounded-xl">
                          <p className="text-muted-foreground text-sm">No activity recorded yet. Actions will appear here in real-time.</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2">
                          {activityLog.map(entry => (
                            <div
                              key={entry.id}
                              className={`flex items-start gap-3 p-2.5 rounded-lg text-xs transition-colors ${entry.is_login
                                ? "bg-green-500/5 border border-green-500/10"
                                : entry.is_logout
                                  ? "bg-red-500/5 border border-red-500/10"
                                  : "bg-muted/30 border border-transparent hover:border-border"
                                }`}
                            >
                              <div className="mt-0.5">
                                {entry.is_login ? (
                                  <span className="text-green-500 text-base">🟢</span>
                                ) : entry.is_logout ? (
                                  <span className="text-red-500 text-base">🔴</span>
                                ) : (
                                  <span className="text-blue-400 text-base">▶️</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold">{entry.full_name}</span>
                                  <span className="text-muted-foreground">—</span>
                                  <span className={`${entry.is_login ? "text-green-600 font-medium"
                                    : entry.is_logout ? "text-red-500 font-medium"
                                      : "text-foreground"
                                    }`}>
                                    {entry.action}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                  <span>💻 {entry.tab}</span>
                                  <span>·</span>
                                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                {/* ── Persistent Activity Log ── */}
                <Card className="border-amber-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-amber-500" />
                        Super Admin Activity Log
                      </span>
                      {logEntries.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            clearLog();
                            refreshCredsAndLog();
                            toast({ title: "Log Cleared", description: "All activity log entries have been removed." });
                          }}
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Clear Log
                        </Button>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Every Super Admin action is recorded here. Reversible actions can be undone with the Revert button.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {logEntries.length === 0 ? (
                      <div className="text-center py-8 border border-dashed rounded-xl">
                        <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                        <p className="text-muted-foreground text-sm">No actions recorded yet. Actions will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                        {logEntries.map(entry => (
                          <div
                            key={entry.id}
                            className={`flex items-start justify-between gap-3 p-3 rounded-lg border text-xs ${entry.type === "create_credential"
                              ? "border-green-500/20 bg-green-500/5"
                              : entry.type === "delete_credential"
                                ? "border-destructive/20 bg-destructive/5"
                                : entry.type === "block_credential"
                                  ? "border-orange-500/20 bg-orange-500/5"
                                  : entry.type === "unblock_credential"
                                    ? "border-blue-500/20 bg-blue-500/5"
                                    : "border-border bg-muted/20"
                              }`}
                          >
                            <div className="flex gap-2.5 flex-1 min-w-0">
                              <span className="text-base mt-0.5 flex-shrink-0">
                                {entry.type === "create_credential" ? "✅"
                                  : entry.type === "delete_credential" ? "🗑️"
                                    : entry.type === "block_credential" ? "🚫"
                                      : entry.type === "unblock_credential" ? "✔️"
                                        : "📋"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium leading-snug">{entry.action}</p>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                  <span>👤 {entry.actor}</span>
                                  <span>·</span>
                                  <span>{new Date(entry.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                </div>
                              </div>
                            </div>
                            {entry.revertible && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[10px] h-7 px-2 flex-shrink-0 gap-1 border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                                onClick={() => {
                                  const result = revertEntry(entry.id, saveCredentialsRaw);
                                  if (result.success) {
                                    toast({ title: "↩️ Reverted", description: result.message });
                                  } else {
                                    toast({ title: "Revert Failed", description: result.message, variant: "destructive" });
                                  }
                                  refreshCredsAndLog();
                                }}
                              >
                                <RotateCcw className="w-3 h-3" /> Revert
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Data Backup & Export */}
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="w-5 h-5 text-primary" />
                      Data Backup & Export
                    </CardTitle>
                    <CardDescription>
                      Export all localStorage data to JSON file or import from backup. Storage: {getStorageSize()}KB used.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          exportAllData(currentUserName);
                          toast({ title: "Backup Downloaded", description: "All data exported successfully." });
                          trackAction("Exported all data");
                        }}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export All Data
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.json';
                          input.onchange = async (e: any) => {
                            const file = e.target?.files?.[0];
                            if (file) {
                              try {
                                await importAllData(file);
                                toast({ title: "Import Successful", description: "Data restored from backup." });
                                window.location.reload();
                              } catch (error) {
                                toast({ title: "Import Failed", description: String(error), variant: "destructive" });
                              }
                            }
                          };
                          input.click();
                        }}
                        className="flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Import Backup
                      </Button>

                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (confirm("⚠️ This will DELETE ALL data! This cannot be undone. Are you sure?")) {
                            clearAllData();
                            toast({ title: "All Data Cleared", description: "localStorage has been wiped." });
                            setTimeout(() => window.location.reload(), 1000);
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear All Data
                      </Button>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>• <strong>Export</strong>: Download JSON backup of all data (projects, blog, events, etc.)</p>
                      <p>• <strong>Import</strong>: Restore data from a previous backup file</p>
                      <p>• <strong>Clear</strong>: Remove all data from browser storage (use with caution!)</p>
                      <p className="text-amber-500">💡 Tip: Export regularly to prevent data loss on cache clear</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;