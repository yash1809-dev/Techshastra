import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import {
  getProblemById,
  saveSubmission,
  getUserSubmissions,
  type Problem,
  type Submission,
} from "@/lib/codingStore";
import { getStudentByGithub } from "@/lib/studentStore";
import {
  executeCode,
  evaluateTestCases,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type TestCaseResult,
} from "@/lib/services/codeExecutionService";
import { getProblemEvaluationCases } from "@/lib/services/problemService";
import {
  Play,
  Send,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Code2,
  Terminal,
  FileText,
  ListOrdered,
  HelpCircle,
  Copy,
  Check,
  Maximize2,
  Sparkles,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const ProblemSolve: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { session } = useStudentAuth();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>("python");
  const [code, setCode] = useState<string>("");
  const [activeLeftTab, setActiveLeftTab] = useState<string>("description");
  const [activeBottomTab, setActiveBottomTab] = useState<string>("testcases");
  const [selectedTestCaseIdx, setSelectedTestCaseIdx] = useState<number>(0);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [mobileTab, setMobileTab] = useState<"problem" | "editor" | "output">("problem");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Execution states
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<{
    status: Submission["status"];
    runtimeMs: number;
    testResults: TestCaseResult[];
    passedCount: number;
    totalCount: number;
    compileError?: string;
  } | null>(null);

  // Past submissions for this problem
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Load problem
  useEffect(() => {
    if (!id) return;
    const currentId = session?.studentId || session?.githubUsername;
    const p = getProblemById(id);
    if (p) {
      setProblem(p);
      setCode(p.starterCode[language] || p.starterCode.python || "");
      const userSubs = getUserSubmissions(currentId).filter((s) => s.problemId === p.id);
      setSubmissions(userSubs);
    } else {
      import("@/lib/codingStore").then(({ getProblemById: fetchById, enrichProblem }) => {
        const fresh = fetchById(id);
        if (fresh) {
          setProblem(fresh);
          setCode(fresh.starterCode[language] || fresh.starterCode.python || "");
          const userSubs = getUserSubmissions(currentId).filter((s) => s.problemId === fresh.id);
          setSubmissions(userSubs);
        }
      });
    }
  }, [id, session]);

  // When language changes, update starter code if untouched or requested
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    if (problem) {
      setCode(problem.starterCode[newLang] || "");
    }
  };

  const handleResetCode = () => {
    if (!problem) return;
    setCode(problem.starterCode[language] || "");
    toast.info("Code restored to original starter template.");
  };

  // Run against sample (public) test cases
  const handleRunCode = async () => {
    if (!problem) return;
    setIsRunning(true);
    setActiveBottomTab("result");
    if (isMobile) setMobileTab("output");

    try {
      const publicCases = problem.testCases.filter((tc) => !tc.isHidden);
      const evalOutcome = await evaluateTestCases(code, language, publicCases);

      setRunResult({
        status: evalOutcome.status,
        runtimeMs: evalOutcome.totalRuntimeMs,
        testResults: evalOutcome.results,
        passedCount: evalOutcome.passedCount,
        totalCount: evalOutcome.totalCount,
        compileError: evalOutcome.compileError,
      });

      if (evalOutcome.status === "Accepted") {
        toast.success(`All ${evalOutcome.passedCount} sample test cases passed!`);
      } else {
        toast.error(`Sample run finished with ${evalOutcome.status}.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to execute code");
    } finally {
      setIsRunning(false);
    }
  };

  // Submit against ALL test cases (including hidden)
  const handleSubmitCode = async () => {
    if (!problem) return;
    setIsSubmitting(true);
    setActiveBottomTab("result");
    if (isMobile) setMobileTab("output");

    try {
      // Evaluate all test cases (hidden cases fetched in-memory on demand; never leaked to storage/catalog)
      const evalCases = await getProblemEvaluationCases(problem.id);
      const testCasesToRun = evalCases.length > 0 ? evalCases : problem.testCases;
      const evalOutcome = await evaluateTestCases(code, language, testCasesToRun);

      setRunResult({
        status: evalOutcome.status,
        runtimeMs: evalOutcome.totalRuntimeMs,
        testResults: evalOutcome.results,
        passedCount: evalOutcome.passedCount,
        totalCount: evalOutcome.totalCount,
        compileError: evalOutcome.compileError,
      });

      // Save submission record
      const studentName = session?.name || "Student";
      const studentUsername = session?.githubUsername || "student";

      const currentId = session?.studentId || session?.githubUsername || "guest";
      const studentProfile = session?.githubUsername ? getStudentByGithub(session.githubUsername) : null;
      const resolvedCollege = (session as any)?.college || studentProfile?.education?.[0]?.institution || "UTU Sudhowala (Main Campus)";

      const newSubmission = saveSubmission({
        studentId: currentId,
        studentName,
        githubUsername: studentUsername,
        college: resolvedCollege,
        problemId: problem.id,
        problemTitle: problem.title,
        language,
        code,
        status: evalOutcome.status,
        runtimeMs: evalOutcome.totalRuntimeMs,
        memoryKb: 3120,
        passedTestCases: evalOutcome.passedCount,
        totalTestCases: evalOutcome.totalCount,
        scoreAwarded: evalOutcome.status === "Accepted" ? problem.points : 0,
      });

      // Refresh submissions for this student
      const userSubs = getUserSubmissions(currentId).filter((s) => s.problemId === problem.id);
      setSubmissions(userSubs);

      if (evalOutcome.status === "Accepted") {
        toast.success(
          `🎉 Accepted! All ${evalOutcome.totalCount} test cases passed. +${problem.points} points awarded!`
        );
      } else {
        toast.error(
          `Submission Result: ${evalOutcome.status} (${evalOutcome.passedCount}/${evalOutcome.totalCount} passed)`
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!problem) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle size={36} className="text-amber-500 mb-3" />
        <h2 className="text-xl font-heading font-semibold text-foreground">
          Problem Not Found
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          The requested problem does not exist or may have been unlisted by faculty.
        </p>
        <Link to="/student/problems" className="mt-4">
          <Button variant="outline" className="rounded-xl">
            Return to Problems Directory
          </Button>
        </Link>
      </div>
    );
  }

  const getDifficultyColor = (diff: Problem["difficulty"]) => {
    switch (diff) {
      case "Easy":
        return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      case "Medium":
        return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "Hard":
        return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    }
  };

  const publicTestCases = problem.testCases.filter((tc) => !tc.isHidden);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top IDE Navigation Header */}
      <div className="h-12 border-b border-border/40 bg-card/60 backdrop-blur-sm px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/student/problems"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Back to Problems"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 truncate">
            <h1 className="text-xs sm:text-sm font-heading font-semibold text-foreground truncate">
              {problem.title}
            </h1>
            <Badge
              variant="outline"
              className={`text-[10px] px-2 py-0 hidden sm:inline-flex ${getDifficultyColor(
                problem.difficulty
              )}`}
            >
              {problem.difficulty}
            </Badge>
          </div>
        </div>

        {/* Center: Language selector */}
        <div className="flex items-center gap-2">
          <Select
            value={language}
            onValueChange={(val) => handleLanguageChange(val as SupportedLanguage)}
          >
            <SelectTrigger className="h-8 text-xs font-mono rounded-xl w-36 bg-background/80 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.id} value={lang.id} className="text-xs font-mono">
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetCode}
            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl"
            title="Reset code template"
          >
            <RotateCcw size={14} />
          </Button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunCode}
            disabled={isRunning || isSubmitting}
            className="h-8 rounded-xl gap-1.5 text-xs font-medium border-border/60 hover:bg-muted"
          >
            {isRunning ? (
              <Loader2 size={13} className="animate-spin text-primary" />
            ) : (
              <Play size={13} className="text-emerald-500 fill-emerald-500" />
            )}
            <span className="hidden sm:inline">Run Code</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSubmitCode}
            disabled={isRunning || isSubmitting}
            className="h-8 rounded-xl gap-1.5 text-xs font-medium shadow-sm shadow-primary/20"
          >
            {isSubmitting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
            <span>Submit</span>
          </Button>
        </div>
      </div>

      {/* Main Split Interface: Desktop Resizable Panels / Mobile Tabbed Stack */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel: Problem description, examples, constraints & submissions */}
          <ResizablePanel defaultSize={42} minSize={25}>
            <div className="h-full flex flex-col border-r border-border/40 bg-card/30">
              <Tabs
                value={activeLeftTab}
                onValueChange={setActiveLeftTab}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="px-3 pt-2 border-b border-border/30 bg-muted/20">
                  <TabsList className="bg-transparent h-8 p-0 gap-3">
                    <TabsTrigger
                      value="description"
                      className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 text-xs"
                    >
                      <FileText size={13} className="mr-1.5" />
                      Description
                    </TabsTrigger>
                    <TabsTrigger
                      value="submissions"
                      className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 text-xs"
                    >
                      <Clock size={13} className="mr-1.5" />
                      Submissions ({submissions.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="hints"
                      className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 text-xs"
                    >
                      <HelpCircle size={13} className="mr-1.5" />
                      Hints
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab: Problem Description */}
                <TabsContent
                  value="description"
                  className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 m-0 scrollbar-thin"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-heading font-bold text-foreground">
                        {problem.title}
                      </h2>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0 ${getDifficultyColor(
                          problem.difficulty
                        )}`}
                      >
                        {problem.difficulty}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Faculty: {problem.author}</span>
                      <span>•</span>
                      <span>Award: {problem.points} pts</span>
                    </div>
                  </div>

                  {/* Body description */}
                  <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {problem.description}
                  </div>

                  {/* Example blocks */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Sample Test Cases & Scenarios
                    </h3>

                    {problem.examples.map((ex, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-border/50 bg-muted/30 p-3.5 space-y-2 text-xs font-mono"
                      >
                        <p className="font-heading font-semibold text-foreground text-[11px] not-italic">
                          Example {idx + 1}:
                        </p>
                        <div>
                          <span className="text-muted-foreground">Input: </span>
                          <span className="text-foreground">{ex.input}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Output: </span>
                          <span className="text-emerald-400 font-semibold">
                            {ex.output}
                          </span>
                        </div>
                        {ex.explanation && (
                          <div className="text-muted-foreground font-sans text-[11px] pt-1 border-t border-border/20">
                            <span className="font-medium text-foreground">
                              Explanation:{" "}
                            </span>
                            {ex.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Constraints */}
                  {problem.constraints && problem.constraints.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Constraints
                      </h3>
                      <ul className="list-disc list-inside space-y-1 text-xs font-mono text-muted-foreground">
                        {problem.constraints.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Submissions history */}
                <TabsContent
                  value="submissions"
                  className="flex-1 overflow-y-auto p-4 space-y-3 m-0 scrollbar-thin"
                >
                  {submissions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No submissions recorded for this problem yet. Hit "Submit" to
                      evaluate all test cases!
                    </div>
                  ) : (
                    submissions.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-3 rounded-xl border border-border/40 bg-card/60 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold ${
                                sub.status === "Accepted"
                                  ? "text-emerald-500"
                                  : "text-rose-500"
                              }`}
                            >
                              {sub.status}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {sub.language}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(sub.submittedAt).toLocaleString()} • {sub.runtimeMs}ms
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCode(sub.code);
                            setLanguage(sub.language as SupportedLanguage);
                            toast.info("Loaded submitted code into editor.");
                          }}
                          className="h-7 text-[11px] rounded-lg"
                        >
                          Load Code
                        </Button>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* Tab: Hints */}
                <TabsContent
                  value="hints"
                  className="flex-1 overflow-y-auto p-4 space-y-3 m-0 scrollbar-thin"
                >
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs text-foreground/80 space-y-2">
                    <p className="font-medium text-primary flex items-center gap-1.5">
                      <Sparkles size={14} /> Faculty Algorithm Tip:
                    </p>
                    <p>
                      Consider the constraints carefully. An O(n²) brute-force solution
                      may result in Time Limit Exceeded on larger test inputs. Look for
                      hash maps, two pointers, or dynamic programming optimizations.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: Code Editor (top) + Test Case / Output Console (bottom) */}
          <ResizablePanel defaultSize={58} minSize={30}>
            <ResizablePanelGroup direction="vertical">
              {/* Top: Code Editor */}
              <ResizablePanel defaultSize={62} minSize={30}>
                <div className="h-full flex flex-col bg-[#0d1117] text-white">
                  {/* Editor status strip */}
                  <div className="h-8 px-3 border-b border-white/10 bg-[#161b22] flex items-center justify-between text-[11px] text-gray-400 font-mono select-none">
                    <div className="flex items-center gap-2">
                      <Code2 size={13} className="text-primary" />
                      <span>solution.{language === "python" ? "py" : language === "cpp" ? "cpp" : language === "java" ? "java" : "js"}</span>
                    </div>
                    <span>UTF-8 • Tab: 2 spaces</span>
                  </div>

                  {/* Code Editor Textarea */}
                  <div className="flex-1 relative font-mono text-xs overflow-hidden">
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      onKeyDown={(e) => {
                        // Support Tab key indentation
                        if (e.key === "Tab") {
                          e.preventDefault();
                          const start = e.currentTarget.selectionStart;
                          const end = e.currentTarget.selectionEnd;
                          const val = e.currentTarget.value;
                          setCode(val.substring(0, start) + "  " + val.substring(end));
                          setTimeout(() => {
                            if (e.target) {
                              (e.target as HTMLTextAreaElement).selectionStart = start + 2;
                              (e.target as HTMLTextAreaElement).selectionEnd = start + 2;
                            }
                          }, 0);
                        }
                      }}
                      className="w-full h-full p-4 bg-transparent text-gray-100 resize-none outline-none font-mono leading-relaxed selection:bg-primary/30"
                      placeholder="Write your code here..."
                      spellCheck={false}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Bottom: Test Cases & Terminal Execution Results */}
              <ResizablePanel defaultSize={38} minSize={20}>
                <div className="h-full flex flex-col bg-card/60 backdrop-blur-sm border-t border-border/40">
                  <Tabs
                    value={activeBottomTab}
                    onValueChange={setActiveBottomTab}
                    className="flex-1 flex flex-col min-h-0"
                  >
                    <div className="px-3 pt-1.5 border-b border-border/30 bg-muted/30 flex items-center justify-between">
                      <TabsList className="bg-transparent h-7 p-0 gap-2">
                        <TabsTrigger
                          value="testcases"
                          className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 text-xs"
                        >
                          <ListOrdered size={12} className="mr-1.5" />
                          Test Cases
                        </TabsTrigger>
                        <TabsTrigger
                          value="result"
                          className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 text-xs"
                        >
                          <Terminal size={12} className="mr-1.5" />
                          Execution Output
                        </TabsTrigger>
                      </TabsList>

                      {runResult && (
                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          <span
                            className={
                              runResult.status === "Accepted"
                                ? "text-emerald-500 font-semibold"
                                : "text-rose-500 font-semibold"
                            }
                          >
                            {runResult.status}
                          </span>
                          <span className="text-muted-foreground">
                            ({runResult.passedCount}/{runResult.totalCount} passed)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Test Cases Tab */}
                    <TabsContent
                      value="testcases"
                      className="flex-1 overflow-y-auto p-3 space-y-3 m-0 scrollbar-thin"
                    >
                      <div className="flex items-center gap-1.5">
                        {publicTestCases.map((tc, idx) => (
                          <button
                            key={tc.id}
                            onClick={() => setSelectedTestCaseIdx(idx)}
                            className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                              selectedTestCaseIdx === idx
                                ? "bg-primary text-primary-foreground font-semibold"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Case {idx + 1}
                          </button>
                        ))}
                      </div>

                      {publicTestCases[selectedTestCaseIdx] && (
                        <div className="space-y-2 text-xs font-mono">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-sans">
                              Input:
                            </p>
                            <div className="p-2 rounded-lg bg-muted/40 text-foreground whitespace-pre-wrap mt-0.5">
                              {publicTestCases[selectedTestCaseIdx].input}
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-sans">
                              Expected Output:
                            </p>
                            <div className="p-2 rounded-lg bg-muted/40 text-emerald-400 whitespace-pre-wrap mt-0.5">
                              {publicTestCases[selectedTestCaseIdx].expectedOutput}
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* Result Console Tab */}
                    <TabsContent
                      value="result"
                      className="flex-1 overflow-y-auto p-3 space-y-3 m-0 scrollbar-thin font-mono text-xs"
                    >
                      {isRunning || isSubmitting ? (
                        <div className="h-full flex items-center justify-center gap-2 text-muted-foreground py-6">
                          <Loader2 size={16} className="animate-spin text-primary" />
                          <span>Executing code in secure sandbox...</span>
                        </div>
                      ) : !runResult ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground py-6 text-center">
                          Click "Run Code" to test sample cases, or "Submit" to evaluate all test cases.
                        </div>
                      ) : runResult.compileError ? (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-rose-400 space-y-1">
                          <p className="font-semibold text-rose-500 font-sans">
                            Compilation / Runtime Error:
                          </p>
                          <pre className="whitespace-pre-wrap text-[11px] text-rose-300">
                            {runResult.compileError}
                          </pre>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Summary Bar */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-2">
                              {runResult.status === "Accepted" ? (
                                <CheckCircle2 size={16} className="text-emerald-500" />
                              ) : (
                                <XCircle size={16} className="text-rose-500" />
                              )}
                              <span className="font-bold text-sm font-sans">
                                {runResult.status}
                              </span>
                            </div>
                            <span className="text-muted-foreground text-[11px]">
                              Runtime: {runResult.runtimeMs} ms
                            </span>
                          </div>

                          {/* Individual test case results */}
                          <div className="space-y-2">
                            {runResult.testResults.map((tr, idx) => (
                              <div
                                key={idx}
                                className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
                                  tr.passed
                                    ? "bg-emerald-500/5 border-emerald-500/20"
                                    : "bg-rose-500/5 border-rose-500/20"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold flex items-center gap-1.5">
                                    {tr.passed ? (
                                      <CheckCircle2 size={13} className="text-emerald-500" />
                                    ) : (
                                      <XCircle size={13} className="text-rose-500" />
                                    )}
                                    {tr.isHidden
                                      ? `Hidden Test Case #${idx + 1}`
                                      : `Test Case #${idx + 1}`}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {(tr as any).executionTimeMs ?? tr.runtimeMs}ms
                                  </span>
                                </div>

                                {tr.isHidden ? (
                                  <p className="text-[11px] text-muted-foreground italic font-sans">
                                    [Protected faculty evaluation case — input & output hidden]
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                                    <div>
                                      <span className="text-muted-foreground block text-[10px]">
                                        Expected:
                                      </span>
                                      <span className="text-emerald-400">
                                        {tr.expectedOutput}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-[10px]">
                                        Your Output:
                                      </span>
                                      <span
                                        className={
                                          tr.passed ? "text-emerald-400" : "text-rose-400"
                                        }
                                      >
                                        {tr.actualOutput || "<no stdout>"}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default ProblemSolve;
