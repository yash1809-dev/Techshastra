import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  Github,
  Code2,
  Rocket,
  RefreshCw,
  Terminal,
  Maximize2,
  AlertCircle,
} from "lucide-react";
import { getAllProjects, parseGitHubUrl } from "@/lib/projectStore";
import { getProjectById } from "@/lib/services/projectService";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a project object regardless of whether it came from Supabase or localStorage */
function normaliseProject(raw: any) {
  return {
    ...raw,
    // github URL — Supabase stores it as github_url, local store as github
    github: raw.github || raw.github_url || "",
    demo: raw.demo || raw.demo_url || "",
    image: raw.image || raw.image_url || "",
    tags: raw.tags || raw.tech_stack || [],
    // team info — Supabase uses lead_name/designer_name, local store uses team.lead/team.designer
    team: raw.team || {
      lead: raw.lead_name || "TECHSHASTRA Team",
      designer: raw.designer_name || "Design Team",
    },
  };
}

type SandboxMode = "demo" | "stackblitz" | "codesandbox" | "githubdev" | "gitpod" | "github";

function buildSandboxUrl(
  mode: SandboxMode,
  owner: string,
  repo: string,
  branch = "main"
): string {
  switch (mode) {
    case "stackblitz":
      return `https://stackblitz.com/github/${owner}/${repo}?embed=1&theme=dark&view=preview`;
    case "codesandbox":
      return `https://codesandbox.io/embed/github/${owner}/${repo}?fontsize=14&theme=dark&view=preview`;
    case "githubdev":
      return `https://github.dev/${owner}/${repo}`;
    case "gitpod":
      return `https://gitpod.io/#https://github.com/${owner}/${repo}`;
    case "github":
      return `https://github.com/${owner}/${repo}`;
    case "demo":
      return "";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const ProjectLive = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [sandboxMode, setSandboxMode] = useState<SandboxMode>("stackblitz");
  const [iframeKey, setIframeKey] = useState(0); // force iframe remount on retry
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Load project ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const remote = await getProjectById(id);
        if (remote) {
          setProject(normaliseProject(remote));
          setLoading(false);
          return;
        }
      } catch (_) {}

      // Fallback to localStorage store
      const local = getAllProjects().find((p) => p.id === id);
      if (local) {
        setProject(normaliseProject(local));
      } else {
        navigate("/projects");
      }
      setLoading(false);
    };

    load();
  }, [id, navigate]);

  // ── When project loads, pick best initial sandbox ──────────────────────────
  useEffect(() => {
    if (!project) return;
    if (project.demo) {
      // If deployed live demo is provided, default to it
      setSandboxMode("demo");
    } else {
      const lang = (project.language || "").toLowerCase();
      if (lang === "python") {
        setSandboxMode("gitpod");
      } else {
        setSandboxMode("stackblitz");
      }
    }
    setIframeLoaded(false);
    setIframeError(false);
    setIframeKey((k) => k + 1);
  }, [project]);

  // Prevent infinite spinner if iframe doesn't trigger onLoad (cross-origin / slow container)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIframeLoaded(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, [iframeKey, sandboxMode]);

  const gitInfo = project ? parseGitHubUrl(project.github) : null;

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    setIframeError(false);
  }, []);

  // Treat error as a failed load — offer next sandbox strategy
  const handleIframeError = useCallback(() => {
    setIframeError(true);
    setIframeLoaded(true); // stop spinner
  }, []);

  const handleRetry = () => {
    setIframeLoaded(false);
    setIframeError(false);
    setIframeKey((k) => k + 1);
    setRetryCount((c) => c + 1);
  };

  const sandboxLabel: Record<SandboxMode, string> = {
    demo: "🌐 Live App Demo",
    stackblitz: "⚡ StackBlitz",
    codesandbox: "📦 CodeSandbox",
    githubdev: "💻 Web VS Code",
    gitpod: "🖥️ Gitpod IDE",
    github: "🐙 GitHub",
  };

  const sandboxOrder: SandboxMode[] = project?.demo
    ? ["demo", "stackblitz", "codesandbox", "githubdev", "gitpod", "github"]
    : ["stackblitz", "codesandbox", "githubdev", "gitpod", "github"];

  const tryNextSandbox = () => {
    const idx = sandboxOrder.indexOf(sandboxMode);
    const next = sandboxOrder[idx + 1] || sandboxOrder[0];
    setSandboxMode(next);
    setIframeLoaded(false);
    setIframeError(false);
    setIframeKey((k) => k + 1);
  };

  const hasNextSandbox = sandboxOrder.indexOf(sandboxMode) < sandboxOrder.length - 1;

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const srcUrl =
    sandboxMode === "demo" && project.demo
      ? project.demo
      : gitInfo && sandboxMode !== "github"
      ? buildSandboxUrl(sandboxMode, gitInfo.owner, gitInfo.repo)
      : null;

  const directGithub = gitInfo ? `https://github.com/${gitInfo.owner}/${gitInfo.repo}` : project.github;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-24">
        {/* ── Top Nav Bar ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div className="space-y-1.5">
            <Button
              variant="ghost"
              onClick={() => navigate("/projects")}
              className="px-0 hover:bg-transparent text-foreground/50 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="text-xs uppercase tracking-widest font-light">Back to Showcase</span>
            </Button>
            <h1 className="text-3xl md:text-5xl font-heading font-light tracking-tight flex flex-wrap items-center gap-3">
              {project.title}
              <span className="inline-flex items-center px-3 py-1 rounded-full glass border-0 text-[10px] tracking-widest uppercase text-primary font-medium">
                {(project.language || "web").toUpperCase()} · Live Preview
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sandbox Switcher Pills */}
            {(gitInfo || project.demo) && (
              <div className="flex items-center gap-1 glass border-white/30 dark:border-white/10 rounded-full p-1 shadow-xs">
                {sandboxOrder.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSandboxMode(mode);
                      setIframeLoaded(false);
                      setIframeError(false);
                      setIframeKey((k) => k + 1);
                    }}
                    className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-medium transition-all ${
                      sandboxMode === mode
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/70 hover:text-foreground hover:bg-white/30"
                    }`}
                    title={`Open with ${mode}`}
                  >
                    {mode === "demo" ? "🌐 Live Demo" : mode === "stackblitz" ? "⚡ StackBlitz" : mode === "codesandbox" ? "📦 CodeSandbox" : mode === "githubdev" ? "💻 Web VSCode" : mode === "gitpod" ? "🖥 Gitpod" : "🐙 GitHub"}
                  </button>
                ))}
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFullscreen((f) => !f)}
              className="glass border-white/30 dark:border-white/10 rounded-full px-3"
              title="Toggle Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>

            <Button variant="outline" className="glass border-white/30 dark:border-white/10 rounded-full px-5 text-foreground font-medium" asChild>
              <a href={project.github} target="_blank" rel="noreferrer">
                <Github className="w-4 h-4 mr-2" />
                <span className="text-[10px] uppercase tracking-widest">Source</span>
              </a>
            </Button>

            {project.demo && (
              <Button className="bg-primary text-primary-foreground rounded-full px-6 shadow-md" asChild>
                <a href={project.demo} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  <span className="text-[10px] uppercase tracking-widest font-medium">Live Demo</span>
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* ── Free Public Repo Badge Banner ── */}
        <div className="mb-6 p-3.5 px-5 rounded-2xl glass border-white/30 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs bg-white/40 dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-medium text-foreground">
              ✨ 100% Free Live Sandbox:
            </span>
            <span className="text-foreground/70">
              Any public GitHub repository runs live in StackBlitz, CodeSandbox & Web VS Code with zero payment or login required.
            </span>
          </div>
          {gitInfo && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] rounded-lg text-primary font-medium hover:bg-primary/10"
                onClick={() => window.open(`https://github.dev/${gitInfo.owner}/${gitInfo.repo}`, "_blank")}
              >
                💻 Open Web VS Code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] rounded-lg text-primary font-medium hover:bg-primary/10"
                onClick={() => window.open(`https://stackblitz.com/github/${gitInfo.owner}/${gitInfo.repo}`, "_blank")}
              >
                ⚡ Open StackBlitz Tab
              </Button>
            </div>
          )}
        </div>

        {/* ── Sandbox Container ── */}
        <div className={`space-y-4 ${fullscreen ? "fixed inset-0 z-50 bg-background p-4 overflow-auto" : ""}`}>
          {fullscreen && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-heading font-medium">{project.title}</span>
              <Button variant="ghost" size="sm" onClick={() => setFullscreen(false)}>
                ✕ Exit Fullscreen
              </Button>
            </div>
          )}

          {/* Status bar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span>Sandbox: <strong className="text-foreground">{sandboxLabel[sandboxMode]}</strong></span>
              {gitInfo && (
                <span className="text-foreground/60 font-mono">
                  · {gitInfo.owner}/{gitInfo.repo}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Sandbox state indicator */}
              {!iframeLoaded && !iframeError && (
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse uppercase tracking-wider">Loading Sandbox…</span>
              )}
              {iframeLoaded && !iframeError && (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider">● Live Active</span>
              )}
              {iframeError && (
                <span className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 uppercase tracking-wider">● Switch Sandbox</span>
              )}

              {srcUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(srcUrl, "_blank")}
                  className="h-7 px-2.5 text-xs gap-1.5 rounded-lg glass border-white/20 font-medium text-foreground hover:text-primary transition-colors"
                  title="Launch in separate browser window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Launch Window</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetry}
                className="h-7 px-2 text-xs gap-1 rounded-lg glass border-white/20"
                title="Reload sandbox"
              >
                <RefreshCw className={`w-3 h-3 ${!iframeLoaded ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Main sandbox iframe or error state */}
          <div className="relative rounded-3xl overflow-hidden glass border-white/30 dark:border-white/10 shadow-elevated bg-card/60 backdrop-blur-md"
            style={{ height: fullscreen ? "calc(100vh - 120px)" : "640px" }}
          >
            {/* Loading overlay */}
            {!iframeLoaded && !iframeError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-md">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-foreground">
                  Starting {sandboxLabel[sandboxMode]} sandbox…
                </p>
                <p className="text-xs text-foreground/60 max-w-xs text-center">
                  This installs dependencies in the cloud container. Public GitHub repos are 100% free to execute.
                </p>
              </div>
            )}

            {/* Error / fallback state */}
            {iframeError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-background/90 backdrop-blur-md p-8">
                <AlertCircle className="w-10 h-10 text-rose-500" />
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-heading font-medium text-foreground">Sandbox Provider Busy or Blocked</h3>
                  <p className="text-sm text-foreground/70 max-w-md">
                    {sandboxLabel[sandboxMode]} could not embed this repository directly. Try another free provider or open directly in Web VS Code.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button onClick={handleRetry} variant="outline" className="rounded-full gap-2 glass border-0">
                    <RefreshCw className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider">Retry</span>
                  </Button>
                  {hasNextSandbox && (
                    <Button onClick={tryNextSandbox} className="rounded-full gap-2">
                      <Rocket className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">Try {sandboxLabel[sandboxOrder[sandboxOrder.indexOf(sandboxMode) + 1]]}</span>
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-full gap-2 glass border-0" asChild>
                    <a href={directGithub} target="_blank" rel="noreferrer">
                      <Github className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">Open on GitHub</span>
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {/* The iframe — Gitpod & GitHub.dev open in new tab since they disallow iframe embedding */}
            {gitInfo && sandboxMode === "githubdev" ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border-white/20 flex items-center justify-center text-3xl">
                  💻
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-heading font-medium text-foreground">GitHub.dev Web VS Code</h3>
                  <p className="text-sm text-foreground/70 max-w-sm">
                    Opens a full Visual Studio Code editor right in your browser for <strong>{gitInfo.owner}/{gitInfo.repo}</strong>. Free, no installation needed.
                  </p>
                </div>
                <Button
                  className="rounded-full px-8 gap-2 bg-primary shadow-lg font-medium"
                  onClick={() => {
                    window.open(buildSandboxUrl("githubdev", gitInfo.owner, gitInfo.repo), "_blank");
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Launch Web VS Code</span>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full px-6 gap-2 glass border-white/25"
                  onClick={() => {
                    setSandboxMode("stackblitz");
                    setIframeLoaded(false);
                    setIframeError(false);
                    setIframeKey((k) => k + 1);
                  }}
                >
                  <span className="text-xs uppercase tracking-wider">⚡ Embed in StackBlitz Instead</span>
                </Button>
              </div>
            ) : gitInfo && sandboxMode === "gitpod" ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border-white/20 flex items-center justify-center text-3xl">
                  🖥️
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-heading font-medium text-foreground">Gitpod Cloud IDE</h3>
                  <p className="text-sm text-foreground/70 max-w-sm">
                    Gitpod boots a full Linux workspace in the cloud. Click below to launch the container in a new tab.
                  </p>
                </div>
                <Button
                  className="rounded-full px-8 gap-2 bg-primary shadow-lg font-medium"
                  onClick={() => {
                    window.open(buildSandboxUrl("gitpod", gitInfo.owner, gitInfo.repo), "_blank");
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Launch Gitpod Workspace</span>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full px-6 gap-2 glass border-white/25"
                  onClick={() => {
                    setSandboxMode("stackblitz");
                    setIframeLoaded(false);
                    setIframeError(false);
                    setIframeKey((k) => k + 1);
                  }}
                >
                  <span className="text-xs uppercase tracking-wider">⚡ Try StackBlitz Instead</span>
                </Button>
              </div>
            ) : srcUrl ? (
              <iframe
                key={`${iframeKey}-${sandboxMode}`}
                ref={iframeRef}
                src={srcUrl}
                className="w-full h-full"
                style={{ border: "none" }}
                title={`${project.title} — ${sandboxLabel[sandboxMode]}`}
                allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking; clipboard-write; cross-origin-isolated"
                sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            ) : (
              /* No gitInfo — show GitHub fallback */
              <div className="w-full h-full flex flex-col items-center justify-center gap-5 p-8 text-center">
                <AlertCircle className="w-10 h-10 text-amber-400" />
                <div className="space-y-1">
                  <h3 className="text-lg font-heading font-light">GitHub URL Not Detected</h3>
                  <p className="text-sm text-foreground/50 max-w-sm">
                    Could not parse the repository URL. Open it directly on GitHub.
                  </p>
                </div>
                {project.github && (
                  <Button className="rounded-full px-8 gap-2" asChild>
                    <a href={project.github} target="_blank" rel="noreferrer">
                      <Github className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">View Repository</span>
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* ── Project Details ── */}
          <div className="grid lg:grid-cols-3 gap-8 mt-8">
            {/* Description */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass p-8 rounded-3xl space-y-5">
                <h3 className="font-heading text-sm tracking-[0.2em] uppercase text-primary flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  About This Project
                </h3>
                <p className="text-base font-light text-foreground/70 leading-relaxed italic">
                  "{project.description || "No description provided."}"
                </p>
                {project.tags && project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {project.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] uppercase tracking-widest font-light">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Quick links */}
                <div className="flex flex-wrap gap-3 pt-2 border-t border-foreground/5">
                  {project.github && (
                    <a
                      href={project.github}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-foreground/50 hover:text-primary transition-colors"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span>Source Code</span>
                    </a>
                  )}
                  {project.demo && (
                    <a
                      href={project.demo}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-foreground/50 hover:text-primary transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Live Demo</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Sandbox guide */}
              <div className="glass p-6 rounded-2xl border border-primary/10 space-y-3">
                <h4 className="text-xs uppercase tracking-widest text-primary font-medium">Sandbox Guide</h4>
                <div className="grid grid-cols-2 gap-3 text-xs text-foreground/60">
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none">⚡</span>
                    <div>
                      <p className="font-medium text-foreground/80">StackBlitz</p>
                      <p>Best for JS/TS projects. Instant WebContainer.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none">📦</span>
                    <div>
                      <p className="font-medium text-foreground/80">CodeSandbox</p>
                      <p>Good for React, Vue, Node projects.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none">🖥️</span>
                    <div>
                      <p className="font-medium text-foreground/80">Gitpod</p>
                      <p>Full cloud VS Code IDE. Opens in new tab.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none">🐙</span>
                    <div>
                      <p className="font-medium text-foreground/80">GitHub</p>
                      <p>View raw source code and README.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Card */}
            <div className="glass p-8 rounded-3xl space-y-6 h-fit">
              <h3 className="font-heading text-sm tracking-[0.2em] uppercase text-primary flex items-center gap-2">
                <Rocket className="w-4 h-4" />
                Project Team
              </h3>
              <div className="space-y-5">
                {[
                  { name: project.team?.lead || project.lead_name, role: "Technical Lead" },
                  { name: project.team?.designer || project.designer_name, role: "UI/UX Architect" },
                ]
                  .filter((m) => m.name)
                  .map((member, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full glass border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {member.name![0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest font-medium text-foreground">
                          {member.name}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-foreground/40">
                          {member.role}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Project meta */}
              <div className="pt-4 border-t border-foreground/5 space-y-3 text-xs">
                {project.status && (
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/40 uppercase tracking-widest text-[10px]">Status</span>
                    <Badge variant="outline" className="text-[10px]">{project.status}</Badge>
                  </div>
                )}
                {project.language && (
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/40 uppercase tracking-widest text-[10px]">Language</span>
                    <Badge variant="secondary" className="text-[10px]">{project.language}</Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProjectLive;
