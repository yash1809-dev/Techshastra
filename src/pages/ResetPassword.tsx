/**
 * ResetPassword.tsx
 *
 * Dedicated Password Reset Page:
 * - Directly handles recovery link from Supabase email.
 * - Shows ONLY New Password + Confirm Password.
 * - Updates the password in Supabase Auth and redirects to Sign In.
 */

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  Loader2,
  ShieldAlert,
} from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSessionError("Supabase backend is not configured.");
      return;
    }

    // 1. Check if user already has an active session from recovery link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
    });

    // 2. Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionReady(true);
        setSessionError(null);
      }
    });

    // 3. Fallback: Check URL hash for error
    const hash = window.location.hash;
    if (hash && hash.includes("error_description")) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      const desc = params.get("error_description");
      if (desc) {
        setSessionError(decodeURIComponent(desc));
      }
    }

    // If after 2 seconds no session or error, allow user to proceed
    const timer = setTimeout(() => {
      setSessionReady(true);
    }, 1500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Your new password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Do Not Match",
        description: "Please make sure both password fields are identical.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Cleanly sign out recovery session
      await supabase.auth.signOut();

      setSuccess(true);
      toast({
        title: "Password Updated 🎉",
        description: "Your password has been successfully reset. Please sign in with your new credentials.",
      });
    } catch (err: any) {
      toast({
        title: "Reset Failed",
        description: err.message || "Unable to update password. Please request a new reset link.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <Navbar />

      <main className="container mx-auto px-4 py-24 flex items-center justify-center flex-1">
        <div className="w-full max-w-md">
          <Card className="rounded-3xl bg-[#0f1422] text-[#f8fafc] border border-white/15 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden">
            {/* Top Gradient Line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-purple-500 to-sky-400" />

            <CardHeader className="p-6 sm:p-8 pb-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-inner">
                  {success ? <CheckCircle2 size={22} className="text-emerald-400" /> : <KeyRound size={22} />}
                </div>
                <div>
                  <CardTitle className="text-xl font-heading font-semibold text-white tracking-wide">
                    {success ? "Password Updated" : "Set New Password"}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-300 mt-0.5">
                    {success
                      ? "Your new password is now active in the database."
                      : "Enter your new account password below."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 pt-2">
              {sessionError && !success ? (
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/25 flex items-start gap-3 text-xs text-destructive">
                    <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Invalid or Expired Link</p>
                      <p className="text-slate-300 mt-1 leading-relaxed">
                        {sessionError}. Password reset links expire after one use. Please request a new reset email.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate("/join?tab=signin")}
                    className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-medium text-xs"
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : success ? (
                <div className="space-y-5 py-3 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-inner">
                    <CheckCircle2 size={30} />
                  </div>
                  <div className="space-y-1.5 max-w-xs mx-auto">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Your old password has been replaced in the database. You can now sign in using your new password.
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate("/join?tab=signin")}
                    className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-medium text-xs gap-2 shadow-lg shadow-primary/20"
                  >
                    Go to Sign In <ArrowRight size={14} />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pw" className="text-xs font-medium uppercase tracking-wider text-slate-300">
                      New Password
                    </Label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="new-pw"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="pl-11 pr-11 h-12 text-sm rounded-2xl bg-[#1a2234] border border-white/10 text-white placeholder:text-slate-500 focus:border-primary"
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pw" className="text-xs font-medium uppercase tracking-wider text-slate-300">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="confirm-pw"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        className="pl-11 h-12 text-sm rounded-2xl bg-[#1a2234] border border-white/10 text-white placeholder:text-slate-500 focus:border-primary"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !newPassword || !confirmPassword}
                    className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-medium text-xs gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Saving Password...
                      </>
                    ) : (
                      <>
                        Update Password & Continue <ArrowRight size={14} />
                      </>
                    )}
                  </Button>

                  <div className="pt-2 text-center">
                    <Link
                      to="/join?tab=signin"
                      className="text-xs text-slate-400 hover:text-white hover:underline transition-colors"
                    >
                      Return to Sign In
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
