import React, { useState, useEffect, useMemo, useRef } from "react";
import Tesseract from "tesseract.js";
import {
  getAllProblemsAdmin,
  saveProblem,
  deleteProblem,
  toggleProblemPublish,
  type CodingProblem,
  type ProblemDifficulty,
  type TargetYear,
  YEAR_PRESETS,
  getDefaultStarterCode,
} from "@/lib/services/problemService";
import { type SupportedLanguage, type TestCase } from "@/lib/services/codeExecutionService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  Code2,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  FolderPlus,
  Check,
  ShieldCheck,
  Lock,
  Sliders,
  FileCode,
  Tag,
  ArrowRight,
  ArrowLeft,
  User,
  AlertCircle,
  UploadCloud,
  FileImage,
  Layers,
  GraduationCap,
  Copy,
  FileText,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface AdminProblemsTabProps {
  currentAdminName?: string;
  isSuperAdmin?: boolean;
}

const CATEGORY_PRESETS = [
  "Algorithms",
  "Data Structures",
  "Arrays",
  "Strings",
  "Dynamic Programming",
  "Trees & Graphs",
  "Sorting & Searching",
  "Math & Bit Manipulation",
];

const TAG_PRESETS = [
  "Two Pointers",
  "Binary Search",
  "Hash Map",
  "Recursion",
  "Stack",
  "Queue",
  "Greedy",
  "Graph",
  "Sliding Window",
];

export const COHORT_YEAR_PRESETS: TargetYear[] = YEAR_PRESETS;

const POINTS_PRESETS = [30, 50, 80, 100, 150];

