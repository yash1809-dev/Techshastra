/**
 * ForgotPasswordModal.tsx
 *
 * TechShastra High-Contrast Theme-Matched Password Reset Flow:
 * - Opaque high-contrast card matching TechShastra aesthetic.
 * - Supports both:
 *   1. Supabase Reset Password email link (direct redirect to password reset).
 *   2. Supabase 6-digit verification code (if configured).
 */

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import {
  sendPasswordResetEmail,
  verifyPasswordResetOtp,
  updatePassword,
  signOut,
} from "@/lib/services/authService";
import {
  Mail,
  CheckCircle2,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  ShieldCheck,
  ChevronLeft,
  KeyRound,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
  initialStep?: Step;
  onSuccess?: (email: string) => void;
}

type Step = "request" | "verify" | "reset" | "success";

export const ForgotPasswordModal: React.FC<Props> = ({
  open,
  onClose,
  initialEmail = "",
  initialStep = "request",
  onSuccess,
}) => {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync initial state when modal opens
  useEffect(() => {
    if (open) {
      if (initialEmail && !email) setEmail(initialEmail);
      setStep(initialStep);
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open, initialEmail, initialStep]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Send Reset Link / OTP
  const handleSendLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(cleanEmail);
      toast({
        title: "Reset Email Sent 📬",
        description: `Password reset instructions have been sent to ${cleanEmail}.`,
      });
      setStep("verify");
      setResendCooldown(60);
    } catch (err: any) {
      toast({
        title: "Request Failed",
        description: err.message || "Unable to send password reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP (if user received a 6-digit code)
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.length !== 6) {
      toast({
        title: "Incomplete Code",
        description: "Please enter the complete 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await verifyPasswordResetOtp(email, otp);
      toast({
        title: "Code Verified ✅",
        description: "You may now set a new password.",
      });
      setStep("reset");
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message || "Invalid or expired code. Please use the link in your email.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Update Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
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
        description: "Please make sure both password fields match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await updatePassword(newPassword);
      // Clean sign out so user can log in with new password
      await signOut();

      setStep("success");
      toast({
        title: "Password Reset Successfully 🎉",
        description: "Your password has been updated. You can now log in with your new credentials.",
      });

      if (onSuccess) onSuccess(email);
    } catch (err: any) {
      toast({
        title: "Password Update Failed",
        description: err.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[92dvh] overflow-y-auto p-0 rounded-3xl bg-[#0f1422] text-[#f8fafc] border border-white/15 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] my-auto">
        
        {/* Top TechShastra Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-purple-500 to-sky-400 shrink-0" />

        <div className="p-5 sm:p-7 space-y-5">
          {/* Header */}
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-inner">
                {step === "reset" ? <KeyRound size={20} /> : <ShieldCheck size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-lg font-heading font-semibold text-white tracking-wide truncate">
                  {step === "request" && "Reset Your Password"}
                  {step === "verify" && "Check Your Inbox"}
                  {step === "reset" && "Create New Password"}
                  {step === "success" && "Password Updated"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300">
                  {step === "request" && "Enter your registered email to receive reset instructions."}
                  {step === "verify" && `We've sent a reset email to ${email}`}
                  {step === "reset" && "Choose a new strong password for your account."}
                  {step === "success" && "Your password has been changed successfully."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* ── STEP 1: REQUEST RESET ── */}
          {step === "request" && (
            <form onSubmit={handleSendLink} className="space-y-4 pt-1">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-xs font-medium uppercase tracking-wider text-slate-300">
                  Account Email Address
                </Label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-11 h-12 text-sm rounded-2xl bg-[#1a2234] border border-white/10 text-white placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/25 text-xs text-slate-200 leading-relaxed">
                Supabase will send a secure password reset link to your email. Click the link in the email to set a new password.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="h-11 px-5 text-xs rounded-2xl text-slate-300 hover:text-white hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 px-6 text-xs rounded-2xl bg-primary text-primary-foreground font-medium gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      Send Reset Link <ArrowRight size={14} />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* ── STEP 2: EMAIL SENT / VERIFY ── */}
          {step === "verify" && (
            <div className="space-y-4 pt-1">
              <div className="p-4 rounded-2xl bg-[#1a2234] border border-white/10 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                    <Mail size={16} />
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-medium text-white">Email Sent</p>
                    <p className="text-slate-300 leading-relaxed">
                      Please open your email inbox (<strong className="text-white">{email}</strong>) and click the <strong className="text-sky-400">"Reset password"</strong> link inside.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Didn't receive the email?</span>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || loading}
                    onClick={() => handleSendLink()}
                    className="text-primary hover:underline disabled:opacity-50 flex items-center gap-1 font-medium"
                  >
                    <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend email"}
                  </button>
                </div>
              </div>

              {/* Optional: Enter 6-digit OTP if user received code */}
              <div className="pt-2 border-t border-white/10 space-y-3">
                <p className="text-[11px] font-medium text-slate-300 text-center">
                  Or enter the 6-digit code if your email has one:
                </p>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(val) => setOtp(val)}
                  >
                    <InputOTPGroup className="gap-1 sm:gap-1.5">
                      <InputOTPSlot index={0} className="w-8 sm:w-10 h-11 text-sm sm:text-base font-mono bg-[#1a2234] border-white/15 text-white" />
                      <InputOTPSlot index={1} className="w-8 sm:w-10 h-11 text-sm sm:text-base font-mono bg-[#1a2234] border-white/15 text-white" />
                      <InputOTPSlot index={2} className="w-8 sm:w-10 h-11 text-sm sm:text-base font-mono bg-[#1a2234] border-white/15 text-white" />
                      <InputOTPSlot index={3} className="w-8 sm:w-10 h-11 text-sm sm:text-base font-mono bg-[#1a2234] border-white/15 text-white" />
                      <InputOTPSlot index={4} className="w-8 sm:w-10 h-11 text-sm sm:text-base font-mono bg-[#1a2234] border-white/15 text-white" />
                      <InputOTPSlot index={5} className="w-8 sm:w-10 h-11 text-sm sm:text-base font-mono bg-[#1a2234] border-white/15 text-white" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("request")}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <ChevronLeft size={13} /> Change email
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    className="h-10 px-4 text-xs rounded-xl text-slate-300 hover:text-white"
                  >
                    Close
                  </Button>
                  {otp.length === 6 && (
                    <Button
                      type="button"
                      disabled={loading}
                      onClick={() => handleVerifyOtp()}
                      className="h-10 px-5 text-xs rounded-xl bg-primary text-primary-foreground font-medium"
                    >
                      {loading ? <Loader2 size={13} className="animate-spin" /> : "Verify Code"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: CREATE NEW PASSWORD ── */}
          {step === "reset" && (
            <form onSubmit={handleUpdatePassword} className="space-y-4 pt-1">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-xs font-medium uppercase tracking-wider text-slate-300">
                  New Password
                </Label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    id="new-password"
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

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-medium uppercase tracking-wider text-slate-300">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="pl-11 h-12 text-sm rounded-2xl bg-[#1a2234] border border-white/10 text-white placeholder:text-slate-500 focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="h-11 px-5 text-xs rounded-2xl text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="h-11 px-6 text-xs rounded-2xl bg-primary text-primary-foreground font-medium gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      Update Password <CheckCircle2 size={14} />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* ── STEP 4: SUCCESS ── */}
          {step === "success" && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <CheckCircle2 size={28} />
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="font-heading font-medium text-base text-white">
                  Password Updated Successfully
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your password has been changed. You can now sign in with your new credentials.
                </p>
              </div>
              <Button
                onClick={onClose}
                className="mt-2 h-11 px-8 text-xs rounded-2xl bg-primary text-primary-foreground font-medium shadow-md shadow-primary/20"
              >
                Back to Sign In
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordModal;
