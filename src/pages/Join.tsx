/**
 * Join Page
 *
 * • Students  → sign up (creates profile) or sign in (cookie session)
 * • Mentors / Partners → enquiry form (unchanged)
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  Sparkles,
  User,
  Github,
  Linkedin,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react";
import { createStudent, getStudentSession } from "@/lib/studentStore";
import { registerStudentProfile } from "@/lib/services/studentService";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { submitMembershipApplication } from "@/lib/services/applicationService";
import { ForgotPasswordModal } from "@/components/auth/ForgotPasswordModal";
import { supabase } from "@/lib/supabase/client";

// ─── INTERESTS (reused from original) ────────────────────────────────────────

const INTERESTS = [
  "Web Development",
  "AI & Machine Learning",
  "Cybersecurity",
  "Internet of Things (IoT)",
  "Robotics & Automation",
  "App Development",
  "Cloud Computing",
  "Blockchain Technology",
  "Data Science",
  "UI/UX Design",
  "AR/VR Development",
  "Game Development",
  "FinTech",
  "EdTech",
  "Renewable Energy Tech",
];

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(70, "Name cannot exceed 70 characters")
      .regex(/^[a-zA-Z\s.'-]+$/, "Name should only contain letters, spaces, hyphens, and periods")
      .refine((v) => !/[<>{}[\]\\;/=^`~]/.test(v), "Special characters are not allowed in name"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please enter a valid email address")
      .max(255),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72)
      .refine((v) => v.trim().length >= 8, "Password cannot be whitespace only"),
    confirmPassword: z.string(),
    contact: z
      .string()
      .trim()
      .regex(/^[+]?[0-9\s-]{10,15}$/, "Please enter a valid 10-15 digit phone number"),
    course: z.string().optional(),
    year: z.string().optional(),
    rollNumber: z
      .string()
      .trim()
      .max(30)
      .regex(/^[a-zA-Z0-9\-_/]*$/, "Roll number should only contain alphanumeric characters, hyphens, or slashes")
      .optional()
      .or(z.literal("")),
    githubUsername: z
      .string()
      .min(1, "GitHub username is required")
      // Strip full URLs — accept both "octocat" and "https://github.com/octocat"
      .transform((v) => v.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/$/, "").trim())
      .pipe(
        z
          .string()
          .min(1, "GitHub username is required")
          .max(39)
          .regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/, "Invalid GitHub username")
      ),
    linkedinUrl: z
      .string()
      // Auto-prepend https:// if the user omitted the scheme
      .transform((v) => {
        const t = v.trim();
        if (!t) return t;
        return /^https?:\/\//i.test(t) ? t : `https://${t}`;
      })
      .pipe(z.string().url("Must be a valid URL").or(z.literal("")))
      .optional()
      .or(z.literal("")),
    bio: z.string().max(500).optional(),
    interests: z.array(z.string()).min(1, "Select at least one interest"),
    agreement: z
      .boolean()
      .refine((v) => v === true, "You must agree to continue"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

const enquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .regex(/^[a-zA-Z\s.'-]+$/, "Name should only contain letters, spaces, hyphens, and periods")
    .refine((v) => !/[<>{}[\]\\;/=^`~]/.test(v), "Special characters are not allowed in name"),
  organization: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(255),
  contact: z.string().trim().regex(/^[+]?[0-9\s-]{10,15}$/, "Please enter a valid 10-15 digit phone number"),
  reason: z.string().trim().min(20, "Please provide at least 20 characters").max(1000),
  interests: z.array(z.string()).min(1, "Select at least one interest"),
  agreement: z
    .boolean()
    .refine((v) => v === true, "You must agree to continue"),
});

type SignupData = z.infer<typeof signupSchema>;
type SigninData = z.infer<typeof signinSchema>;
type EnquiryData = z.infer<typeof enquirySchema>;

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const inputCls =
  "glass h-14 rounded-2xl border-0 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-foreground/35 placeholder:font-light";

/** Shared interests checkbox grid */
const InterestsGrid = ({
  control,
}: {
  control: ReturnType<typeof useForm<SignupData>>["control"];
}) => (
  <FormField
    control={control}
    name="interests"
    render={() => (
      <FormItem className="space-y-6">
        <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">
          Domains of Interest
        </FormLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {INTERESTS.map((interest) => (
            <FormField
              key={interest}
              control={control}
              name="interests"
              render={({ field }) => (
                <FormItem key={interest}>
                  <FormControl>
                    <div className="relative group">
                      <Checkbox
                        id={`su-${interest}`}
                        checked={field.value?.includes(interest)}
                        onCheckedChange={(checked) =>
                          checked
                            ? field.onChange([...field.value, interest])
                            : field.onChange(
                                field.value?.filter((v) => v !== interest)
                              )
                        }
                        className="peer sr-only"
                      />
                      <label
                        htmlFor={`su-${interest}`}
                        className="flex items-center justify-center rounded-xl glass p-4 text-center hover:bg-primary/5 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground cursor-pointer transition-all duration-300 min-h-[60px]"
                      >
                        <span className="text-[10px] uppercase font-light tracking-widest">
                          {interest}
                        </span>
                      </label>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
        </div>
        <FormMessage />
      </FormItem>
    )}
  />
);

// ─── SIGNUP FORM ──────────────────────────────────────────────────────────────

const SignupForm = ({
  onSuccess,
  onSwitchToSignin,
}: {
  onSuccess: (username: string) => void;
  onSwitchToSignin?: () => void;
}) => {
  const { toast } = useToast();
  const { login } = useStudentAuth();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      contact: "",
      course: "",
      year: "",
      rollNumber: "",
      githubUsername: "",
      linkedinUrl: "",
      bio: "",
      interests: [],
      agreement: false,
    },
  });

  const onSubmit = async (data: SignupData) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast({
        title: "Offline",
        description: "You are currently offline. Please check your internet connection before registering.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      // 1. Persist directly to Supabase Backend
      const profile = await registerStudentProfile({
        name: data.name,
        email: data.email,
        password: data.password,
        rollNumber: data.rollNumber,
        course: data.course,
        year: data.year,
        bio: data.bio,
        githubUsername: data.githubUsername,
        linkedinUrl: data.linkedinUrl || undefined,
        interests: data.interests,
        skills: [],
      });

      if (!profile) {
        toast({
          title: "Registration Failed",
          description: "Database is not reachable. Please check your network or try again later.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // 2. Also keep local store updated for seamless offline/fallback
      try {
        createStudent({
          name: data.name,
          email: data.email,
          password: data.password,
          rollNumber: data.rollNumber,
          course: data.course,
          year: data.year,
          bio: data.bio,
          githubUsername: data.githubUsername,
          linkedinUrl: data.linkedinUrl || undefined,
          skills: [],
          education: [],
          experience: [],
          certifications: [],
          interests: data.interests,
        });
      } catch (_localErr) {
        // If already in local store but created in remote, ignore duplicate local error
      }

      // 3. Authenticate the student session
      const loginOk = await login(data.email, data.password);
      if (!loginOk) {
        toast({
          title: "Account Created! Verification Needed",
          description: "Your profile was registered, but automatic login was not completed. If email confirmation is required, please check your inbox and then sign in.",
        });
        if (onSwitchToSignin) {
          onSwitchToSignin();
        }
        setLoading(false);
        return;
      }

      // 4. ONLY show Welcome message if profile creation AND login were verified
      toast({
        title: "Welcome to TechShastra! 🎉",
        description: "Your profile has been created and you are now signed in.",
      });
      onSuccess(data.githubUsername);
    } catch (remoteErr: any) {
      if (remoteErr?.message === "EMAIL_EXISTS") {
        form.setError("email", { message: "This email is already registered. Sign in instead." });
        return;
      }
      if (remoteErr?.message === "USERNAME_EXISTS") {
        form.setError("githubUsername", { message: "This GitHub username is already taken. Please choose another." });
        return;
      }
      console.error("Supabase registration error:", remoteErr);
      toast({
        title: "Registration Failed",
        description: remoteErr?.message || "Could not create account in database. Please verify your details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Row 1: name + email */}
        <div className="grid md:grid-cols-2 gap-6">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Full Name</FormLabel>
              <FormControl><Input {...field} className={inputCls} placeholder="Your Name" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Email</FormLabel>
              <FormControl><Input type="email" {...field} className={inputCls} placeholder="you@example.com" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Row 2: password + confirm */}
        <div className="grid md:grid-cols-2 gap-6">
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} {...field} className={inputCls} placeholder="Min 8 characters" />
                  <button type="button" onClick={() => setShowPw((p) => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="confirmPassword" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Confirm Password</FormLabel>
              <FormControl><Input type={showPw ? "text" : "password"} {...field} className={inputCls} placeholder="Repeat password" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Row 3: contact + roll */}
        <div className="grid md:grid-cols-2 gap-6">
          <FormField control={form.control} name="contact" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Contact Number</FormLabel>
              <FormControl><Input type="tel" {...field} className={inputCls} placeholder="+91 XXXXXXXXXX" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="rollNumber" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Roll Number (optional)</FormLabel>
              <FormControl><Input {...field} className={inputCls} placeholder="21XXXXX" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Row 4: course + year */}
        <div className="grid md:grid-cols-2 gap-6">
          <FormField control={form.control} name="course" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Course / Branch</FormLabel>
              <FormControl><Input {...field} className={inputCls} placeholder="B.Tech CSE" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="year" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Year of Study</FormLabel>
              <FormControl><Input {...field} className={inputCls} placeholder="2nd Year" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* GitHub + LinkedIn */}
        <div className="grid md:grid-cols-2 gap-6">
          <FormField control={form.control} name="githubUsername" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50 flex items-center gap-1">
                <Github size={12} /> GitHub Username *
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 text-sm">github.com/</span>
                  <Input {...field} className={`${inputCls} pl-24`} placeholder="octocat" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="linkedinUrl" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50 flex items-center gap-1">
                <Linkedin size={12} /> LinkedIn URL (optional)
              </FormLabel>
              <FormControl><Input {...field} className={inputCls} placeholder="https://linkedin.com/in/yourname" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Bio */}
        <FormField control={form.control} name="bio" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Short Bio (optional)</FormLabel>
            <FormControl>
              <Textarea {...field} className="glass min-h-[100px] rounded-2xl border-0 focus-visible:ring-1 focus-visible:ring-primary/30 resize-none p-6 font-light italic placeholder:text-foreground/35 placeholder:font-light" placeholder="Tell us about yourself..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Interests */}
        <InterestsGrid control={form.control as ReturnType<typeof useForm<SignupData>>["control"]} />

        {/* Agreement */}
        <FormField control={form.control} name="agreement" render={({ field }) => (
          <FormItem className="flex flex-row items-center space-x-4 space-y-0 p-6 glass rounded-2xl bg-primary/5">
            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/60 cursor-pointer">
              I align with TechShastra's collective vision and values.
            </FormLabel>
          </FormItem>
        )} />

        <Button type="submit" disabled={loading}
          className="w-full h-16 rounded-full bg-primary text-primary-foreground font-heading font-light tracking-widest uppercase text-sm hover:scale-[1.01] transition-all duration-500 shadow-2xl">
          {loading ? "Creating Profile…" : <><UserPlus size={16} className="mr-2" />Create My Profile</>}
        </Button>
      </form>
    </Form>
  );
};

// ─── SIGNIN FORM ──────────────────────────────────────────────────────────────

const SigninForm = ({ onSuccess }: { onSuccess: (username: string) => void }) => {
  const { toast } = useToast();
  const { login } = useStudentAuth();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "verify" | "reset">("request");

  const form = useForm<SigninData>({
    resolver: zodResolver(signinSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    // Automatically open "Set New Password" modal when user clicks recovery link in their email
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (hash.includes("type=recovery") || search.includes("mode=recovery")) {
      setForgotStep("reset");
      setShowForgot(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setForgotStep("reset");
        setShowForgot(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (data: SigninData) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast({
        title: "Offline",
        description: "You are currently offline. Please check your internet connection before signing in.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const ok = await login(data.email, data.password);
    if (ok) {
      const session = getStudentSession();
      toast({ title: `Welcome back, ${session?.name}!` });
      onSuccess(session?.githubUsername ?? "");
    } else {
      form.setError("password", { message: "Invalid email or password." });
    }
    setLoading(false);
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Email</FormLabel>
              <FormControl><Input type="email" {...field} className={inputCls} placeholder="you@example.com" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Password</FormLabel>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-[11px] text-primary/80 hover:text-primary hover:underline transition-colors font-light tracking-wider"
                >
                  Forgot Password?
                </button>
              </div>
              <FormControl>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} {...field} className={inputCls} placeholder="Your password" />
                  <button type="button" onClick={() => setShowPw((p) => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" disabled={loading}
            className="w-full h-16 rounded-full bg-primary text-primary-foreground font-heading font-light tracking-widest uppercase text-sm hover:scale-[1.01] transition-all duration-500 shadow-2xl">
            {loading ? "Signing In…" : <><LogIn size={16} className="mr-2" />Sign In</>}
          </Button>
        </form>
      </Form>

      <ForgotPasswordModal
        open={showForgot}
        onClose={() => {
          setShowForgot(false);
          setForgotStep("request");
        }}
        initialStep={forgotStep}
        initialEmail={form.getValues("email")}
        onSuccess={(emailReset) => {
          setShowForgot(false);
          setForgotStep("request");
          form.setValue("email", emailReset);
        }}
      />
    </>
  );
};

// ─── ENQUIRY FORM (mentor / partner) ─────────────────────────────────────────

const EnquiryForm = ({ role }: { role: "mentor" | "partner" }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<EnquiryData>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { name: "", organization: "", email: "", contact: "", reason: "", interests: [], agreement: false },
  });

  const onSubmit = async (data: EnquiryData) => {
    setLoading(true);
    try {
      await submitMembershipApplication({
        applicant_type: role,
        name: data.name,
        email: data.email,
        phone: data.contact,
        organization: data.organization || null,
        reason: data.reason,
        interests: data.interests,
        academic_details: {},
        github_username: null,
        linkedin_url: null,
      });
      setDone(true);
      toast({ title: "Application Submitted! 🎉", description: `We'll be in touch soon.` });
    } catch (e) {
      toast({ title: "Submission Error", description: "Failed to submit application. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="py-16 text-center space-y-4">
      <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
      <p className="text-foreground/60 font-light">Your enquiry has been received. We'll contact you soon.</p>
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid md:grid-cols-2 gap-6">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Full Name</FormLabel>
              <FormControl><Input {...field} className={inputCls} placeholder="Your Name" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Email</FormLabel>
              <FormControl><Input type="email" {...field} className={inputCls} placeholder="you@example.com" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <FormField control={form.control} name="contact" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Contact Number</FormLabel>
              <FormControl><Input type="tel" {...field} className={inputCls} placeholder="+91 XXXXXXXXXX" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="organization" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Organization</FormLabel>
              <FormControl><Input {...field} className={inputCls} placeholder="Company or Institution" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="reason" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Motivation</FormLabel>
            <FormControl>
              <Textarea {...field} className="glass min-h-[120px] rounded-2xl border-0 focus-visible:ring-1 focus-visible:ring-primary/30 resize-none p-6 font-light italic" placeholder="Tell us about your innovative spirit..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {/* Interests for enquiry form — cast needed because it's a different schema */}
        <FormField control={form.control as unknown as ReturnType<typeof useForm<SignupData>>["control"]} name="interests" render={() => (
          <FormItem className="space-y-6">
            <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/50">Domains of Interest</FormLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {INTERESTS.map((interest) => (
                <FormField key={interest} control={form.control as unknown as ReturnType<typeof useForm<SignupData>>["control"]} name="interests" render={({ field }) => (
                  <FormItem key={interest}>
                    <FormControl>
                      <div>
                        <Checkbox id={`eq-${interest}`} checked={(field.value as string[]).includes(interest)}
                          onCheckedChange={(checked) => checked
                            ? field.onChange([...(field.value as string[]), interest])
                            : field.onChange((field.value as string[]).filter((v) => v !== interest))}
                          className="peer sr-only" />
                        <label htmlFor={`eq-${interest}`}
                          className="flex items-center justify-center rounded-xl glass p-4 text-center hover:bg-primary/5 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground cursor-pointer transition-all duration-300 min-h-[60px]">
                          <span className="text-[10px] uppercase font-light tracking-widest">{interest}</span>
                        </label>
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="agreement" render={({ field }) => (
          <FormItem className="flex flex-row items-center space-x-4 space-y-0 p-6 glass rounded-2xl bg-primary/5">
            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel className="text-xs font-light tracking-widest uppercase text-foreground/60 cursor-pointer">
              I align with TechShastra's collective vision and values.
            </FormLabel>
          </FormItem>
        )} />
        <Button type="submit" disabled={loading}
          className="w-full h-16 rounded-full bg-primary text-primary-foreground font-heading font-light tracking-widest uppercase text-sm hover:scale-[1.01] transition-all duration-500 shadow-2xl">
          {loading ? "Processing…" : "Submit Application"}
        </Button>
      </form>
    </Form>
  );
};

// ─── PAGE ──────────────────────────────────────────────────────────────────────

const Join = () => {
  const navigate = useNavigate();
  const { session } = useStudentAuth();
  const [mainTab, setMainTab] = useState("student");
  const [studentTab, setStudentTab] = useState<"signup" | "signin">("signup");

  useEffect(() => {
    // If recovery parameters or hash are present, redirect to the dedicated reset password page
    if (
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("mode=recovery")
    ) {
      navigate("/reset-password" + window.location.hash, { replace: true });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "signin") {
      setStudentTab("signin");
    }
  }, [navigate]);

  // Already logged-in student: offer profile redirect
  const handleSuccess = (githubUsername: string) => {
    navigate(`/members/${githubUsername}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center mb-16 space-y-6">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass text-[10px] tracking-[0.2em] uppercase text-primary font-medium">
              Join Our Ecosystem
            </div>
            <h1 className="text-4xl md:text-7xl font-heading font-light tracking-tight">
              <span className="text-foreground">Apply for </span>
              <span className="text-primary italic">Membership</span>
            </h1>
            <p className="text-lg text-foreground/50 max-w-2xl mx-auto font-light tracking-wide italic">
              "Innovate, Create, Dominate — Join the technical elite of Uttarakhand."
            </p>
          </div>

          {/* Already logged in banner */}
          {session && (
            <div className="mb-8 p-5 glass rounded-2xl flex items-center justify-between">
              <span className="text-sm text-foreground/70 font-light">
                Signed in as <strong className="text-foreground">{session.name}</strong>
              </span>
              <Button size="sm" variant="outline" className="rounded-full"
                onClick={() => {
                  const target = session.githubUsername?.trim();
                  if (target) {
                    navigate(`/members/${target}`);
                  } else {
                    navigate('/members');
                  }
                }}>
                View My Profile →
              </Button>
            </div>
          )}

          {/* Main tabs: Student / Mentor / Partner */}
          <Tabs defaultValue="student" className="w-full space-y-12" onValueChange={setMainTab}>
            <div className="flex justify-center">
              <TabsList className="glass h-16 p-1 bg-background/50 rounded-full border-0">
                <TabsTrigger value="student" className="rounded-full px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-500 font-light tracking-widest uppercase text-[10px]">
                  Students
                </TabsTrigger>
                <TabsTrigger value="mentor" className="rounded-full px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-500 font-light tracking-widest uppercase text-[10px]">
                  Mentors
                </TabsTrigger>
                <TabsTrigger value="partner" className="rounded-full px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-500 font-light tracking-widest uppercase text-[10px]">
                  Partners
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── STUDENT TAB ── */}
            <TabsContent value="student">
              <Card className="glass border-0 shadow-2xl rounded-3xl overflow-hidden">
                <CardHeader className="p-10 pb-0 space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="w-6 h-6 text-primary" />
                    <CardTitle className="text-2xl font-heading font-light tracking-wide">
                      Student Portal
                    </CardTitle>
                  </div>
                  <CardDescription className="font-light tracking-wide text-foreground/40 italic">
                    Create your profile or sign in to access your TechShastra dashboard.
                  </CardDescription>
                  {/* Sign up / Sign in sub-tabs */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setStudentTab("signup")}
                      className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-light transition-all duration-300 ${studentTab === "signup" ? "bg-primary text-primary-foreground" : "glass text-foreground/60 hover:text-foreground"}`}>
                      <UserPlus size={12} /> Sign Up
                    </button>
                    <button
                      onClick={() => setStudentTab("signin")}
                      className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-light transition-all duration-300 ${studentTab === "signin" ? "bg-primary text-primary-foreground" : "glass text-foreground/60 hover:text-foreground"}`}>
                      <LogIn size={12} /> Sign In
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="p-10 pt-8">
                  {studentTab === "signup"
                    ? <SignupForm onSuccess={handleSuccess} onSwitchToSignin={() => setStudentTab("signin")} />
                    : <SigninForm onSuccess={handleSuccess} />
                  }
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── MENTOR TAB ── */}
            <TabsContent value="mentor">
              <Card className="glass border-0 shadow-2xl rounded-3xl overflow-hidden">
                <CardHeader className="p-10 pb-0 space-y-2">
                  <CardTitle className="text-2xl font-heading font-light tracking-wide flex items-center gap-3">
                    <User className="w-6 h-6 text-primary" /> Mentor Application
                  </CardTitle>
                  <CardDescription className="font-light tracking-wide text-foreground/40 italic">
                    Complete the form below to begin your journey with TECHSHASTRA.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-10 pt-8">
                  <EnquiryForm role="mentor" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── PARTNER TAB ── */}
            <TabsContent value="partner">
              <Card className="glass border-0 shadow-2xl rounded-3xl overflow-hidden">
                <CardHeader className="p-10 pb-0 space-y-2">
                  <CardTitle className="text-2xl font-heading font-light tracking-wide flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-primary" /> Strategic Partnership
                  </CardTitle>
                  <CardDescription className="font-light tracking-wide text-foreground/40 italic">
                    Partner with TechShastra to empower the next generation of innovators.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-10 pt-8">
                  <EnquiryForm role="partner" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Join;