export const AdminProblemsTab: React.FC<AdminProblemsTabProps> = ({
  currentAdminName = "Faculty Admin",
  isSuperAdmin = false,
}) => {
  const { toast } = useToast();
  const [allProblems, setAllProblems] = useState<CodingProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("All");
  const [facultyFilter, setFacultyFilter] = useState<string>("All");
  const [yearFilter, setYearFilter] = useState<string>("All");

  // Modal editor state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeDialogTab, setActiveDialogTab] = useState<"overview" | "statement" | "code">("overview");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Algorithms");
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>("Easy");
  const [points, setPoints] = useState(50);
  const [targetYear, setTargetYear] = useState<TargetYear>("All");
  const [publishedBy, setPublishedBy] = useState(currentAdminName);
  const [isPublished, setIsPublished] = useState(true);
  const [description, setDescription] = useState("");
  const [constraintsText, setConstraintsText] = useState("");
  const [tagsText, setTagsText] = useState("");

  // OCR Extraction State
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrRawText, setOcrRawText] = useState("");
  const [showRawOcr, setShowRawOcr] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // Code language tab
  const [activeCodeLang, setActiveCodeLang] = useState<"python" | "javascript" | "cpp">("python");
  const [pythonCode, setPythonCode] = useState("");
  const [javascriptCode, setJavascriptCode] = useState("");
  const [cppCode, setCppCode] = useState("");

  // Test Cases State
  const [sampleInput, setSampleInput] = useState("");
  const [sampleOutput, setSampleOutput] = useState("");
  const [sampleExplanation, setSampleExplanation] = useState("");

  const [hiddenInput, setHiddenInput] = useState("");
  const [hiddenOutput, setHiddenOutput] = useState("");

  // ── OCR Drag & Drop Question Extractor ─────────────────────────────────────
  const parseAndApplyOcrText = (rawText: string) => {
    setOcrRawText(rawText);
    const clean = rawText.replace(/\r\n/g, "\n");
    const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);

    // 1. Title
    let extractedTitle = "";
    const titleMatch = clean.match(/(?:problem|question|title|q\d+)\s*[:.\-]\s*([^\n]+)/i);
    if (titleMatch) {
      extractedTitle = titleMatch[1].trim();
    } else {
      const firstGood = lines.find(
        (l) => l.length > 3 && l.length < 80 && !l.toLowerCase().startsWith("page") && !l.toLowerCase().startsWith("assignment")
      );
      if (firstGood) extractedTitle = firstGood;
    }
    if (extractedTitle) setTitle(extractedTitle);

    // 2. Difficulty
    if (/\b(hard)\b/i.test(clean)) setDifficulty("Hard");
    else if (/\b(medium)\b/i.test(clean)) setDifficulty("Medium");
    else if (/\b(easy)\b/i.test(clean)) setDifficulty("Easy");

    // 3. Academic Year
    if (/1st\s*year|first\s*year|\byear\s*1\b/i.test(clean)) {
      setTargetYear("1st Year");
    } else if (/2nd\s*year|second\s*year|\byear\s*2\b/i.test(clean)) {
      setTargetYear("2nd Year");
    } else if (/3rd\s*year|third\s*year|\byear\s*3\b/i.test(clean)) {
      setTargetYear("3rd Year");
    } else if (/4th\s*year|fourth\s*year|final\s*year|\byear\s*4\b/i.test(clean)) {
      setTargetYear("4th Year");
    } else {
      const semMatch = clean.match(/(?:semester|sem)\s*[:#\-\s]?\s*([1-8])/i);
      if (semMatch) {
        const sem = parseInt(semMatch[1], 10);
        if (sem <= 2) setTargetYear("1st Year");
        else if (sem <= 4) setTargetYear("2nd Year");
        else if (sem <= 6) setTargetYear("3rd Year");
        else setTargetYear("4th Year");
      }
    }

    // 4. Constraints
    const constrMatch = clean.match(/constraints?\s*[:\-]?\s*([\s\S]*?)(?:example|input|sample|output|$)/i);
    if (constrMatch && constrMatch[1].trim()) {
      const cLines = constrMatch[1]
        .split("\n")
        .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
        .filter((s) => s.length > 0 && !s.toLowerCase().startsWith("example"));
      if (cLines.length > 0) setConstraintsText(cLines.join("\n"));
    }

    // 5. Sample Input / Output
    const inputMatch = clean.match(/(?:sample\s+input|example\s*\d*[:\s]*input|input)\s*[:\-]\s*([\s\S]*?)(?:output|sample\s+output|explanation|$)/i);
    if (inputMatch) {
      const rawInput = inputMatch[1].trim().split(/\n\s*(?:output|sample)/i)[0].trim();
      if (rawInput) setSampleInput(rawInput);
    }

    const outputMatch = clean.match(/(?:sample\s+output|example\s*\d*[:\s]*output|output)\s*[:\-]\s*([\s\S]*?)(?:explanation|constraints|note|$)/i);
    if (outputMatch) {
      const rawOutput = outputMatch[1].trim().split(/\n\s*(?:explanation|constraints)/i)[0].trim();
      if (rawOutput) setSampleOutput(rawOutput);
    }

    const explMatch = clean.match(/(?:explanation|note)\s*[:\-]\s*([\s\S]*?)(?:example|constraints|$)/i);
    if (explMatch) {
      const rawExpl = explMatch[1].trim().split(/\n\s*(?:example|constraints)/i)[0].trim();
      if (rawExpl) setSampleExplanation(rawExpl);
    }

    // 6. Description / Statement
    let statement = clean
      .replace(/(?:problem|question|title|q\d+)\s*[:.\-]\s*[^\n]+/i, "")
      .replace(/constraints?\s*[:\-]?\s*[\s\S]*?(?:example|input|sample|output|$)/i, "")
      .replace(/(?:sample\s+input|example[\s\S]*)/i, "")
      .trim();
    if (statement.length < 20) {
      statement = clean.slice(0, 500);
    }
    if (statement) setDescription(statement);

    // 7. Tags & Category Detection
    const detectedTags: string[] = [];
    if (/array|list|subarray/i.test(clean)) detectedTags.push("Array");
    if (/string|anagram|palindrome/i.test(clean)) detectedTags.push("String");
    if (/tree|bst|binary\s+tree/i.test(clean)) detectedTags.push("Tree");
    if (/graph|dfs|bfs/i.test(clean)) detectedTags.push("Graph");
    if (/dynamic\s+programming|dp|memoization/i.test(clean)) detectedTags.push("Dynamic Programming");
    if (/binary\s+search/i.test(clean)) detectedTags.push("Binary Search");
    if (/two\s+pointers/i.test(clean)) detectedTags.push("Two Pointers");
    if (/hash\s*map|hash\s*table|dictionary/i.test(clean)) detectedTags.push("Hash Map");
    if (/stack|queue/i.test(clean)) detectedTags.push("Stack");

    if (detectedTags.length > 0) {
      setTagsText(detectedTags.join(", "));
      setCategory(detectedTags[0]);
    }

    toast({
      title: "✨ OCR Extraction Complete!",
      description: `Autofilled "${extractedTitle || "Question"}" with question statement, constraints, and test cases.`,
    });
  };

  const handleOcrFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Please drop an image",
        description: "Supported formats: PNG, JPG, JPEG, WebP screenshots or assignment photos.",
        variant: "destructive",
      });
      return;
    }

    setOcrLoading(true);
    setOcrProgress(15);
    setOcrStatus("Initializing OCR engine...");
    try {
      const worker = await Tesseract.createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setOcrProgress(Math.round(m.progress * 100));
            setOcrStatus(`Extracting question text (${Math.round(m.progress * 100)}%)...`);
          }
        },
      });

      setOcrStatus("Analyzing document layout...");
      const ret = await worker.recognize(file);
      await worker.terminate();

      if (ret?.data?.text) {
        parseAndApplyOcrText(ret.data.text);
      } else {
        throw new Error("No readable text detected");
      }
    } catch (err: any) {
      console.error("OCR error", err);
      toast({
        title: "OCR Failed",
        description: "Could not read text from this image. Please use a clearer screenshot or enter details manually.",
        variant: "destructive",
      });
    } finally {
      setOcrLoading(false);
      setDragOver(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllProblemsAdmin();
      setAllProblems(data);
    } catch {
      toast({ title: "Failed to load problems", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Strict ownership check:
  // Faculty admin can ONLY see and control problems they personally posted.
  // Super admin can see and control all problems.
  const isOwner = (prob: CodingProblem): boolean => {
    if (isSuperAdmin) return true;
    if (!currentAdminName) return false;
    const author = (prob.publishedBy || "").trim().toLowerCase();
    const current = currentAdminName.trim().toLowerCase();
    return author === current;
  };

  // Scoped problem list: regular faculty admin only gets their own posted challenges
  const scopedProblems = useMemo(() => {
    if (isSuperAdmin) {
      return allProblems;
    }
    return allProblems.filter(isOwner);
  }, [allProblems, isSuperAdmin, currentAdminName]);

  // Unique faculty authors list for SuperAdmin filter
  const facultyAuthors = useMemo(() => {
    const set = new Set<string>();
    allProblems.forEach((p) => {
      if (p.publishedBy) set.add(p.publishedBy);
    });
    return Array.from(set);
  }, [allProblems]);

  // Filtered by search and filters
  const filteredProblems = useMemo(() => {
    return scopedProblems.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase()) ||
        (isSuperAdmin && p.publishedBy.toLowerCase().includes(search.toLowerCase()));

      const matchesDiff =
        difficultyFilter === "All" || p.difficulty === difficultyFilter;

      const matchesFaculty =
        !isSuperAdmin || facultyFilter === "All" || p.publishedBy === facultyFilter;

      const probYear = p.targetYear || p.targetSemester || "All";
      const matchesYear =
        yearFilter === "All" || probYear === yearFilter;

      return matchesSearch && matchesDiff && matchesFaculty && matchesYear;
    });
  }, [scopedProblems, search, difficultyFilter, facultyFilter, yearFilter, isSuperAdmin]);

  const openNewProblemDialog = () => {
    const defaults = getDefaultStarterCode();
    setEditingId(null);
    setTitle("");
    setCategory("Algorithms");
    setDifficulty("Easy");
    setPoints(50);
    setTargetYear("All");
    setOcrRawText("");
    setShowRawOcr(false);
    // Locked strictly to logged in admin identity
    setPublishedBy(currentAdminName);
    setIsPublished(true);
    setDescription("");
    setConstraintsText("1 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9");
    setTagsText("Array, Algorithms");
    setPythonCode(defaults.python);
    setJavascriptCode(defaults.javascript);
    setCppCode(defaults.cpp);
    setSampleInput("4 9\n2 7 11 15");
    setSampleOutput("0 1");
    setSampleExplanation("nums[0] + nums[1] == 9, so return indices 0 1.");
    setHiddenInput("3 6\n3 2 4");
    setHiddenOutput("1 2");
    setActiveDialogTab("overview");
    setActiveCodeLang("python");
    setDialogOpen(true);
  };

  const openEditDialog = (prob: CodingProblem) => {
    if (!isSuperAdmin && !isOwner(prob)) {
      toast({
        title: "Access Restricted",
        description: "You cannot edit challenges posted by other faculty members.",
        variant: "destructive",
      });
      return;
    }

    setEditingId(prob.id);
    setTitle(prob.title);
    setCategory(prob.category || "Algorithms");
    setDifficulty(prob.difficulty);
    setPoints(prob.points);
    setTargetYear((prob.targetYear || prob.targetSemester || "All") as TargetYear);
    setOcrRawText("");
    setShowRawOcr(false);
    // If not super admin, lock to currentAdminName
    setPublishedBy(isSuperAdmin ? prob.publishedBy || currentAdminName : currentAdminName);
    setIsPublished(prob.isPublished);
    setDescription(prob.description);
    setConstraintsText(prob.constraints.join("\n"));
    setTagsText(prob.tags.join(", "));
    setPythonCode(prob.starterCode?.python || "");
    setJavascriptCode(prob.starterCode?.javascript || "");
    setCppCode(prob.starterCode?.cpp || "");

    const firstSample = prob.sampleTestCases?.[0];
    if (firstSample) {
      setSampleInput(firstSample.input);
      setSampleOutput(firstSample.expectedOutput);
      setSampleExplanation(firstSample.explanation || "");
    } else {
      setSampleInput("");
      setSampleOutput("");
      setSampleExplanation("");
    }

    const firstHidden = prob.hiddenTestCases?.[0];
    if (firstHidden) {
      setHiddenInput(firstHidden.input);
      setHiddenOutput(firstHidden.expectedOutput);
    } else {
      setHiddenInput("");
      setHiddenOutput("");
    }

    setActiveDialogTab("overview");
    setActiveCodeLang("python");
    setDialogOpen(true);
  };

  const handleSaveProblem = async () => {
    if (!title.trim() || !description.trim()) {
      toast({
        title: "Title and description required",
        description: "Please enter at least a problem title and description statement.",
        variant: "destructive",
      });
      if (!title.trim()) setActiveDialogTab("overview");
      else if (!description.trim()) setActiveDialogTab("statement");
      return;
    }

    // Locked author verification: non-superadmins can NEVER post under another name
    const authorToUse = isSuperAdmin ? (publishedBy.trim() || currentAdminName) : currentAdminName;

    const defaultStarters = getDefaultStarterCode();
    const starterCode: Record<SupportedLanguage, string> = {
      python: pythonCode.trim() || defaultStarters.python,
      javascript: javascriptCode.trim() || defaultStarters.javascript,
      typescript: defaultStarters.typescript,
      cpp: cppCode.trim() || defaultStarters.cpp,
      java: defaultStarters.java,
    };

    const constraints = constraintsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const tags = tagsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const existingProblem = editingId ? allProblems.find((p) => p.id === editingId) : null;

    let sampleTestCases: TestCase[] = existingProblem?.sampleTestCases ? [...existingProblem.sampleTestCases] : [];
    if (sampleInput.trim()) {
      const firstSample: TestCase = {
        id: sampleTestCases[0]?.id || "tc-sample-1",
        input: sampleInput.trim(),
        expectedOutput: sampleOutput.trim(),
        explanation: sampleExplanation.trim() || undefined,
        isHidden: false,
      };
      if (sampleTestCases.length > 0) {
        sampleTestCases[0] = firstSample;
      } else {
        sampleTestCases = [firstSample];
      }
    }

    let hiddenTestCases: TestCase[] = existingProblem?.hiddenTestCases ? [...existingProblem.hiddenTestCases] : [];
    if (hiddenInput.trim()) {
      const firstHidden: TestCase = {
        id: hiddenTestCases[0]?.id || "tc-hidden-1",
        input: hiddenInput.trim(),
        expectedOutput: hiddenOutput.trim(),
        isHidden: true,
      };
      if (hiddenTestCases.length > 0) {
        hiddenTestCases[0] = firstHidden;
      } else {
        hiddenTestCases = [firstHidden];
      }
    }

    try {
      await saveProblem({
        id: editingId || undefined,
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: title.trim(),
        difficulty,
        category: category.trim(),
        points: Number(points) || 50,
        targetYear: targetYear || "All",
        targetSemester: targetYear || "All",
        publishedBy: authorToUse,
        publishedAt: new Date().toISOString(),
        isPublished,
        description: description.trim(),
        constraints,
        tags,
        starterCode,
        sampleTestCases,
        hiddenTestCases,
      });

      toast({
        title: editingId ? "Challenge Updated ✓" : "Challenge Created ✓",
        description: `"${title}" has been saved under author "${authorToUse}".`,
      });

      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({
        title: "Error saving problem",
        description: err.message || "Failed to save to database.",
        variant: "destructive",
      });
    }
  };

  const handleTogglePublish = async (prob: CodingProblem) => {
    if (!isSuperAdmin && !isOwner(prob)) {
      toast({
        title: "Access Restricted",
        description: "You can only manage publish status for your own challenges.",
        variant: "destructive",
      });
      return;
    }

    const nextState = !prob.isPublished;
    await toggleProblemPublish(prob.id, nextState);
    setAllProblems((prev) =>
      prev.map((p) => (p.id === prob.id ? { ...p, isPublished: nextState } : p))
    );
    toast({
      title: nextState ? "Challenge Published ✓" : "Challenge Hidden (Draft) ✓",
      description: `"${prob.title}" is now ${nextState ? "visible to students" : "hidden as draft"}.`,
    });
  };

  const handleDelete = async (prob: CodingProblem) => {
    if (!isSuperAdmin && !isOwner(prob)) {
      toast({
        title: "Access Restricted",
        description: "You cannot delete challenges posted by other faculty members.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${prob.title}"?`)) return;
    await deleteProblem(prob.id);
    setAllProblems((prev) => prev.filter((p) => p.id !== prob.id));
    toast({
      title: "Challenge Deleted",
      description: `Removed "${prob.title}".`,
    });
  };

  // Seed sample starter problems under the logged in admin identity
  const handleSeedStandardProblems = async () => {
    const defaultStarters = getDefaultStarterCode();
    const standardSeeds: Omit<CodingProblem, "id">[] = [
      {
        slug: "two-sum",
        title: "Two Sum",
        difficulty: "Easy",
        category: "Arrays & Hashing",
        points: 50,
        publishedBy: currentAdminName,
        publishedAt: new Date().toISOString(),
        isPublished: true,
        description:
          "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nInput Format: First line contains N and Target. Second line contains N integers.\nOutput Format: Space-separated 0-indexed positions.",
        constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
        tags: ["Array", "Hash Table"],
        starterCode: defaultStarters,
        sampleTestCases: [
          {
            id: "tc-1",
            input: "4 9\n2 7 11 15",
            expectedOutput: "0 1",
            explanation: "nums[0] + nums[1] == 9, so output 0 1",
            isHidden: false,
          },
        ],
        hiddenTestCases: [
          {
            id: "tc-h1",
            input: "3 6\n3 2 4",
            expectedOutput: "1 2",
            isHidden: true,
          },
        ],
      },
      {
        slug: "valid-palindrome",
        title: "Valid Palindrome",
        difficulty: "Easy",
        category: "Strings",
        points: 50,
        publishedBy: currentAdminName,
        publishedAt: new Date().toISOString(),
        isPublished: true,
        description:
          "A phrase is a palindrome if, after converting all uppercase letters into lowercase and removing all non-alphanumeric characters, it reads the same forward and backward.\n\nOutput 'true' or 'false'.",
        constraints: ["1 <= s.length <= 2 * 10^5"],
        tags: ["String", "Two Pointers"],
        starterCode: defaultStarters,
        sampleTestCases: [
          {
            id: "tc-2",
            input: "A man, a plan, a canal: Panama",
            expectedOutput: "true",
            isHidden: false,
          },
        ],
        hiddenTestCases: [
          {
            id: "tc-h2",
            input: "race a car",
            expectedOutput: "false",
            isHidden: true,
          },
        ],
      },
      {
        slug: "binary-search",
        title: "Binary Search",
        difficulty: "Medium",
        category: "Searching",
        points: 80,
        publishedBy: currentAdminName,
        publishedAt: new Date().toISOString(),
        isPublished: true,
        description:
          "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, return its index. Otherwise, return -1.\n\nYou must write an algorithm with O(log n) runtime complexity.",
        constraints: ["1 <= nums.length <= 10^4", "nums is sorted in ascending order"],
        tags: ["Binary Search", "Algorithms"],
        starterCode: defaultStarters,
        sampleTestCases: [
          {
            id: "tc-3",
            input: "6 9\n-1 0 3 5 9 12",
            expectedOutput: "4",
            explanation: "9 exists in nums and its index is 4",
            isHidden: false,
          },
        ],
        hiddenTestCases: [
          {
            id: "tc-h3",
            input: "6 2\n-1 0 3 5 9 12",
            expectedOutput: "-1",
            isHidden: true,
          },
        ],
      },
    ];

    for (const seed of standardSeeds) {
      await saveProblem(seed);
    }
    toast({
      title: "Starter Challenges Added ✓",
      description: `Added 3 challenges under your faculty account (${currentAdminName}).`,
    });
    loadData();
  };

  const insertStandardDescriptionTemplate = () => {
    setDescription(
      `### Problem Statement\nGiven [describe input data], write an algorithm to [describe task].\n\n### Input Format\n- The first line contains ...\n- The second line contains ...\n\n### Output Format\nReturn or print ...\n\n### Example\n**Input:** \`[sample]\`\n**Output:** \`[result]\`\n**Explanation:** [details]`
    );
  };

  const getDifficultyBadge = (diff: ProblemDifficulty) => {
    switch (diff) {
      case "Easy":
        return (
          <Badge variant="outline" className="text-[10px] font-medium">
            Easy
          </Badge>
        );
      case "Medium":
        return (
          <Badge variant="outline" className="text-[10px] font-medium">
            Medium
          </Badge>
        );
      case "Hard":
        return (
          <Badge variant="outline" className="text-[10px] font-medium">
            Hard
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner & Stats ── */}
      <Card className="glass border-white/30 dark:border-white/10 shadow-glass overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary/40" />
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 border-white/20 text-primary">
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-heading flex items-center gap-2 text-foreground">
                  <span>Faculty Assignments & Coding Problems</span>
                  {!isSuperAdmin && (
                    <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5 font-medium">
                      Your Curriculum Scope
                    </Badge>
                  )}
                  {isSuperAdmin && (
                    <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/10 font-semibold">
                      Super Admin (All Faculty)
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-0.5 text-foreground/70">
                  {!isSuperAdmin
                    ? `Managing your posted questions as ${currentAdminName}. Other faculty members' questions are hidden.`
                    : "Global problem registry across all faculty departments and instructors."}
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedStandardProblems}
              className="text-xs rounded-xl gap-1.5 glass hover:bg-white/40 border-white/30 dark:border-white/10 font-medium"
            >
              <FolderPlus size={14} className="text-primary" />
              <span>Load Starter Challenges</span>
            </Button>
            <Button
              size="sm"
              onClick={openNewProblemDialog}
              className="text-xs rounded-xl gap-1.5 shadow-md bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white font-medium"
            >
              <Plus size={15} />
              <span>Create Problem</span>
            </Button>
          </div>
        </CardHeader>

        {/* Stats Row */}
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl glass border-white/25 dark:border-white/10 bg-white/40 dark:bg-card/40">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <FileCode size={12} className="text-primary" />
                {isSuperAdmin ? "Total Challenges" : "Your Challenges"}
              </span>
              <p className="text-2xl font-bold font-heading mt-0.5 text-foreground">
                {scopedProblems.length}
              </p>
            </div>
            <div className="p-3 rounded-2xl glass border-white/25 dark:border-white/10 bg-white/40 dark:bg-card/40">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Eye size={12} />
                Live (Visible)
              </span>
              <p className="text-2xl font-bold font-heading mt-0.5 text-foreground">
                {scopedProblems.filter((p) => p.isPublished).length}
              </p>
            </div>
            <div className="p-3 rounded-2xl glass border-white/25 dark:border-white/10 bg-white/40 dark:bg-card/40">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <EyeOff size={12} />
                Drafts
              </span>
              <p className="text-2xl font-bold font-heading mt-0.5 text-foreground">
                {scopedProblems.filter((p) => !p.isPublished).length}
              </p>
            </div>
            <div className="p-3 rounded-2xl glass border-white/25 dark:border-white/10 bg-white/40 dark:bg-card/40">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Sparkles size={12} />
                Points Pool
              </span>
              <p className="text-2xl font-bold font-heading mt-0.5 text-foreground">
                {scopedProblems.reduce((sum, p) => sum + p.points, 0)} pts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between glass p-3.5 rounded-2xl border-white/30 dark:border-white/10 bg-white/40 dark:bg-card/40">
        <div className="relative flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/50"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isSuperAdmin
                ? "Search by title, topic, or faculty author..."
                : "Search your questions by title or topic..."
            }
            className="pl-9 h-9 text-xs rounded-xl bg-white/80 dark:bg-white/5 border-white/40 dark:border-white/10 text-foreground placeholder:text-foreground/40 shadow-xs focus-visible:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty Segmented Chips */}
          <div className="flex items-center rounded-xl glass bg-white/60 dark:bg-muted/40 p-1 text-xs border-white/25 dark:border-white/10">
            {["All", "Easy", "Medium", "Hard"].map((diff) => (
              <button
                key={diff}
                onClick={() => setDifficultyFilter(diff)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                  difficultyFilter === diff
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-foreground/70 hover:text-foreground hover:bg-white/30"
                }`}
              >
                {diff}
              </button>
            ))}
          </div>

          {/* Academic Year Filter Dropdown */}
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px] rounded-xl bg-white/80 dark:bg-white/5 border-white/30 dark:border-white/10 text-foreground font-medium shadow-xs">
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent className="glass border-white/30 dark:border-white/10">
              <SelectItem value="All">All Years</SelectItem>
              {COHORT_YEAR_PRESETS.filter((y) => y !== "All").map((yr) => (
                <SelectItem key={yr} value={yr}>
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* SuperAdmin Faculty Author Filter */}
          {isSuperAdmin && facultyAuthors.length > 0 && (
            <Select value={facultyFilter} onValueChange={setFacultyFilter}>
              <SelectTrigger className="h-8 text-xs w-[140px] rounded-xl bg-white/80 dark:bg-white/5 border-white/30 dark:border-white/10 text-foreground font-medium shadow-xs">
                <SelectValue placeholder="All Faculty" />
              </SelectTrigger>
              <SelectContent className="glass border-white/30 dark:border-white/10">
                <SelectItem value="All">All Faculty</SelectItem>
                {facultyAuthors.map((author) => (
                  <SelectItem key={author} value={author}>
                    {author}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="h-8 px-2.5 text-xs rounded-xl glass border-white/20 hover:bg-white/40"
            title="Refresh problems"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-primary" : "text-foreground/60"} />
          </Button>
        </div>
      </div>

      {/* ── Problems List ── */}
      <div className="space-y-3">
        {filteredProblems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl glass border-white/30 dark:border-white/10 space-y-3 bg-white/30 dark:bg-card/30">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border-white/20 flex items-center justify-center text-primary">
              <Code2 size={28} />
            </div>
            <h4 className="font-heading font-semibold text-foreground text-base">
              {scopedProblems.length === 0
                ? "No Problems In Your Dashboard"
                : "No Matching Problems"}
            </h4>
            <p className="text-xs text-foreground/70 max-w-md mx-auto leading-relaxed">
              {scopedProblems.length === 0
                ? `You haven't posted any coding challenges under your account (${currentAdminName}) yet. Click "Create Problem" to create your first question, or load starter challenges.`
                : "No questions match your current search, difficulty, and semester filters."}
            </p>
            {scopedProblems.length === 0 && (
              <div className="pt-2 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={openNewProblemDialog}
                  className="text-xs rounded-xl bg-primary hover:bg-primary/90 text-white gap-1.5"
                >
                  <Plus size={14} />
                  <span>Create First Problem</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSeedStandardProblems}
                  className="text-xs rounded-xl"
                >
                  Load Starter Challenges
                </Button>
              </div>
            )}
          </div>
        ) : (
          filteredProblems.map((prob) => {
            const userOwns = isOwner(prob);
            return (
              <div
                key={prob.id}
                className="p-4 rounded-2xl glass border-white/25 dark:border-white/10 hover:border-border/60 hover:bg-white/40 dark:hover:bg-white/5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="mt-1 sm:mt-0">
                    {prob.isPublished ? (
                      <div
                        className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shadow-xs"
                        title="Live & Visible to Students"
                      >
                        <Eye size={17} />
                      </div>
                    ) : (
                      <div
                        className="w-9 h-9 rounded-xl glass bg-white/40 dark:bg-muted/40 border-white/20 text-foreground/50 flex items-center justify-center"
                        title="Draft (Hidden)"
                      >
                        <EyeOff size={17} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-semibold text-sm text-foreground">
                        {prob.title}
                      </span>
                      {getDifficultyBadge(prob.difficulty)}
                      <Badge variant="outline" className="text-[10px] py-0 px-2 rounded-md font-medium">
                        <GraduationCap size={11} className="mr-1 inline" />
                        {prob.targetYear || prob.targetSemester || "All Years"}
                      </Badge>
                      <span className="text-[11px] font-mono text-primary font-bold">
                        +{prob.points} pts
                      </span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-2 rounded-md font-medium">
                        {prob.category}
                      </Badge>
                    </div>

                    <p className="text-xs text-foreground/70 line-clamp-1 mt-1 font-light">
                      {prob.description}
                    </p>

                    <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 font-medium">
                        <User size={11} />
                        <span className="text-foreground/80 font-medium">{prob.publishedBy}</span>
                      </span>
                      <span>•</span>
                      <span>
                        Tests: <strong className="text-foreground/80 font-medium">{prob.sampleTestCases?.length || 0} sample, {prob.hiddenTestCases?.length || 0} hidden</strong>
                      </span>
                      <span>•</span>
                      <span className={prob.isPublished ? "font-medium text-foreground/80" : "text-muted-foreground"}>
                        {prob.isPublished ? "● Live" : "○ Draft"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {/* Live switch toggle */}
                  <div className="flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-xl glass border-white/30 dark:border-white/10 bg-white/40 dark:bg-card/40">
                    <Label
                      htmlFor={`publish-${prob.id}`}
                      className="text-[11px] text-foreground/70 cursor-pointer select-none font-medium"
                    >
                      {prob.isPublished ? "Live" : "Draft"}
                    </Label>
                    <Switch
                      id={`publish-${prob.id}`}
                      checked={prob.isPublished}
                      disabled={!userOwns && !isSuperAdmin}
                      onCheckedChange={() => handleTogglePublish(prob)}
                    />
                  </div>

                  <a
                    href={`/student/problems/${prob.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl glass hover:bg-white/60 text-foreground/60 hover:text-foreground transition-colors border-white/20"
                    title="Preview in Student Solver"
                  >
                    <ExternalLink size={15} />
                  </a>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!userOwns && !isSuperAdmin}
                    onClick={() => openEditDialog(prob)}
                    className="h-8 px-2.5 text-xs rounded-xl gap-1 glass border-white/30 dark:border-white/10 hover:bg-primary/10 hover:text-primary transition-all font-medium"
                  >
                    <Pencil size={12} />
                    <span>Edit</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!userOwns && !isSuperAdmin}
                    onClick={() => handleDelete(prob)}
                    className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-xl transition-all"
                    title="Delete Problem"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Create / Edit Problem Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={`${
            isFullscreen
              ? "w-screen max-w-none h-screen max-h-none fixed inset-0 z-50 rounded-none border-0"
              : "w-[98vw] max-w-[1500px] h-[95vh] max-h-[95vh] rounded-2xl border border-border shadow-2xl"
          } flex flex-col p-0 overflow-hidden bg-card transition-all duration-200`}
        >
          <div className="h-0.5 w-full bg-gradient-to-r from-primary via-primary/60 to-primary/20 shrink-0" />

          {/* Header */}
          <div className="px-5 py-3 border-b border-border shrink-0 flex items-center justify-between gap-3 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Code2 size={16} />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>{editingId ? "Edit Problem" : "Create New Problem"}</span>
                  <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/30 text-primary font-normal">
                    {targetYear === "All" ? "All Cohorts" : targetYear}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-[10px] text-muted-foreground mt-0">
                  Author: <span className="font-medium text-foreground">{isSuperAdmin ? publishedBy || currentAdminName : currentAdminName}</span>
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Fullscreen Toggle */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg hidden sm:flex items-center gap-1.5 border border-border/60 hover:bg-muted/40"
                title={isFullscreen ? "Exit Fullscreen" : "Open Fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span className="text-[11px] font-medium">{isFullscreen ? "Exit Fullscreen" : "Full Screen"}</span>
              </Button>

              {/* Publish Toggle */}
              <div className="flex items-center gap-2 text-xs bg-background/80 border border-border/80 px-2.5 py-1 rounded-xl">
                <span className="text-muted-foreground text-[11px]">Visibility</span>
                <Switch id="modal-live-switch" checked={isPublished} onCheckedChange={setIsPublished} />
                <span className={`text-[11px] ${isPublished ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {isPublished ? "Live" : "Draft"}
                </span>
              </div>
            </div>
          </div>

          {/* Body — 2-column widescreen workspace on laptop/desktop */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

              {/* ── LEFT COLUMN: Setup, Identity, Problem Statement, Constraints (6 Cols) ── */}
              <div className="lg:col-span-6 space-y-4">

                {/* STEP 1: TARGET AUDIENCE & GRADING (YEAR FIRST!) */}
                <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">1</span>
                      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Target Cohort & Grading (Start Here)</h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Logical Step 1</span>
                  </div>

                  {/* 1.1 TARGET YEAR — FIRST AND PROMINENT */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <GraduationCap size={14} className="text-primary" /> Target Student Year <span className="text-destructive">*</span>
                      </Label>
                      <span className="text-[10px] text-muted-foreground">Who should solve this?</span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {COHORT_YEAR_PRESETS.map((yr) => {
                        const isSelected = targetYear === yr;
                        return (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => setTargetYear(yr as TargetYear)}
                            className={`py-2 px-1 text-xs rounded-xl border font-medium transition-all text-center ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground shadow-sm font-semibold"
                                : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30"
                            }`}
                          >
                            {yr === "All" ? "All Years" : yr}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 1.2 CATEGORY, DIFFICULTY, POINTS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Category */}
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-foreground">Category / Domain</Label>
                      <Input
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="e.g. Arrays, Dynamic Programming"
                        className="h-8 text-xs rounded-xl bg-background border-border"
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        {CATEGORY_PRESETS.slice(0, 4).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                              category === cat
                                ? "border-primary/60 bg-primary/10 text-primary font-medium"
                                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Difficulty & Points */}
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs font-medium text-foreground">Difficulty Level</Label>
                        <div className="flex gap-1 mt-1">
                          {(["Easy", "Medium", "Hard"] as ProblemDifficulty[]).map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDifficulty(d)}
                              className={`flex-1 py-1.5 text-xs rounded-xl border font-medium transition-all ${
                                difficulty === d
                                  ? "border-primary bg-primary/15 text-primary font-semibold shadow-xs"
                                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30"
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-medium text-foreground">Scoring Points</Label>
                        <div className="flex gap-1 items-center mt-1">
                          {POINTS_PRESETS.map((pts) => (
                            <button
                              key={pts}
                              type="button"
                              onClick={() => setPoints(pts)}
                              className={`flex-1 py-1 text-[11px] rounded-lg border font-mono font-medium transition-all ${
                                points === pts
                                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30"
                              }`}
                            >
                              {pts}
                            </button>
                          ))}
                          <Input
                            type="number"
                            value={points}
                            onChange={(e) => setPoints(Number(e.target.value))}
                            className="w-14 h-[29px] text-[11px] font-mono rounded-lg border-border bg-background px-1.5"
                            placeholder="pts"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEP 2: PROBLEM DETAILS & OCR EXTRACTION */}
                <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">2</span>
                      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Problem Title & Statement</h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Logical Step 2</span>
                  </div>

                  {/* OCR Drop Zone */}
                  <div>
                    <input
                      ref={ocrFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleOcrFile(file);
                        e.target.value = "";
                      }}
                    />
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleOcrFile(file);
                      }}
                      onClick={() => ocrFileInputRef.current?.click()}
                      className={`cursor-pointer rounded-xl border-2 border-dashed p-3 flex items-center gap-3 transition-all ${
                        dragOver
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/50 hover:bg-muted/30"
                      }`}
                    >
                      {ocrLoading ? (
                        <div className="flex items-center gap-3 w-full">
                          <RefreshCw size={16} className="animate-spin text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">{ocrStatus}</p>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">{ocrProgress}%</span>
                        </div>
                      ) : (
                        <>
                          <UploadCloud size={16} className="text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground">
                              Drop question screenshot → <span className="text-primary font-semibold">auto-fill via OCR</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground">PNG, JPG — extracts problem title, description, constraints & examples.</p>
                          </div>
                          {ocrRawText && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setShowRawOcr(!showRawOcr); }}
                              className="text-[10px] text-primary hover:underline shrink-0"
                            >
                              {showRawOcr ? "Hide raw" : "View raw"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {showRawOcr && ocrRawText && (
                      <Textarea rows={3} value={ocrRawText} readOnly
                        className="mt-2 text-[11px] font-mono bg-muted/40 border-border rounded-xl" />
                    )}
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">
                      Problem Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Two Sum, Valid Palindrome, Binary Search Tree"
                      className="h-9 text-xs rounded-xl bg-background border-border font-medium focus-visible:ring-primary/30"
                    />
                  </div>

                  {/* Problem Statement */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground">
                        Problem Statement <span className="text-destructive">*</span>
                      </Label>
                      <button type="button" onClick={insertStandardDescriptionTemplate}
                        className="text-[10px] text-primary hover:underline flex items-center gap-1 font-medium">
                        <Sparkles size={11} /> Insert standard template
                      </button>
                    </div>
                    <Textarea
                      rows={7}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the challenge clearly with problem background, inputs, outputs, and examples..."
                      className="text-xs rounded-xl bg-background border-border focus-visible:ring-primary/30 p-3 leading-relaxed resize-y"
                    />
                  </div>

                  {/* Constraints & Tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-foreground">
                        Constraints <span className="text-muted-foreground font-normal">(one per line)</span>
                      </Label>
                      <Textarea
                        rows={3}
                        value={constraintsText}
                        onChange={(e) => setConstraintsText(e.target.value)}
                        placeholder={"1 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9"}
                        className="text-xs font-mono rounded-xl bg-background border-border focus-visible:ring-primary/30 p-2.5 resize-y"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-foreground">
                        Tags <span className="text-muted-foreground font-normal">(comma-separated)</span>
                      </Label>
                      <Input
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
                        placeholder="Array, Two Pointers, Hash Table"
                        className="h-8 text-xs rounded-xl bg-background border-border focus-visible:ring-primary/30"
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        {TAG_PRESETS.slice(0, 6).map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              const cur = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
                              if (!cur.includes(tag)) setTagsText([...cur, tag].join(", "));
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                          >
                            +{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* ── RIGHT COLUMN: Starter Code, Test Cases, Author Override (6 Cols) ── */}
              <div className="lg:col-span-6 space-y-4">

                {/* STEP 3: STARTER CODE & TEMPLATES */}
                <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">3</span>
                      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Starter Code & Evaluation</h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Logical Step 3</span>
                  </div>

                  {/* Starter Code Box */}
                  <div className="rounded-xl border border-border bg-background overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                      <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Code2 size={13} className="text-primary" /> Starter Code Template
                      </Label>
                      <div className="flex items-center rounded-lg border border-border p-0.5 gap-0.5 bg-background">
                        {(["python", "javascript", "cpp"] as const).map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setActiveCodeLang(lang)}
                            className={`px-3 py-0.5 rounded-md text-[11px] transition-all ${
                              activeCodeLang === lang
                                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {lang === "python" ? "Python" : lang === "javascript" ? "JavaScript" : "C++"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="px-3 py-1 flex items-center justify-between bg-muted/20 border-b border-border/60">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {activeCodeLang === "python" && "main.py"}
                        {activeCodeLang === "javascript" && "solution.js"}
                        {activeCodeLang === "cpp" && "solution.cpp"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const d = getDefaultStarterCode();
                          if (activeCodeLang === "python") setPythonCode(d.python);
                          if (activeCodeLang === "javascript") setJavascriptCode(d.javascript);
                          if (activeCodeLang === "cpp") setCppCode(d.cpp);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-primary hover:underline"
                      >
                        Reset to default template
                      </button>
                    </div>

                    <div className="p-3">
                      {activeCodeLang === "python" && (
                        <Textarea
                          rows={8}
                          value={pythonCode}
                          onChange={(e) => setPythonCode(e.target.value)}
                          className="text-xs font-mono bg-transparent border-0 focus-visible:ring-0 p-0 resize-y leading-relaxed"
                          placeholder="def solve(): ..."
                        />
                      )}
                      {activeCodeLang === "javascript" && (
                        <Textarea
                          rows={8}
                          value={javascriptCode}
                          onChange={(e) => setJavascriptCode(e.target.value)}
                          className="text-xs font-mono bg-transparent border-0 focus-visible:ring-0 p-0 resize-y leading-relaxed"
                          placeholder="function solve() { ... }"
                        />
                      )}
                      {activeCodeLang === "cpp" && (
                        <Textarea
                          rows={8}
                          value={cppCode}
                          onChange={(e) => setCppCode(e.target.value)}
                          className="text-xs font-mono bg-transparent border-0 focus-visible:ring-0 p-0 resize-y leading-relaxed"
                          placeholder="int main() { ... }"
                        />
                      )}
                    </div>
                  </div>

                  {/* Test Cases: Sample & Hidden */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Sample Test Case */}
                    <div className="rounded-xl border border-border bg-background p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Eye size={12} className="text-emerald-500" /> Sample Test Case
                        </Label>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                          Public
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground mb-0.5">Input (stdin)</p>
                          <Textarea
                            rows={2}
                            value={sampleInput}
                            onChange={(e) => setSampleInput(e.target.value)}
                            placeholder={"4 9\n2 7 11 15"}
                            className="text-xs font-mono rounded-lg bg-muted/20 border-border"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground mb-0.5">Expected Output</p>
                          <Textarea
                            rows={2}
                            value={sampleOutput}
                            onChange={(e) => setSampleOutput(e.target.value)}
                            placeholder="0 1"
                            className="text-xs font-mono rounded-lg bg-muted/20 border-border"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">Explanation (optional)</p>
                          <Input
                            value={sampleExplanation}
                            onChange={(e) => setSampleExplanation(e.target.value)}
                            placeholder="nums[0]+nums[1]==9, return 0 1"
                            className="h-7 text-xs rounded-lg bg-muted/20 border-border"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hidden Test Case */}
                    <div className="rounded-xl border border-border bg-background p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Lock size={12} className="text-amber-500" /> Hidden Test Case
                        </Label>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                          Judge Only
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground mb-0.5">Input (stdin)</p>
                          <Textarea
                            rows={2}
                            value={hiddenInput}
                            onChange={(e) => setHiddenInput(e.target.value)}
                            placeholder={"3 6\n3 2 4"}
                            className="text-xs font-mono rounded-lg bg-muted/20 border-border"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground mb-0.5">Expected Output</p>
                          <Textarea
                            rows={2}
                            value={hiddenOutput}
                            onChange={(e) => setHiddenOutput(e.target.value)}
                            placeholder="1 2"
                            className="text-xs font-mono rounded-lg bg-muted/20 border-border"
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground pt-1 italic">
                          Protected judge case. Students receive Pass/Fail feedback without seeing evaluation data.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SuperAdmin author override */}
                  {isSuperAdmin && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-border p-3 bg-background">
                      <ShieldCheck size={14} className="text-primary shrink-0" />
                      <span className="text-[11px] text-muted-foreground font-medium shrink-0">Faculty Override:</span>
                      <Input
                        value={publishedBy}
                        onChange={(e) => setPublishedBy(e.target.value)}
                        placeholder="Faculty member name"
                        className="h-7 text-xs rounded-lg border-border bg-muted/20 flex-1"
                      />
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Cohort: <strong>{targetYear === "All" ? "All Years" : targetYear}</strong></span>
              <span>·</span>
              <span>Level: <strong>{difficulty}</strong></span>
              <span>·</span>
              <span>Points: <strong>{points} pts</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveProblem}
                className="text-xs rounded-xl gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 shadow-sm"
              >
                <Check size={14} />
                {editingId ? "Update Challenge" : "Publish Challenge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProblemsTab;
