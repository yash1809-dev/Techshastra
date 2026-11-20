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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  Shuffle,
  Download,
  Printer,
  Trash2,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  Zap,
} from "lucide-react";
import {
  type TheoryQuestion,
  generateRandomExamPaper,
  getDistinctSubjects,
} from "@/lib/services/theoryQuestionService";
import { downloadExamPaperDocx, type ExamPaperMetadata } from "@/lib/docxExport";

interface ExamPaperGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allQuestions: TheoryQuestion[];
  initialSubject?: string;
}

export const ExamPaperGeneratorModal: React.FC<ExamPaperGeneratorModalProps> = ({
  open,
  onOpenChange,
  allQuestions,
  initialSubject,
}) => {
  const { toast } = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter params
  const distinctSubjects = getDistinctSubjects(allQuestions);
  const [selectedSubject, setSelectedSubject] = useState<string>(
    initialSubject || (distinctSubjects.length > 0 ? distinctSubjects[0] : "Computer Networks")
  );
  // FIX 1A: Use string state to allow intermediate empty input
  const [questionCount, setQuestionCount] = useState<string>("10");
  const [selectedMarksFilter, setSelectedMarksFilter] = useState<string>("All");

  // Paper title for Publish Live
  const [paperTitle, setPaperTitle] = useState<string>("");

  // Working set of questions in the generated paper
  const [generatedQuestions, setGeneratedQuestions] = useState<TheoryQuestion[]>([]);
  const [poolRemaining, setPoolRemaining] = useState<TheoryQuestion[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (initialSubject) setSelectedSubject(initialSubject);
  }, [initialSubject]);

  useEffect(() => {
    if (!open) {
      setIsFullscreen(false);
    }
  }, [open]);

  // ── Random Synthesis Trigger ───────────────────────────────────────────────
  const handleGenerate = () => {
    // FIX 1B: Parse only when generating; clamp to minimum 1
    const count = Math.max(1, parseInt(questionCount, 10) || 1);
    // FIX 1C: Pass undefined (not null) for marksFilter when "All"
    const marksVal =
      selectedMarksFilter === "All"
        ? undefined
        : parseInt(selectedMarksFilter, 10) || undefined;

    const { selected, poolRemaining: remaining } = generateRandomExamPaper(allQuestions, {
      subject: selectedSubject,
      questionCount: count,
      marksFilter: marksVal,
    });

    if (selected.length === 0) {
      toast({
        title: "No Questions Match Filter",
        description: `No questions found under ${selectedSubject} with marks criteria. Try selecting 'All Marks'.`,
        variant: "destructive",
      });
      return;
    }

    setGeneratedQuestions(selected);
    setPoolRemaining(remaining);
    setHasGenerated(true);

    toast({
      title: "Question Paper Generated ✓",
      description: `Randomized ${selected.length} questions from question repository.`,
    });
  };

  // ── Swap Question with Pool Candidate ──────────────────────────────────────
  const handleSwapQuestion = (idx: number) => {
    if (poolRemaining.length === 0) {
      toast({
        title: "No Alternate Questions in Pool",
        description: "All matching questions are already used in this paper.",
      });
      return;
    }

    const nextPool = [...poolRemaining];
    const replacement = nextPool.shift()!;
    const currentQuestion = generatedQuestions[idx];
    nextPool.push(currentQuestion);

    const nextGenerated = [...generatedQuestions];
    nextGenerated[idx] = replacement;

    setGeneratedQuestions(nextGenerated);
    setPoolRemaining(nextPool);

    toast({
      title: "Question Swapped 🎲",
      description: `Replaced Question #${idx + 1} with an alternative candidate.`,
    });
  };

  // ── Move Question Up / Down ────────────────────────────────────────────────
  const handleMove = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= generatedQuestions.length) return;

    const next = [...generatedQuestions];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    setGeneratedQuestions(next);
  };

  // ── Remove Question ────────────────────────────────────────────────────────
  const handleRemove = (idx: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Edit Question Inline ───────────────────────────────────────────────────
  const handleUpdateQuestion = (idx: number, patch: Partial<TheoryQuestion>) => {
    setGeneratedQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // ── DOCX Export ────────────────────────────────────────────────────────────
  const handleDownloadDocx = async () => {
    if (generatedQuestions.length === 0) return;
    setIsExportingDocx(true);
    try {
      const meta: ExamPaperMetadata = {
        subject: selectedSubject,
      };
      await downloadExamPaperDocx(generatedQuestions, meta);
      toast({
        title: "Word Document Downloaded ✓",
        description: "You can open this .docx in Word, customize sections, and edit freely.",
      });
    } catch (err: any) {
      toast({
        title: "DOCX Export Failed",
        description: err?.message || "Could not generate Word document.",
        variant: "destructive",
      });
    } finally {
      setIsExportingDocx(false);
    }
  };

  // ── Print Mode ─────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  // ── TASK 4: Publish as Live Paper ─────────────────────────────────────────
  const handlePublishLive = () => {
    if (generatedQuestions.length === 0) return;
    setIsPublishing(true);
    try {
      const existing: any[] = (() => {
        try {
          const raw = localStorage.getItem("ts_live_papers");
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      })();

      const title =
        paperTitle.trim() ||
        `Practice Paper — ${selectedSubject} (${new Date().toLocaleDateString()})`;

      const newPaper = {
        id: crypto.randomUUID(),
        title,
        subject: selectedSubject,
        questions: generatedQuestions,
        publishedAt: new Date().toISOString(),
        publishedBy: "Faculty",
      };

      localStorage.setItem("ts_live_papers", JSON.stringify([newPaper, ...existing]));
      window.dispatchEvent(new CustomEvent("ts_theory_updated"));

      toast({
        title: "Published! 🎉",
        description: "Students can now see this paper in their Question Bank.",
      });
      setPaperTitle("");
    } catch (err: any) {
      toast({
        title: "Publish Failed",
        description: err?.message || "Could not publish live paper.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={(e) => {
          if (e.key === "Escape" && isFullscreen) {
            e.preventDefault();
            e.stopPropagation();
            setIsFullscreen(false);
          }
        }}
        style={
          isFullscreen
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                transform: "none",
                width: "100vw",
                height: "100vh",
                maxWidth: "100vw",
                maxHeight: "100vh",
                margin: 0,
                borderRadius: 0,
                zIndex: 50,
              }
            : undefined
        }
        className={cn(
          "flex flex-col p-0 overflow-hidden bg-card text-foreground transition-all duration-200 border border-border",
          isFullscreen
            ? "!fixed !top-0 !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !border-0 !m-0 !z-50"
            : "w-[96vw] max-w-6xl h-[92vh] max-h-[920px] rounded-3xl shadow-2xl"
        )}
      >
        {/* Accent Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/70 to-primary/20 shrink-0" />

        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-card/60 backdrop-blur-md">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0 pr-10 sm:pr-0">
              <DialogTitle className="text-lg sm:text-2xl font-heading font-light tracking-tight flex items-center gap-2 text-foreground truncate">
                <Shuffle className="w-5 h-5 text-primary shrink-0" /> Automated Question Paper Generator &amp; Reviewer
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground font-light mt-0.5 truncate">
                Synthesize randomized examination and sample papers. Edit, swap questions, and export directly to Word (.docx) or print.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={cn(
                  "h-8 px-2.5 text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs",
                  isFullscreen
                    ? "bg-primary text-primary-foreground border-primary font-semibold hover:bg-primary/90"
                    : "bg-background text-foreground border-border hover:bg-muted/40 font-medium"
                )}
              >
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span className="text-[11px] hidden xs:inline">{isFullscreen ? "Exit Fullscreen" : "Full Screen"}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadDocx}
                disabled={isExportingDocx || generatedQuestions.length === 0}
                className="rounded-xl text-xs font-light gap-1.5 h-8 px-3 border-border hover:bg-muted/40"
              >
                <Download size={13} />
                <span>{isExportingDocx ? "Exporting..." : "Download (.docx)"}</span>
              </Button>

              <Button
                size="sm"
                onClick={handlePrint}
                disabled={generatedQuestions.length === 0}
                className="rounded-xl text-xs font-medium gap-1.5 h-8 px-3.5 bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
              >
                <Printer size={13} /> Print / Save PDF
              </Button>
            </div>
          </div>

          {/* GENERATOR PARAMETERS TOOLBAR */}
          <div className="p-3 mt-2 rounded-2xl border border-border bg-background/80 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
              {/* Subject Select */}
              <div className="min-w-[160px]">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                  Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full h-8 text-xs rounded-xl border border-border bg-card px-2.5 text-foreground focus:outline-none"
                >
                  {distinctSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Marks Filter */}
              <div className="w-28">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                  Filter Marks
                </label>
                <select
                  value={selectedMarksFilter}
                  onChange={(e) => setSelectedMarksFilter(e.target.value)}
                  className="w-full h-8 text-xs rounded-xl border border-border bg-card px-2 text-foreground focus:outline-none"
                >
                  <option value="All">All Marks</option>
                  <option value="2">2 Marks</option>
                  <option value="4">4 Marks</option>
                  <option value="5">5 Marks</option>
                  <option value="10">10 Marks</option>
                  <option value="15">15 Marks</option>
                </select>
              </div>

              {/* Question Count — FIX: string state + onBlur clamp */}
              <div className="w-28">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                  Question Count
                </label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  onBlur={(e) => {
                    const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setQuestionCount(String(v));
                  }}
                  className="h-8 text-xs rounded-xl border-border bg-card text-center"
                />
              </div>

              {/* Paper Title Input for Publish Live */}
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                  Paper Title (optional)
                </label>
                <Input
                  type="text"
                  placeholder={`Practice Paper — ${selectedSubject}`}
                  value={paperTitle}
                  onChange={(e) => setPaperTitle(e.target.value)}
                  className="h-8 text-xs rounded-xl border-border bg-card"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Button
                type="button"
                onClick={handleGenerate}
                className="rounded-xl text-xs h-8 px-4 font-medium gap-1.5 bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
              >
                <Shuffle size={13} />
                <span>Randomize &amp; Generate</span>
              </Button>

              {/* Publish Live */}
              <Button
                type="button"
                onClick={handlePublishLive}
                disabled={isPublishing || generatedQuestions.length === 0}
                variant="outline"
                className="rounded-xl text-xs h-8 px-3 font-medium gap-1.5 border-primary/50 text-primary hover:bg-primary/10"
              >
                <Zap size={13} />
                <span>{isPublishing ? "Publishing..." : "Publish Live"}</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Paper Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/10">
          {!hasGenerated && generatedQuestions.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Shuffle size={26} />
              </div>
              <div>
                <h3 className="text-base font-heading font-medium text-foreground">
                  Ready to Generate Question Paper
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  Choose your subject, specify how many questions you want, and click{" "}
                  <strong>Randomize &amp; Generate</strong>. You will be able to review, edit wording,
                  swap questions, download as Word (.docx), and publish live for students.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6 pb-12">
              {/* EXAM PAPER PREVIEW — Questions only (no university header) */}
              <div
                id="exam-paper-printable"
                className="bg-card text-foreground rounded-2xl border border-border shadow-xl p-6 sm:p-10"
              >
                <div className="space-y-5 pt-2">
                  {generatedQuestions.map((q, idx) => (
                    <div
                      key={q.id + idx}
                      className="p-4 rounded-xl border border-border bg-background/60 space-y-3 relative group transition-all hover:border-primary/40 shadow-xs"
                    >
                      {/* Question Top Bar */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-sm text-foreground">
                            Q{idx + 1}.
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border capitalize">
                            {q.questionType}
                          </Badge>
                          {q.topic && (
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">
                              · {q.topic}
                            </span>
                          )}
                        </div>

                        {/* Controls: Marks, Swap, Move, Delete */}
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">Marks:</span>
                            <Input
                              type="number"
                              value={q.marks ?? ""}
                              placeholder="Marks"
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                handleUpdateQuestion(idx, { marks: val });
                              }}
                              className="w-16 h-6 text-xs rounded border-border bg-card text-center"
                            />
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleSwapQuestion(idx)}
                            className="h-6 text-[10px] rounded px-2 gap-1 border-border hover:bg-primary/10 hover:text-primary"
                            title="Replace this question with another random question from the bank"
                          >
                            <Shuffle size={11} />
                            <span>Swap</span>
                          </Button>

                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, "up")}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
                            title="Move Up"
                          >
                            <ChevronUp size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === generatedQuestions.length - 1}
                            onClick={() => handleMove(idx, "down")}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
                            title="Move Down"
                          >
                            <ChevronDown size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemove(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                            title="Remove from this paper"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Question Textarea */}
                      <Textarea
                        value={q.questionText}
                        onChange={(e) => handleUpdateQuestion(idx, { questionText: e.target.value })}
                        rows={2}
                        className="text-xs sm:text-sm rounded-lg border-border bg-card/60 resize-none leading-relaxed font-sans"
                      />

                      {/* Diagram Preview */}
                      {q.diagramUrl && (
                        <div className="p-2 rounded-xl border border-border bg-white inline-block">
                          <img
                            src={q.diagramUrl}
                            alt={`Figure for Q${idx + 1}`}
                            className="max-h-48 max-w-full rounded object-contain"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
