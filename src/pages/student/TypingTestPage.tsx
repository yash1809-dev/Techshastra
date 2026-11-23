import React, { useState, useEffect, useRef, useCallback } from "react";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import {
  saveTypingRecord,
  getTypingRecords,
  type TypingRecord,
} from "@/lib/codingStore";
import { getStudentByGithub } from "@/lib/studentStore";
import {
  typingSoundEngine,
  type SoundTheme,
} from "@/lib/services/typingSoundService";
import {
  Keyboard,
  RotateCcw,
  Trophy,
  Zap,
  Target,
  Sparkles,
  Clock,
  Volume2,
  VolumeX,
  Settings2,
  X,
  SlidersHorizontal,
  Type,
  FileText,
  Code2,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// ─── Types & Constants ─────────────────────────────────────────────────────────

export type TemplateCategory = "tech" | "words" | "code" | "quotes";
export type CaseMode = "standard" | "lowercase" | "capitalize";
export type CaretStyle = "line" | "underline" | "block";

const TECH_SNIPPETS = [
  "In computer science, a binary search algorithm finds the position of a target value within a sorted array in logarithmic time.",
  "Clean code always looks like it was written by someone who cares. Simple functions with clear naming reduce cognitive overload.",
  "Asynchronous programming allows operations to run in the background without blocking the main event loop in JavaScript engines.",
  "Dynamic programming solves complex problems by breaking them down into a collection of simpler subproblems and caching their results.",
  "Git is a distributed version control system designed to handle everything from small to very large projects with speed and efficiency.",
  "A hash table is a data structure that implements an associative array abstract data type that maps keys to values using hash functions.",
  "Recursion occurs when a thing is defined in terms of itself or of its type. In programming, a recursive function calls itself until a base case.",
  "The observer pattern defines a one-to-many dependency between objects, so that when one object changes state all its dependents are notified.",
  "A linked list is a linear data structure where each element is a separate object. Each element of a list is called a node, comprising data and a reference.",
  "Functional programming is a declarative programming paradigm where programs are constructed by applying and composing pure functions.",
  "Object oriented programming is a paradigm based on the concept of objects which can contain data and code that processes that data.",
  "Big O notation describes the upper bound of the time complexity of an algorithm, measuring how runtime scales with input size.",
];

const COMMON_WORDS_LIST = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
  "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
  "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
  "an", "will", "my", "one", "all", "would", "there", "their", "what", "so",
  "up", "out", "if", "about", "who", "get", "which", "go", "me", "when",
  "make", "can", "like", "time", "no", "just", "him", "know", "take", "people",
  "into", "year", "your", "good", "some", "could", "them", "see", "other", "than",
  "then", "now", "look", "only", "come", "its", "over", "think", "also", "back",
  "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "great",
  "code", "data", "system", "file", "call", "test", "type", "open", "line", "read",
];

const CODE_SNIPPETS = [
  "const binarySearch = (arr: number[], target: number): number => { let l = 0, r = arr.length - 1; while (l <= r) { const m = Math.floor((l + r) / 2); if (arr[m] === target) return m; if (arr[m] < target) l = m + 1; else r = m - 1; } return -1; };",
  "export async function fetchUserById(userId: string): Promise<User> { const res = await fetch(`/api/users/${userId}`); if (!res.ok) throw new Error(`HTTP ${res.status}`); return (await res.json()) as User; }",
  "const memoize = <T extends (...args: any[]) => any>(fn: T) => { const cache = new Map(); return (...args: Parameters<T>): ReturnType<T> => { const k = JSON.stringify(args); if (cache.has(k)) return cache.get(k); const res = fn(...args); cache.set(k, res); return res; }; };",
  "function quickSort(arr: number[]): number[] { if (arr.length <= 1) return arr; const pivot = arr[arr.length - 1]; const left = arr.filter((x, i) => x <= pivot && i < arr.length - 1); const right = arr.filter((x) => x > pivot); return [...quickSort(left), pivot, ...quickSort(right)]; }",
  "const isPalindrome = (str: string): boolean => { const clean = str.toLowerCase().replace(/[^a-z0-9]/g, ''); return clean === clean.split('').reverse().join(''); };",
  "const debounce = (fn: Function, ms: number) => { let timer: any; return (...args: any[]) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; };",
];

