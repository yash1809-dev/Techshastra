# EGM Specification: Password Reset via Supabase Auth OTP with Resend Custom SMTP

- **Author:** TechShastra Engineering
- **Status:** Draft / Ready for User Dashboard Actions
- **Date:** 2026-11-21
- **Domain:** `techshastra.vmsbutu.live`
- **Email Delivery:** Resend via Supabase Custom SMTP Integration

---

## 1. Architectural Invariants

1. **Supabase Auth Ownership**:
   - Supabase generates, stores, expires (default 10-60 mins), and cryptographically validates the 6-digit OTP.
   - Supabase verifies the token with `supabase.auth.verifyOtp({ email, token, type: 'recovery' })`.
   - Supabase saves the updated password via `supabase.auth.updateUser({ password: newPassword })`.
2. **Resend SMTP Delegation**:
   - Resend acts strictly as the custom SMTP transport configured in the **Supabase Dashboard** (`Project Settings -> Auth -> SMTP Settings`).
   - No Resend API keys or SMTP passwords are ever exposed to or embedded in the client/frontend repository.
3. **Sender Identity**:
   - Sent from: `TechShastra <noreply@techshastra.vmsbutu.live>` or `TechShastra <auth@techshastra.vmsbutu.live>`.
4. **State Machine in Frontend**:
   - **Step 1 (Request)**: Input email -> `supabase.auth.resetPasswordForEmail(email)`
   - **Step 2 (Verify)**: Input 6-digit OTP -> `supabase.auth.verifyOtp({ email, token, type: 'recovery' })`
   - **Step 3 (Reset)**: Input new password -> `supabase.auth.updateUser({ password: newPassword })` -> Success toast -> Return to sign-in.

---

## 2. Component Design & Code Reusability

- Reuse `src/lib/services/authService.ts`:
  - `sendPasswordResetOtp(email: string)`
  - `verifyPasswordResetOtp(email: string, token: string)`
  - `updatePassword(newPassword: string)`
- Add `src/components/auth/ForgotPasswordModal.tsx`:
  - Responsive dialog using Radix UI / Shadcn `Dialog` and `InputOTP`.
  - Clean 3-step wizard with resend countdown timer (60s).
- Integrate with `src/pages/Join.tsx`:
  - Hook into `SigninForm` next to the Password label: "Forgot Password?".

---

## 3. TechShastra HTML Email Template

Located in `supabase/email_templates/recovery.html` for placement into Supabase Dashboard -> Auth -> Email Templates -> Reset Password.
Uses token placeholder `{{ .Token }}`.
