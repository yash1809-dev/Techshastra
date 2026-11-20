import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, Code2 } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { getStudentByGithub } from "@/lib/studentStore";
import { getStudentByUsername } from "@/lib/services/studentService";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { session: studentSession, logout } = useStudentAuth();
  const [navAvatar, setNavAvatar] = useState<string>(() => {
    if (studentSession?.githubUsername) {
      const cached = localStorage.getItem(`ts_avatar_${studentSession.githubUsername}`);
      if (cached) return cached;
      const local = getStudentByGithub(studentSession.githubUsername);
      return local?.avatar || `https://github.com/${studentSession.githubUsername}.png?size=64`;
    }
    return "";
  });

  useEffect(() => {
    if (studentSession?.githubUsername) {
      const cached = localStorage.getItem(`ts_avatar_${studentSession.githubUsername}`);
      if (cached) setNavAvatar(cached);

      const local = getStudentByGithub(studentSession.githubUsername);
      if (local?.avatar) {
        setNavAvatar(local.avatar);
        localStorage.setItem(`ts_avatar_${studentSession.githubUsername}`, local.avatar);
      }

      getStudentByUsername(studentSession.githubUsername)
        .then((remote) => {
          const remoteAvatar = (remote as any)?.avatar || (remote as any)?.avatar_url || (remote as any)?.profiles?.avatar_url;
          if (remoteAvatar) {
            setNavAvatar(remoteAvatar);
            localStorage.setItem(`ts_avatar_${studentSession.githubUsername}`, remoteAvatar);
          }
        })
        .catch(() => {});
    }

    const handler = (e: Event) => {
      const { avatarUrl: newAvatar, studentId, githubUsername } =
        (e as CustomEvent<{ avatarUrl: string; studentId?: string; githubUsername?: string }>).detail || {};
      if (newAvatar && studentSession?.githubUsername) {
        const isMe =
          (studentSession.studentId && studentId && studentSession.studentId === studentId) ||
          (githubUsername && githubUsername.toLowerCase() === studentSession.githubUsername.toLowerCase()) ||
          (!studentId && !githubUsername);
        if (isMe) {
          setNavAvatar(newAvatar);
          localStorage.setItem(`ts_avatar_${studentSession.githubUsername}`, newAvatar);
        }
      }
    };
    window.addEventListener("ts_avatar_updated", handler);
    return () => window.removeEventListener("ts_avatar_updated", handler);
  }, [studentSession?.githubUsername]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isMobileMenuOpen]);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Projects", href: "/projects" },
    { label: "Events", href: "/events" },
    // { label: "Blog", href: "/blog" },
    { label: "Socials", href: "/socials" },
    // { label: "Research & Books", href: "/publications" },
    // { label: "Resources", href: "/resources" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled
        ? "glass py-2"
        : "bg-transparent py-4"
        }`}
    >
      <div className="container mx-auto px-4 relative">
        <div className="flex items-center justify-between">
          {/* Logo — left */}
          <Link to="/" className="flex items-center space-x-3 group shrink-0" onClick={() => setIsMobileMenuOpen(false)}>
            <img src="/favicon.ico" alt="TECHSHASTRA Logo" className="w-8 h-8 object-contain group-hover:scale-110 transition-transform duration-300" />
            <span className="font-heading text-lg tracking-[0.15em] font-light text-foreground group-hover:text-primary transition-colors">
              TECHSHASTRA
            </span>
          </Link>

          {/* Desktop Navigation — center */}
          <div className="hidden md:flex items-center space-x-8 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) => (
              link.href.startsWith('#') ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-light tracking-wider text-foreground/70 hover:text-foreground transition-colors duration-300"
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.querySelector(link.href);
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className="text-sm font-light tracking-wider text-foreground/70 hover:text-foreground transition-colors duration-300"
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>

          {/* Right actions */}
          <div className="hidden md:flex items-center space-x-4 shrink-0">
            <ThemeToggle />
            {studentSession ? (
              <>
                <Link
                  to="/student"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/25 hover:bg-primary hover:text-primary-foreground text-xs font-medium tracking-wide transition-all shadow-sm shadow-primary/10"
                >
                  <Code2 size={13} />
                  <span>Coding Hub</span>
                </Link>
                <Link to="/members"
                  className="text-sm font-light tracking-wider text-foreground/70 hover:text-foreground transition-colors duration-300">
                  Members
                </Link>
                {studentSession.githubUsername ? (
                  <Link to={`/members/${studentSession.githubUsername}`}
                    className="flex items-center gap-2 text-sm font-light tracking-wider text-foreground/70 hover:text-foreground transition-colors duration-300 group"
                    title={`View profile (@${studentSession.githubUsername})`}>
                    <div className="relative w-7 h-7 rounded-full ring-2 ring-primary/30 overflow-hidden bg-primary/20 flex items-center justify-center group-hover:ring-primary transition-all">
                      <span className="text-[10px] font-heading font-medium text-primary select-none">
                        {studentSession.name ? studentSession.name[0].toUpperCase() : 'U'}
                      </span>
                      {navAvatar ? (
                        <img
                          src={navAvatar}
                          alt={studentSession.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                    </div>
                  </Link>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={logout}
                  className="rounded-full px-4 text-xs font-light tracking-wider text-foreground/70 hover:text-destructive hover:border-destructive/40 transition-all duration-300 flex items-center gap-1.5"
                >
                  <LogOut size={12} />
                  Sign Out
                </Button>
              </>
            ) : (
              <Link to="/join">
                <Button size="sm" className="rounded-full px-6 font-light tracking-wider bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                  Join Now
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile: Join Now pill + Hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {!studentSession && (
              <Link to="/join" onClick={() => setIsMobileMenuOpen(false)}>
                <Button
                  size="sm"
                  className="rounded-full px-4 py-1.5 text-[11px] font-light tracking-wider bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                >
                  Join Now
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground/70 z-50 relative"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-0 bg-background/95 backdrop-blur-xl z-40 flex flex-col items-center justify-start overflow-y-auto py-20 px-6 sm:justify-center md:hidden"
            >
              <div className="flex flex-col items-center space-y-6 w-full max-w-sm">
                {navLinks.map((link, idx) => (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                    className="w-full text-center"
                  >
                    {link.href.startsWith('#') ? (
                      <a
                        href={link.href}
                        className="block text-2xl font-heading font-light tracking-widest text-foreground/70 hover:text-primary transition-colors py-2"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsMobileMenuOpen(false);
                          const element = document.querySelector(link.href);
                          element?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="block text-2xl font-heading font-light tracking-widest text-foreground/70 hover:text-primary transition-colors py-2"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    )}
                  </motion.div>
                ))}
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + navLinks.length * 0.05 }}
                  className="w-full pt-6 space-y-3"
                >
                  {studentSession ? (
                    <>
                      <Link to="/student" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button size="lg" className="w-full rounded-full font-medium tracking-wide bg-primary text-primary-foreground gap-2 shadow-lg shadow-primary/20">
                          <Code2 size={16} />
                          Coding & Learning Hub
                        </Button>
                      </Link>
                      <Link to="/members" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button size="lg" variant="outline" className="w-full rounded-full font-light tracking-widest">
                          Members Directory
                        </Button>
                      </Link>
                      {studentSession.githubUsername ? (
                        <Link to={`/members/${studentSession.githubUsername}`} onClick={() => setIsMobileMenuOpen(false)}>
                          <Button size="lg" variant="outline" className="w-full rounded-full font-light tracking-widest gap-2">
                            <div className="relative w-5 h-5 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold text-primary">
                                {studentSession.name ? studentSession.name[0].toUpperCase() : 'U'}
                              </span>
                              {navAvatar ? (
                                <img
                                  src={navAvatar}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  alt=""
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : null}
                            </div>
                            My Profile
                          </Button>
                        </Link>
                      ) : null}
                      <Button
                        size="lg"
                        variant="destructive"
                        className="w-full rounded-full font-light tracking-widest gap-2"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          logout();
                        }}
                      >
                        <LogOut size={16} />
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <Link to="/join" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button size="lg" className="w-full rounded-full font-light tracking-widest bg-primary text-primary-foreground shadow-xl shadow-primary/20">
                        Join Now
                      </Button>
                    </Link>
                  )}
                </motion.div>
              </div>

              {/* Theme toggle — fixed to bottom-right corner of mobile menu */}
              <div className="absolute bottom-6 right-6">
                <ThemeToggle />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

export default Navbar;