const QUOTE_SNIPPETS = [
  "Talk is cheap. Show me the code. — Linus Torvalds",
  "Programs must be written for people to read, and only incidentally for machines to execute. — Harold Abelson",
  "The most disastrous software failures often stem from small design flaws that were overlooked during early prototyping. — Alan Turing",
  "Simplicity is prerequisite for reliability. — Edsger W. Dijkstra",
  "Any fool can write code that a computer can understand. Good programmers write code that humans can understand. — Martin Fowler",
  "The best error message is the one that never shows up. — Thomas Fuchs",
  "First, solve the problem. Then, write the code. — John Johnson",
  "Experience is the name everyone gives to their mistakes. — Oscar Wilde",
  "Before software can be reusable it first has to be usable. — Ralph Johnson",
  "Make it work, make it right, make it fast. — Kent Beck",
];

const SOUND_THEMES: { value: SoundTheme; label: string; desc: string }[] = [
  { value: "off",        label: "Silent",    desc: "No sound" },
  { value: "click",      label: "Click",     desc: "Cherry Blue crisp click" },
  { value: "thock",      label: "Thock",     desc: "Lubed linear deep thock" },
  { value: "typewriter", label: "Typewriter",desc: "Vintage mechanical" },
  { value: "beep",       label: "Retro Beep",desc: "Soft synth beep" },
];

