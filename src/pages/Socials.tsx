import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, Instagram, Linkedin, Twitter, Facebook, ExternalLink, Hash, Filter } from "lucide-react";
import { format } from "date-fns";
import { getSocialPosts as getLocalSocialPosts } from "@/lib/stores/socialStore";
import { getAchievements as getLocalAchievements } from "@/lib/stores/achievementStore";
import { getSocialLinks as getRemoteSocialLinks } from "@/lib/services/socialService";
import { getAchievements as getRemoteAchievements } from "@/lib/services/achievementService";

type FeedItem =
  | { type: "social"; data: any }
  | { type: "achievement"; data: any };

const extractInstagramShortcode = (url?: string): string | null => {
  if (!url) return null;
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
};

interface SocialImagePreviewProps {
  data: any;
  platformIcon: React.ReactNode;
}

const SocialImagePreview = ({ data, platformIcon }: SocialImagePreviewProps) => {
  const instaShortcode = extractInstagramShortcode(data.post_url) || extractInstagramShortcode(data.image_url);

  // Always load the embed of the post by default when a shortcode exists
  const [showEmbed, setShowEmbed] = useState<boolean>(!!instaShortcode);
  const [embedLoaded, setEmbedLoaded] = useState<boolean>(false);
  const [embedFailed, setEmbedFailed] = useState<boolean>(false);
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  // If embed fails or network timeout occurs, fall back to generated thumbnail
  useEffect(() => {
    if (instaShortcode && showEmbed) {
      setEmbedLoaded(false);
      setEmbedFailed(false);
      const timer = setTimeout(() => {
        // If not loaded after 6 seconds, assume embed is blocked/failed and fall back to generated thumbnail
        setEmbedLoaded((prevLoaded) => {
          if (!prevLoaded) {
            setEmbedFailed(true);
          }
          return prevLoaded;
        });
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [instaShortcode, showEmbed]);

  // If image_url is an HTML page URL or dead unsplash service, treat as non-image
  const isHtmlOrDeadUrl = data.image_url && (
    data.image_url.includes("instagram.com/p/") ||
    data.image_url.includes("instagram.com/reel/") ||
    data.image_url.includes("source.unsplash.com")
  );

  const hasDirectImage = !!data.image_url && !isHtmlOrDeadUrl && !imgFailed;

  // 1. By default: load the live Instagram embed
  if (instaShortcode && showEmbed && !embedFailed) {
    return (
      <div className="relative aspect-square w-full overflow-hidden bg-black/40">
        {!embedLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/80 backdrop-blur-xs z-10">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] text-muted-foreground font-medium">Loading Instagram Embed…</span>
          </div>
        )}
        <iframe
          src={`https://www.instagram.com/p/${instaShortcode}/embed/`}
          className="w-full h-full border-0"
          title={`Instagram Post ${instaShortcode}`}
          scrolling="no"
          allowTransparency
          onLoad={() => setEmbedLoaded(true)}
          onError={() => setEmbedFailed(true)}
        />
        {/* Toggle button to switch to thumbnail */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowEmbed(false)}
            className="text-[10px] bg-background/85 hover:bg-background px-2.5 py-1 rounded-full text-foreground shadow-md font-medium border border-border backdrop-blur-md transition-colors"
            title="Switch to thumbnail view"
          >
            Show Thumbnail
          </button>
        </div>
      </div>
    );
  }

  // 2. Direct Image rendering (if available and user toggled away from embed or non-insta)
  if (hasDirectImage) {
    return (
      <div className="relative aspect-square overflow-hidden bg-muted/20">
        <img
          src={data.image_url}
          alt={data.content || "Social update"}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute top-4 left-4 z-10">
          <Badge className="bg-background/85 backdrop-blur-md text-foreground border-none flex gap-2 items-center py-1.5 px-3 shadow-sm">
            {platformIcon}
            <span className="capitalize text-xs font-semibold">{data.platform}</span>
          </Badge>
        </div>
        {instaShortcode && (
          <button
            type="button"
            onClick={() => {
              setEmbedFailed(false);
              setShowEmbed(true);
            }}
            className="absolute bottom-3 right-3 z-10 text-[10px] bg-background/85 hover:bg-background backdrop-blur-md text-foreground px-2.5 py-1 rounded-full font-medium shadow-md transition-all flex items-center gap-1.5 border border-white/20"
            title="Load live Instagram embed"
          >
            <span>Load Live Embed</span>
          </button>
        )}
      </div>
    );
  }

  // 3. Generated Thumbnail Fallback
  // If embed can't fetch / fails or image is not available:
  // Render a high-quality, dynamically generated platform thumbnail!
  const isInsta = data.platform === "instagram" || !!instaShortcode;
  const isLinkedIn = data.platform === "linkedin";
  const isTwitter = data.platform === "twitter";

  const gradientClass = isInsta
    ? "from-amber-500/25 via-rose-500/30 to-purple-600/40 border-rose-500/30"
    : isLinkedIn
    ? "from-blue-600/25 via-sky-500/20 to-indigo-600/35 border-blue-500/30"
    : isTwitter
    ? "from-slate-800/50 via-sky-500/15 to-slate-900/50 border-sky-500/30"
    : "from-primary/25 via-purple-500/20 to-blue-500/25 border-primary/30";

  return (
    <div className={`relative aspect-square overflow-hidden bg-gradient-to-br ${gradientClass} flex flex-col justify-between p-6 border-b group-hover:brightness-105 transition-all`}>
      <div className="flex items-center justify-between z-10">
        <Badge className="bg-background/85 backdrop-blur-md text-foreground border-none flex gap-2 items-center py-1.5 px-3 shadow-xs">
          {platformIcon}
          <span className="capitalize text-xs font-semibold">{data.platform}</span>
        </Badge>
        {instaShortcode && (
          <button
            type="button"
            onClick={() => {
              setEmbedFailed(false);
              setShowEmbed(true);
            }}
            className="text-[10px] bg-background/85 hover:bg-background text-foreground px-2.5 py-1 rounded-full font-medium shadow-xs border border-white/20 transition-colors"
          >
            Retry Embed
          </button>
        )}
      </div>

      <div className="space-y-3 text-center py-2 px-2 z-10">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-background/80 backdrop-blur-md flex items-center justify-center text-primary shadow-lg border border-primary/25 transform group-hover:scale-110 transition-transform duration-500">
          {platformIcon}
        </div>
        <div className="space-y-1">
          <p className="font-heading font-semibold text-sm text-foreground tracking-wide">
            {data.username ? `@${data.username}` : "@techshastra_utu"}
          </p>
          <p className="text-xs text-foreground/80 line-clamp-3 italic leading-relaxed px-1">
            "{data.content || "Official update and announcement from TECHSHASTRA club community."}"
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-foreground/60 uppercase tracking-widest font-mono z-10 pt-2 border-t border-foreground/10">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {isInsta ? "Instagram Post" : `${data.platform} Update`}
        </span>
        <span>TECHSHASTRA</span>
      </div>
    </div>
  );
};

const Socials = () => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      let socials: any[] = [];
      let achievements: any[] = [];

      try {
        const [remoteSocials, remoteAchievements] = await Promise.all([
          getRemoteSocialLinks(),
          getRemoteAchievements(),
        ]);
        if (remoteSocials && remoteSocials.length > 0) {
          socials = remoteSocials;
        }
        if (remoteAchievements && remoteAchievements.length > 0) {
          achievements = remoteAchievements;
        }
      } catch (_e) {}

      if (socials.length === 0) {
        socials = await getLocalSocialPosts();
      }
      if (achievements.length === 0) {
        achievements = await getLocalAchievements();
      }

      const combined: FeedItem[] = [
        ...socials.map(s => ({
          type: "social" as const,
          data: {
            ...s,
            username: s.author || s.username || "TECHSHASTRA",
            post_url: s.url || s.post_url || "#",
            content: s.content || s.description || "",
            posted_at: s.posted_at || s.created_at || new Date().toISOString(),
          },
        })),
        ...achievements.map(a => ({
          type: "achievement" as const,
          data: {
            ...a,
            date: a.achievement_date || a.date || new Date().toISOString(),
          },
        })),
      ];

      // Sort by date (descending)
      combined.sort((a, b) => {
        const dateA = new Date(a.type === "social" ? a.data.posted_at : a.data.date);
        const dateB = new Date(b.type === "social" ? b.data.posted_at : b.data.date);
        return dateB.getTime() - dateA.getTime();
      });

      setItems(combined);
    } catch (err) {
      console.error("Failed to fetch social feed", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === "all") return true;
    if (filter === "achievements") return item.type === "achievement";
    if (item.type === "social") return item.data.platform === filter;
    return false;
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram": return <Instagram className="w-5 h-5" />;
      case "linkedin": return <Linkedin className="w-5 h-5" />;
      case "twitter": return <Twitter className="w-5 h-5" />;
      case "facebook": return <Facebook className="w-5 h-5" />;
      default: return <Hash className="w-5 h-5" />;
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemAnim = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />

      <main className="container mx-auto px-4 py-16 sm:py-24">
        {/* Hero Section */}
        <div className="text-center mb-10 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-4 px-4 py-1 border-primary/30 text-primary bg-primary/5 text-[10px] sm:text-xs">
              Updates & Milestones
            </Badge>
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-primary via-purple-500 to-blue-500 bg-clip-text text-transparent leading-tight">
              Socials & Impact
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Follow our journey, celebrate our wins, and stay connected with the TECHSHASTRA community.
            </p>
          </motion.div>

          {/* Filter Bar */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-8 sm:mt-10">
            {[
              { id: "all", label: "All Feed", icon: Filter },
              { id: "achievements", label: "Achievements", icon: Trophy },
              { id: "instagram", label: "Instagram", icon: Instagram },
              { id: "linkedin", label: "LinkedIn", icon: Linkedin },
            ].map((f) => (
              <Button
                key={f.id}
                variant={filter === f.id ? "default" : "outline"}
                onClick={() => setFilter(f.id)}
                className="rounded-full px-4 sm:px-6 h-9 sm:h-10 gap-2 transition-all duration-300 text-xs sm:text-sm"
              >
                <f.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-80 sm:h-96 bg-muted animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-xl sm:text-2xl text-muted-foreground">No posts found.</p>
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto"
          >
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <motion.div
                  layout
                  key={item.type === "social" ? item.data.id : item.data.id}
                  variants={itemAnim}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group"
                >
                  {item.type === "social" ? (
                    <Card className="h-full overflow-hidden border-2 hover:border-primary/40 transition-all duration-500 rounded-3xl glass shadow-xl hover:shadow-primary/10">
                      <SocialImagePreview
                        data={item.data}
                        platformIcon={getPlatformIcon(item.data.platform)}
                      />
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {item.data.username?.[0]?.toUpperCase() || "T"}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{item.data.username}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(item.data.posted_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <p className="text-muted-foreground text-sm line-clamp-3 mb-6">
                          {item.data.content}
                        </p>
                        <a href={item.data.post_url} target="_blank" rel="noopener noreferrer">
                          <Button className="w-full rounded-2xl gap-2 font-bold group/btn" variant="secondary">
                            View Original Post
                            <ExternalLink className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </a>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="h-full bg-gradient-to-br from-primary/5 to-purple-500/5 border-2 border-primary/20 hover:border-primary/60 transition-all duration-500 rounded-3xl glass shadow-xl">
                      <CardHeader>
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 rotating-glow">
                          <Trophy className="w-8 h-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                          {item.data.title}
                        </CardTitle>
                        <CardDescription className="text-xs font-medium">
                          {format(new Date(item.data.date), "MMMM d, yyyy")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {item.data.image_url && (
                          <div className="rounded-2xl overflow-hidden mb-4 border border-primary/10">
                            <img src={item.data.image_url} alt={item.data.title} className="w-full h-auto" />
                          </div>
                        )}
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {item.data.description}
                        </p>
                        <div className="mt-8 flex gap-2">
                          <Badge variant="secondary" className="bg-primary/5 text-primary">Award Received</Badge>
                          <Badge variant="secondary" className="bg-purple-500/5 text-purple-500">Milestone</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      <Footer />

      <style>{`
        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
        }
        .dark .glass {
          background: rgba(0, 0, 0, 0.2);
        }
        .rotating-glow {
          position: relative;
        }
        .rotating-glow::after {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          background: linear-gradient(45deg, #a855f7, #3b82f6, #a855f7);
          z-index: -1;
          filter: blur(8px);
          opacity: 0.5;
          animation: rotate 4s linear infinite;
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Socials;
