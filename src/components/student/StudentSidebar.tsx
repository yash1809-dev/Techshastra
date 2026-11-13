import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { getStudentByGithub } from "@/lib/studentStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Code2,
  Trophy,
  Keyboard,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const StudentSidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
}) => {
  const { session, logout } = useStudentAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    if (session?.githubUsername) {
      const local = getStudentByGithub(session.githubUsername);
      return local?.avatar || `https://github.com/${session.githubUsername}.png?size=64`;
    }
    return "";
  });

  useEffect(() => {
    if (session?.githubUsername) {
      const local = getStudentByGithub(session.githubUsername);
      if (local?.avatar) setAvatarUrl(local.avatar);
    }
    const handler = (e: Event) => {
      const { avatarUrl: newAvatar } = (e as CustomEvent<{ avatarUrl: string }>).detail || {};
      if (newAvatar) setAvatarUrl(newAvatar);
    };
    window.addEventListener("ts_avatar_updated", handler);
    return () => window.removeEventListener("ts_avatar_updated", handler);
  }, [session?.githubUsername]);

  const profileHref = session?.githubUsername
    ? `/members/${session.githubUsername}`
    : "/members";

  // The 4 essential student options requested:
  // 1. Profile & GitHub
  // 2. Problems & Tasks (LeetCode style)
  // 3. Leaderboard
  // 4. Typing Test (MonkeyType style)
  const navItems = [
    {
      label: "Profile & GitHub",
      href: profileHref,
      icon: User,
      activeCheck: (path: string) => path.startsWith("/members"),
      badge: null,
    },
    {
      label: "Problems & Tasks",
      href: "/student/problems",
      icon: Code2,
      activeCheck: (path: string) =>
        path.startsWith("/student/problems") || path === "/student",
      badge: "Faculty",
    },
    {
      label: "Leaderboard",
      href: "/student/leaderboard",
      icon: Trophy,
      activeCheck: (path: string) => path.startsWith("/student/leaderboard"),
      badge: "UTU",
    },
    {
      label: "Typing Test",
      href: "/student/typing",
      icon: Keyboard,
      activeCheck: (path: string) => path.startsWith("/student/typing"),
      badge: "WPM",
    },
  ];

  const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full select-none">

      {/* User Identity — top of sidebar */}
      <div
        className={`flex items-center gap-2.5 px-3 py-3.5 ${collapsed && !isMobile ? "justify-center" : "justify-between"}`}
        style={{ borderBottom: "1px solid hsl(var(--glass-border))" }}
      >
        <Link
          to={profileHref}
          onClick={() => isMobile && setMobileOpen(false)}
          className={`flex items-center gap-2.5 min-w-0 flex-1 group ${
            collapsed && !isMobile ? "justify-center" : ""
          }`}
          title={collapsed && !isMobile ? `${session?.name} (@${session?.githubUsername})` : undefined}
        >
          {/* Avatar */}
          {avatarUrl || session?.githubUsername ? (
            <img
              src={avatarUrl || `https://github.com/${session?.githubUsername}.png?size=64`}
              alt={session?.name || "Student"}
              className="w-9 h-9 rounded-full ring-2 ring-primary/30 object-cover flex-shrink-0 group-hover:ring-primary/60 transition-all"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
              {session?.name?.[0]?.toUpperCase() || "S"}
            </div>
          )}

          {(!collapsed || isMobile) && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">
                {session?.name || "Student"}
              </p>
              <p className="text-[11px] text-foreground/50 truncate font-mono">
                @{session?.githubUsername || "student"}
              </p>
            </div>
          )}
        </Link>

        {/* Collapse toggle */}
        {!isMobile && onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="w-7 h-7 text-foreground/40 hover:text-foreground rounded-lg hidden lg:flex flex-shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </Button>
        )}
      </div>

      {/* Main 4 Navigation Items */}
      <div className="flex-1 px-2.5 py-2 space-y-1">
        {navItems.map((item) => {
          const active = item.activeCheck(location.pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                active
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25"
                  : "text-foreground/75 hover:text-foreground hover:bg-muted/60"
              } ${collapsed && !isMobile ? "justify-center px-2" : ""}`}
              title={collapsed && !isMobile ? item.label : undefined}
            >
              <Icon
                size={16}
                className={`${
                  active
                    ? "text-primary-foreground"
                    : "text-foreground/60 group-hover:text-primary"
                } flex-shrink-0 transition-colors`}
              />
              {(!collapsed || isMobile) && (
                <span className="truncate flex-1">{item.label}</span>
              )}
              {(!collapsed || isMobile) && item.badge && (
                <Badge
                  variant="secondary"
                  className={`text-[9px] px-1.5 py-0 font-normal uppercase tracking-wide rounded-md ${
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground border-transparent"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  }`}
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer controls: Theme toggle + Sign Out */}
      <div className="p-3 space-y-2 mt-auto" style={{ borderTop: "1px solid hsl(var(--glass-border))" }}>
        <div
          className={`flex items-center gap-2 ${
            collapsed && !isMobile ? "justify-center" : "justify-between"
          }`}
        >
          <ThemeToggle />
          {(!collapsed || isMobile) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl px-2.5 py-1.5 h-auto flex items-center gap-1.5"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        style={{ borderRight: "1px solid hsl(var(--glass-border))" }}
        className={`hidden md:flex flex-col bg-background/95 backdrop-blur-md transition-all duration-300 z-30 shrink-0 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <NavContent isMobile={false} />
      </aside>

      {/* Mobile Top Header + Drawer Trigger */}
      <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-background/90 backdrop-blur-md sticky top-0 z-40" style={{ borderBottom: "1px solid hsl(var(--glass-border))" }}>
        <Link to={profileHref} className="flex items-center gap-2.5 min-w-0">
          {avatarUrl || session?.githubUsername ? (
            <img
              src={avatarUrl || `https://github.com/${session?.githubUsername}.png?size=64`}
              alt={session?.name || "Student"}
              className="w-7 h-7 rounded-full ring-2 ring-primary/30 object-cover flex-shrink-0"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
              {session?.name?.[0]?.toUpperCase() || "S"}
            </div>
          )}
          <div className="min-w-0">
            <span className="font-heading font-semibold text-xs tracking-wide text-foreground block truncate">
              {session?.name || "Student"}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono block -mt-0.5">
              @{session?.githubUsername || "student"}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 text-foreground rounded-xl"
                aria-label="Open navigation menu"
              >
                <Menu size={18} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="p-0 w-64 bg-background"
            >
              <NavContent isMobile={true} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mobile Bottom Quick Navigation Dock (Thumb-friendly 4 buttons) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-lg px-3 py-1.5 flex items-center justify-around" style={{ borderTop: "1px solid hsl(var(--glass-border))" }}>
        <Link
          to={profileHref}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-medium transition-colors ${
            location.pathname.startsWith("/members")
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User size={18} />
          <span>Profile</span>
        </Link>

        <Link
          to="/student/problems"
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-medium transition-colors ${
            location.pathname.startsWith("/student/problems") ||
            location.pathname === "/student"
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Code2 size={18} />
          <span>Problems</span>
        </Link>

        <Link
          to="/student/leaderboard"
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-medium transition-colors ${
            location.pathname.startsWith("/student/leaderboard")
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy size={18} />
          <span>Ranks</span>
        </Link>

        <Link
          to="/student/typing"
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-medium transition-colors ${
            location.pathname.startsWith("/student/typing")
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Keyboard size={18} />
          <span>Typing</span>
        </Link>
      </nav>
    </>
  );
};

export default StudentSidebar;