function generateSnippet(template: TemplateCategory, casing: CaseMode): string {
  let raw = "";
  if (template === "words") {
    const words: string[] = [];
    for (let i = 0; i < 35; i++) {
      words.push(COMMON_WORDS_LIST[Math.floor(Math.random() * COMMON_WORDS_LIST.length)]);
    }
    raw = words.join(" ");
  } else if (template === "code") {
    raw = CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)];
  } else if (template === "quotes") {
    raw = QUOTE_SNIPPETS[Math.floor(Math.random() * QUOTE_SNIPPETS.length)];
  } else {
    raw = TECH_SNIPPETS[Math.floor(Math.random() * TECH_SNIPPETS.length)];
  }

  if (casing === "lowercase") {
    return raw.toLowerCase();
  }
  if (casing === "capitalize") {
    return raw.replace(/\b([a-z])/g, (_, ch) => ch.toUpperCase());
  }
  return raw;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TypingTestPage: React.FC = () => {
  const { session } = useStudentAuth();

  // ── Customization & Mode State ──
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>(() => {
    return (localStorage.getItem("typing_template") as TemplateCategory) || "tech";
  });
  const [caseMode, setCaseMode] = useState<CaseMode>(() => {
    return (localStorage.getItem("typing_casing") as CaseMode) || "standard";
  });
  const [caretStyle, setCaretStyle] = useState<CaretStyle>(() => {
    return (localStorage.getItem("typing_caret") as CaretStyle) || "line";
  });

  // ── Test State ──
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [timeLeft, setTimeLeft]   = useState<number>(30);
  const [isActive, setIsActive]   = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [textSnippet, setTextSnippet] = useState<string>("");
  const [userInput, setUserInput] = useState<string>("");
  const [charIndex, setCharIndex] = useState<number>(0);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [records, setRecords]     = useState<TypingRecord[]>([]);

  // ── Sound State ──
  const [soundTheme, setSoundTheme] = useState<SoundTheme>(typingSoundEngine.getTheme());
  const [volume, setVolume]         = useState<number>(typingSoundEngine.getVolume());
  const [showSettings, setShowSettings] = useState(false);

  // ── Refs & Timing ──
  const inputRef     = useRef<HTMLInputElement>(null);
  const timerRef     = useRef<NodeJS.Timeout | null>(null);
  const prevInputLen = useRef<number>(0);
  const hasSaved     = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // MonkeyType endless stream & real accuracy tracking
  const totalKeystrokesRef = useRef<number>(0);
  const totalTyposRef      = useRef<number>(0);
  const [totalTypos, setTotalTypos]         = useState<number>(0);
  const [unfixedErrors, setUnfixedErrors]   = useState<number>(0);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const activeCharRef    = useRef<HTMLSpanElement>(null);

  const currentStudentId = session?.studentId || session?.githubUsername;

  const resetTest = useCallback(
    (template = templateCategory, casing = caseMode) => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setIsTyping(false);
      // Endless text: start with 2 combined paragraphs so there's always plenty of runway
      const initial = generateSnippet(template, casing) + " " + generateSnippet(template, casing);
      setTextSnippet(initial);
      setUserInput("");
      setCharIndex(0);
      setErrorCount(0);
      setTotalTypos(0);
      setUnfixedErrors(0);
      totalKeystrokesRef.current = 0;
      totalTyposRef.current = 0;
      setTimeLeft(selectedDuration);
      setIsActive(false);
      setIsFinished(false);
      prevInputLen.current = 0;
      hasSaved.current = false;
      if (textContainerRef.current) {
        textContainerRef.current.scrollTop = 0;
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [templateCategory, caseMode, selectedDuration]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Smooth auto-scroll keeping the active line centered (MonkeyType 3-line view)
  useEffect(() => {
    if (activeCharRef.current && textContainerRef.current) {
      const container = textContainerRef.current;
      const charEl = activeCharRef.current;
      const charTop = charEl.offsetTop - container.offsetTop;
      if (charTop > 55) {
        container.scrollTo({
          top: charTop - 55,
          behavior: "smooth",
        });
      }
    }
  }, [charIndex]);

  useEffect(() => {
    setRecords(getTypingRecords(currentStudentId));
    resetTest();
    setSoundTheme(typingSoundEngine.getTheme());
    setVolume(typingSoundEngine.getVolume());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudentId]);

  const handleTemplateChange = (tpl: TemplateCategory) => {
    if (isActive) return;
    setTemplateCategory(tpl);
    localStorage.setItem("typing_template", tpl);
    resetTest(tpl, caseMode);
  };

  const handleCasingChange = (casing: CaseMode) => {
    if (isActive) return;
    setCaseMode(casing);
    localStorage.setItem("typing_casing", casing);
    resetTest(templateCategory, casing);
  };

  const handleCaretChange = (caret: CaretStyle) => {
    setCaretStyle(caret);
    localStorage.setItem("typing_caret", caret);
  };

  const handleDurationChange = (dur: number) => {
    if (isActive) return;
    setSelectedDuration(dur);
    setTimeLeft(dur);
    setIsActive(false);
    setIsFinished(false);
    setUserInput("");
    setCharIndex(0);
    setErrorCount(0);
    setTotalTypos(0);
    setUnfixedErrors(0);
    totalKeystrokesRef.current = 0;
    totalTyposRef.current = 0;
    const initial = generateSnippet(templateCategory, caseMode) + " " + generateSnippet(templateCategory, caseMode);
    setTextSnippet(initial);
    prevInputLen.current = 0;
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = 0;
    }
  };

  // Timer
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { clearInterval(timerRef.current!); finishTest(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const finishTest = useCallback(() => {
    setIsActive(false);
    setIsFinished(true);
    setIsTyping(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Save record after finish with authentic MonkeyType accuracy & typo count
  useEffect(() => {
    if (!isFinished || hasSaved.current) return;
    hasSaved.current = true;
    const elapsed = Math.max(1, selectedDuration - Math.max(0, timeLeft));
    const wpm  = Math.max(0, Math.round((userInput.length / 5) / (elapsed / 60)));
    const totalTyped = totalKeystrokesRef.current;
    const typos = totalTyposRef.current;
    // MonkeyType accuracy formula: accounts for lifetime keystroke mistakes even if backspaced and fixed
    const acc = totalTyped > 0
      ? Math.max(0, Math.round(((totalTyped - typos) / totalTyped) * 100))
      : 100;

    const studentProfile = session?.githubUsername ? getStudentByGithub(session.githubUsername) : null;
    const resolvedCollege = (session as any)?.college || studentProfile?.education?.[0]?.institution || "UTU Sudhowala (Main Campus)";

    saveTypingRecord({
      studentId:       session?.studentId || session?.githubUsername || "guest",
      studentName:     session?.name      || "Student",
      githubUsername:  session?.githubUsername || "",
      college:         resolvedCollege,
      wpm,
      accuracy: acc,
      errors: typos,
      totalTypos: typos,
      unfixedErrors: errorCount,
      durationSeconds: selectedDuration,
    });
    setRecords(getTypingRecords(currentStudentId));
    toast.success(`🎉 ${wpm} WPM · ${acc}% accuracy!`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  // Input handler with Endless Stream and Key-by-Key Error Recording
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFinished) return;
    const val = e.target.value;
    const newLen = val.length;

    if (!isActive && newLen > 0) { setIsActive(true); hasSaved.current = false; }

    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 550);

    // Track every individual keystroke (even if later backspaced)
    if (newLen > prevInputLen.current) {
      const typedIndex = newLen - 1;
      const typed    = val[typedIndex];
      const expected = textSnippet[typedIndex];
      typingSoundEngine.playKey(typed !== expected, typed === " ");

      totalKeystrokesRef.current += 1;
      if (typed !== expected) {
        totalTyposRef.current += 1;
        setTotalTypos(totalTyposRef.current);
      }
    }
    prevInputLen.current = newLen;

    setUserInput(val);
    setCharIndex(newLen);

    // Current remaining unfixed errors in the string
    let currentUnfixed = 0;
    for (let i = 0; i < val.length; i++) {
      if (val[i] !== textSnippet[i]) currentUnfixed++;
    }
    setErrorCount(currentUnfixed);
    setUnfixedErrors(currentUnfixed);

    // ENDLESS PARAGRAPHS (MonkeyType endless stream):
    // As the typist approaches the end of the text buffer (< 80 chars left), seamlessly append new content!
    // A typist typing 100, 200, or 300+ WPM will never run out of text before the timer ends.
    if (textSnippet.length - newLen < 80) {
      setTextSnippet((prev) => prev + " " + generateSnippet(templateCategory, caseMode));
    }
  };

  const handleThemeChange = (theme: SoundTheme) => {
    setSoundTheme(theme);
    typingSoundEngine.setTheme(theme);
    if (theme !== "off") typingSoundEngine.playKey(false, false);
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    typingSoundEngine.setVolume(v);
  };

  // Live metrics
  const elapsed      = Math.max(1, selectedDuration - timeLeft);
  const liveWpm      = isActive || isFinished
    ? Math.round((userInput.length / 5) / (elapsed / 60)) || 0
    : 0;
  // Real MonkeyType accuracy: accounts for all keystrokes and typos
  const totalTyped   = totalKeystrokesRef.current;
  const liveAccuracy = totalTyped > 0
    ? Math.max(0, Math.round(((totalTyped - totalTyposRef.current) / totalTyped) * 100))
    : 100;
  const progress     = textSnippet.length > 0 ? (charIndex / textSnippet.length) * 100 : 0;
  const personalBest = records.length > 0 ? Math.max(...records.map((r) => r.wpm)) : 0;
  const isMuted      = soundTheme === "off";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-20 md:pb-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Keyboard className="text-primary" size={26} />
            Developer Typing Test
          </h1>
          <p className="text-sm text-foreground/50 font-light mt-0.5">
            MonkeyType-style speed test with mechanical keyboard sounds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {personalBest > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-300 dark:bg-amber-400/10 dark:border-amber-400/30 shadow-xs backdrop-blur-sm">
              <Trophy size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>PB: {personalBest} WPM</span>
            </div>
          )}
          <Button
            variant="ghost" size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className={`h-8 w-8 rounded-xl transition-colors ${showSettings ? "bg-primary/15 text-primary" : "text-foreground/50 hover:text-foreground"}`}
            title="Customization & Sound Settings"
          >
            <Settings2 size={16} />
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass rounded-2xl p-5 space-y-5 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-foreground/10">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <SlidersHorizontal size={15} className="text-primary" />
              Test Customization & Sound
            </h3>
            <Button variant="ghost" size="icon" className="w-6 h-6 rounded-lg text-foreground/50 hover:text-foreground" onClick={() => setShowSettings(false)}>
              <X size={14} />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Template options */}
            <div className="space-y-2">
              <p className="text-xs text-foreground/50 font-medium uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={12} className="text-primary" /> Content Template
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "tech",   label: "Tech / CS",   desc: "Algorithms & concepts" },
                  { id: "words",  label: "Common Words", desc: "Top 200 English words" },
                  { id: "code",   label: "Code Syntax",  desc: "JavaScript & TypeScript" },
                  { id: "quotes", label: "Famous Quotes",desc: "Tech pioneer quotes" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateChange(t.id as TemplateCategory)}
                    disabled={isActive}
                    className={`p-2.5 rounded-xl text-left transition-all ${
                      templateCategory === t.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "glass text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <p className="text-xs font-semibold">{t.label}</p>
                    <p className={`text-[10px] mt-0.5 ${templateCategory === t.id ? "text-primary-foreground/80" : "text-foreground/40"}`}>{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Word Casing */}
            <div className="space-y-2">
              <p className="text-xs text-foreground/50 font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Type size={12} className="text-primary" /> Word Casing
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "standard",   label: "Default",    desc: "Standard prose" },
                  { id: "lowercase",  label: "all small",  desc: "all lowercase" },
                  { id: "capitalize", label: "Capitalize", desc: "Capitalize Words" },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleCasingChange(c.id as CaseMode)}
                    disabled={isActive}
                    className={`p-2.5 rounded-xl text-left transition-all ${
                      caseMode === c.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "glass text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <p className="text-xs font-semibold">{c.label}</p>
                    <p className={`text-[10px] mt-0.5 ${caseMode === c.id ? "text-primary-foreground/80" : "text-foreground/40"}`}>{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Caret Style */}
            <div className="space-y-2">
              <p className="text-xs text-foreground/50 font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={12} className="text-primary" /> Pointer / Caret Style
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "line",      label: "Line",      desc: "Sleek vertical bar" },
                  { id: "underline", label: "Underline", desc: "Bottom bar" },
                  { id: "block",     label: "Block",     desc: "Translucent block" },
                ].map((cr) => (
                  <button
                    key={cr.id}
                    onClick={() => handleCaretChange(cr.id as CaretStyle)}
                    className={`p-2.5 rounded-xl text-left transition-all ${
                      caretStyle === cr.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "glass text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    <p className="text-xs font-semibold">{cr.label}</p>
                    <p className={`text-[10px] mt-0.5 ${caretStyle === cr.id ? "text-primary-foreground/80" : "text-foreground/40"}`}>{cr.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Themes & Volume */}
            <div className="space-y-2">
              <p className="text-xs text-foreground/50 font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 size={12} className="text-primary" /> Sound Theme
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SOUND_THEMES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => handleThemeChange(t.value)}
                    title={t.desc}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      soundTheme === t.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "glass text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {!isMuted && (
                <div className="pt-2 flex items-center gap-3">
                  <span className="text-[11px] text-foreground/50 font-mono">Vol</span>
                  <input
                    type="range" min={0} max={1} step={0.05} value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 accent-primary cursor-pointer rounded-full"
                  />
                  <span className="text-[11px] font-mono text-foreground/50 w-8 text-right">{Math.round(volume * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MonkeyType Quick Mode Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 px-4 glass rounded-2xl text-xs">
        {/* Template selector */}
        <div className="flex items-center gap-1">
          <FileText size={13} className="text-primary/70 shrink-0 mr-1" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/40 mr-1 hidden sm:inline">template</span>
          {(
            [
              { id: "tech",   label: "Tech" },
              { id: "words",  label: "Words" },
              { id: "code",   label: "Code" },
              { id: "quotes", label: "Quotes" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => handleTemplateChange(t.id)}
              disabled={isActive}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                templateCategory === t.id
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-foreground/10 hidden sm:block" />

        {/* Casing selector */}
        <div className="flex items-center gap-1">
          <Type size={13} className="text-primary/70 shrink-0 mr-1" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/40 mr-1 hidden sm:inline">casing</span>
          {(
            [
              { id: "standard",   label: "Default" },
              { id: "lowercase",  label: "all small" },
              { id: "capitalize", label: "Capitalize" },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              onClick={() => handleCasingChange(c.id)}
              disabled={isActive}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                caseMode === c.id
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-foreground/10 hidden md:block" />

        {/* Caret selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/40 mr-1 hidden md:inline">caret</span>
          {(
            [
              { id: "line",      label: "Line" },
              { id: "underline", label: "Underline" },
              { id: "block",     label: "Block" },
            ] as const
          ).map((cr) => (
            <button
              key={cr.id}
              onClick={() => handleCaretChange(cr.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                caretStyle === cr.id
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {cr.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Arena */}
      <div className="glass rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-7 space-y-5">

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4" style={{ borderBottom: "1px solid hsl(var(--glass-border))" }}>
            <div className="flex items-center justify-between sm:justify-start gap-2">
              {/* Duration */}
              <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-xl text-xs">
                {[15, 30, 60].map((dur) => (
                  <button
                    key={dur}
                    onClick={() => handleDurationChange(dur)}
                    disabled={isActive}
                    className={`px-3 py-1 rounded-lg transition-colors font-mono ${
                      selectedDuration === dur
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground/50 hover:text-foreground"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {dur}s
                  </button>
                ))}
              </div>

              {/* Sound + Reset (mobile) */}
              <div className="flex items-center gap-1 sm:hidden">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => handleThemeChange(isMuted ? "thock" : "off")}
                  className="h-8 w-8 text-foreground/50 hover:text-foreground rounded-xl"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => resetTest()}
                  className="h-8 w-8 text-foreground/50 hover:text-foreground rounded-xl"
                  title="Restart"
                >
                  <RotateCcw size={14} />
                </Button>
              </div>
            </div>

            {/* Live stats */}
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 font-mono text-xs">
              <div className="flex items-center gap-1.5 text-foreground/50">
                <Clock size={13} />
                <span className={`font-semibold text-sm ${timeLeft <= 5 && isActive ? "text-rose-400 animate-pulse" : "text-foreground"}`}>
                  {timeLeft}s
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground/50">
                <Zap size={13} className="text-primary" />
                <span className="font-semibold text-sm text-foreground">{liveWpm}</span>
                <span>WPM</span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground/50">
                <Target size={13} className="text-emerald-400" />
                <span className="font-semibold text-sm text-foreground">{liveAccuracy}%</span>
              </div>

              {/* Sound + Reset (desktop) */}
              <div className="hidden sm:flex items-center gap-1 ml-2">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => handleThemeChange(isMuted ? "thock" : "off")}
                  className="h-8 w-8 text-foreground/50 hover:text-foreground rounded-xl"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => resetTest()}
                  className="h-8 w-8 text-foreground/50 hover:text-foreground rounded-xl"
                  title="Restart"
                >
                  <RotateCcw size={14} />
                </Button>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-0.5 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Text Display: Endless 3-Line Smooth Scrolling Arena */}
          <div
            ref={textContainerRef}
            onClick={() => inputRef.current?.focus()}
            className={`select-none min-h-[140px] max-h-[180px] overflow-y-auto scrollbar-none scroll-smooth text-lg sm:text-xl font-mono leading-relaxed p-5 sm:p-6 rounded-2xl glass tracking-wide whitespace-pre-wrap transition-colors ${
              isActive ? "cursor-none" : "cursor-text"
            }`}
          >
            {textSnippet.split("").map((char, index) => {
              const isTyped = index < charIndex;
              const isCorrect = isTyped && userInput[index] === char;
              const isIncorrect = isTyped && userInput[index] !== char;

              // Monkeytype pointer:
              // Points right at the insertion boundary of the typed letter, or left-edge of first letter at start.
              const showCursor =
                !isFinished &&
                ((charIndex === 0 && index === 0) ||
                  (charIndex > 0 && index === charIndex - 1));

              let colorCls = "text-muted-foreground/40";
              if (isCorrect) {
                colorCls = "text-black dark:text-white font-medium";
              } else if (isIncorrect) {
                colorCls = "text-rose-500 font-medium";
              }

              return (
                <span
                  key={index}
                  ref={showCursor ? activeCharRef : undefined}
                  className={`relative inline transition-colors duration-75 ${colorCls}`}
                >
                  {showCursor && (
                    <>
                      {caretStyle === "line" && (
                        <span
                          className={`absolute top-[0.18em] w-[2px] h-[0.88em] bg-primary rounded-full pointer-events-none transition-all duration-75 ${
                            isTyping ? "opacity-100" : "animate-caret-blink"
                          } ${charIndex === 0 ? "left-0" : "right-0"}`}
                        />
                      )}
                      {caretStyle === "underline" && (
                        <span
                          className={`absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary rounded-full pointer-events-none transition-all duration-75 ${
                            isTyping ? "opacity-100" : "animate-caret-blink"
                          }`}
                        />
                      )}
                      {caretStyle === "block" && (
                        <span
                          className={`absolute inset-0 bg-primary/25 rounded-xs pointer-events-none transition-all duration-75 ${
                            isTyping ? "opacity-100" : "animate-caret-blink"
                          }`}
                        />
                      )}
                    </>
                  )}
                  {char}
                </span>
              );
            })}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={handleInputChange}
            disabled={isFinished}
            className="opacity-0 absolute pointer-events-none"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          {!isActive && !isFinished && (
            <p className="text-xs text-foreground/35 text-center font-light italic">
              Click above and start typing to begin · Reset with the ↺ button
            </p>
          )}

          {/* Finished Banner with Real MonkeyType Stats */}
          {isFinished && (
            <div className="p-5 rounded-2xl bg-primary/5" style={{ border: "1px solid hsl(var(--glass-border))" }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
                    <Sparkles size={16} className="text-primary" /> Test Complete!
                  </h3>
                  <p className="text-xs text-foreground/40 font-light mt-0.5">Result saved to leaderboard.</p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-center font-mono">
                    <p className="text-[10px] text-foreground/40 uppercase tracking-wide">Speed</p>
                    <p className="text-2xl font-bold text-primary">{liveWpm} WPM</p>
                  </div>
                  <div className="text-center font-mono">
                    <p className="text-[10px] text-foreground/40 uppercase tracking-wide">Accuracy</p>
                    <p className="text-2xl font-bold text-emerald-400">{liveAccuracy}%</p>
                  </div>
                  <div className="text-center font-mono">
                    <p className="text-[10px] text-foreground/40 uppercase tracking-wide">Typos Made</p>
                    <p className="text-2xl font-bold text-rose-400">{totalTypos}</p>
                  </div>
                  <div className="text-center font-mono">
                    <p className="text-[10px] text-foreground/40 uppercase tracking-wide">Unfixed</p>
                    <p className="text-2xl font-bold text-foreground/70">{unfixedErrors}</p>
                  </div>
                  <Button onClick={() => resetTest()} className="rounded-full px-5 ml-1 shrink-0">
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History with 7-Day Pruning & Permanent PB Retention */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Trophy size={15} className="text-amber-500" />
            Past Performances
            {records.length > 0 && (
              <Badge variant="secondary" className="text-[10px] font-normal">{records.length} runs</Badge>
            )}
          </h3>
          <p className="text-[11px] text-foreground/40 font-light">
            7-day history retention · Best score permanently preserved
          </p>
        </div>

        {records.length === 0 ? (
          <p className="text-xs text-foreground/40 font-light">No completed tests yet. Run your first test above!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {records.slice(0, 9).map((rec) => {
              const isPb = rec.isPersonalBest || (personalBest > 0 && rec.wpm === personalBest);
              return (
                <div
                  key={rec.id}
                  className={`glass rounded-2xl p-3.5 flex items-center justify-between text-xs relative overflow-hidden ${
                    isPb ? "ring-1 ring-amber-500/40 bg-amber-500/5" : ""
                  }`}
                >
                  {isPb && (
                    <div className="absolute top-0 right-0 px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-mono font-bold rounded-bl-lg">
                      ⭐ BEST
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-primary">{rec.wpm} WPM</span>
                      <Badge variant="outline" className={`text-[9px] py-0 ${
                        rec.accuracy >= 95 ? "border-emerald-500/40 text-emerald-400"
                        : rec.accuracy >= 85 ? "border-amber-500/40 text-amber-400"
                        : "border-rose-500/40 text-rose-400"
                      }`}>
                        {rec.accuracy}% acc
                      </Badge>
                    </div>
                    <p className="text-[10px] text-foreground/40 font-light mt-1">
                      {new Date(rec.takenAt).toLocaleDateString()} · {rec.durationSeconds}s
                    </p>
                  </div>
                  <span className="text-[10px] text-foreground/40 font-mono">
                    {(rec as any).totalTypos ?? rec.errors ?? 0} typos
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TypingTestPage;
