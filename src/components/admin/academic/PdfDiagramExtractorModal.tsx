import React, { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
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
  Upload,
  FileText,
  Scissors,
  Check,
  Trash2,
  Plus,
  Maximize2,
  Minimize2,
  ArrowUpDown,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Camera,
  Image as ImageIcon,
  RotateCcw,
} from "lucide-react";
import {
  type TheoryQuestion,
  type QuestionCategory,
  saveTheoryQuestionsBatch,
} from "@/lib/services/theoryQuestionService";

// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface ExtractedStagingItem {
  tempId: string;
  questionNumber: number;
  questionText: string;
  marks?: number | null;
  questionType: QuestionCategory;
  diagramUrl?: string;
  sourcePage?: number;
}

interface PdfDiagramExtractorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuestionsSaved: () => void;
  defaultSubject?: string;
}

export const PdfDiagramExtractorModal: React.FC<PdfDiagramExtractorModalProps> = ({
  open,
  onOpenChange,
  onQuestionsSaved,
  defaultSubject = "Computer Networks",
}) => {
  const { toast } = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [subjectCode, setSubjectCode] = useState("");
  const [yearCohort, setYearCohort] = useState("All");

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Staging list of extracted questions
  const [questions, setQuestions] = useState<ExtractedStagingItem[]>([]);
  const [bulkMarksInput, setBulkMarksInput] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"num" | "marks-desc" | "marks-asc">("num");

  // Cropper state
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState<number | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isCroppingDrag, setIsCroppingDrag] = useState(false);

  useEffect(() => {
    if (defaultSubject) setSubject(defaultSubject);
  }, [defaultSubject]);

  useEffect(() => {
    if (!open) {
      setIsFullscreen(false);
      setPdfFile(null);
      setPdfDoc(null);
      setQuestions([]);
      setCropMode(false);
      setCropBox(null);
    }
  }, [open]);

  // ── Render PDF Page to Canvas ──────────────────────────────────────────────
  const renderPage = async (pageNumber: number, doc: pdfjsLib.PDFDocumentProxy) => {
    try {
      const page = await doc.getPage(pageNumber);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const viewport = page.getViewport({ scale: 1.5 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) return;

      await page.render({ canvasContext: context, viewport }).promise;
    } catch (_e) {}
  };

  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPage(currentPage, pdfDoc);
    }
  }, [pdfDoc, currentPage]);

  // ── Smart Question Segmentation Engine ─────────────────────────────────────
  const parsePdfFile = async (file: File) => {
    setIsParsing(true);
    setPdfFile(file);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);

      let fullRawText = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || "")
          .join(" ");
        fullRawText += `\n--- PAGE ${i} ---\n` + pageText;
      }

      // Smart Regex segmenter: matches Q1., Q.1, Question 1:, 1., 2)
      const questionRegex = /(?:^|\n|\s)\s*(?:(?:Q(?:uestion)?\s*\.?\s*|Q\s*-\s*)(\d+)|(\d+)[\.\)])\s*[:\.]?\s*([\s\S]*?)(?=(?:(?:Q(?:uestion)?\s*\.?\s*|Q\s*-\s*)\d+|\n\s*\d+[\.\)])|$)/gi;

      const items: ExtractedStagingItem[] = [];
      let match;
      let qNum = 1;

      while ((match = questionRegex.exec(fullRawText)) !== null) {
        const parsedNum = parseInt(match[1] || match[2] || String(qNum), 10);
        let rawContent = (match[3] || "").trim();

        // Clean out page markers
        rawContent = rawContent.replace(/---\s*PAGE\s*\d+\s*---/gi, "").trim();

        if (rawContent.length > 5) {
          // Detect marks like [5 Marks], (10), 10M, [2 marks]
          let detectedMarks: number | null = null;
          const marksMatch = rawContent.match(/(?:\[|\()(\d+)\s*(?:marks?|m)?(?:\)|\])/i);
          if (marksMatch) {
            detectedMarks = parseInt(marksMatch[1], 10);
            rawContent = rawContent.replace(marksMatch[0], "").trim();
          }

          // Classify question type
          const isNumerical = /calculate|compute|solve|find the value|evaluate|derive|subnets/i.test(rawContent);
          const isDiagram = /diagram|circuit|draw|sketch|schematic|graph|architecture/i.test(rawContent);

          items.push({
            tempId: crypto.randomUUID(),
            questionNumber: parsedNum || qNum,
            questionText: rawContent,
            marks: detectedMarks,
            questionType: isDiagram ? "diagram" : isNumerical ? "numerical" : "theory",
            sourcePage: 1,
          });
          qNum++;
        }
      }

      // If regex found no questions (e.g. non-standard numbering), segment by paragraphs
      if (items.length === 0) {
        const cleanParas = fullRawText
          .replace(/---\s*PAGE\s*\d+\s*---/gi, "")
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 20);

        cleanParas.forEach((p, idx) => {
          items.push({
            tempId: crypto.randomUUID(),
            questionNumber: idx + 1,
            questionText: p,
            marks: null,
            questionType: "theory",
            sourcePage: 1,
          });
        });
      }

      setQuestions(items);
      toast({
        title: "PDF Parsed Successfully ✓",
        description: `Extracted ${items.length} separate questions ready for review.`,
      });
    } catch (err: any) {
      toast({
        title: "Extraction Error",
        description: err?.message || "Could not parse questions from PDF.",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  // ── Batch Apply Marks ──────────────────────────────────────────────────────
  const handleApplyMarksToAll = () => {
    if (!bulkMarksInput.trim()) {
      // Clear marks
      setQuestions((prev) => prev.map((q) => ({ ...q, marks: null })));
      toast({ title: "Marks Cleared", description: "All questions set to general category." });
      return;
    }
    const val = parseInt(bulkMarksInput.trim(), 10);
    if (isNaN(val) || val < 0) {
      toast({ title: "Invalid Marks", description: "Please enter a valid positive number.", variant: "destructive" });
      return;
    }
    setQuestions((prev) => prev.map((q) => ({ ...q, marks: val })));
    toast({
      title: "Batch Marks Applied ✓",
      description: `All ${questions.length} questions assigned ${val} marks.`,
    });
  };

  // ── Cropper Drag Handlers ──────────────────────────────────────────────────
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropMode || selectedQuestionIdx === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setCropStart({ x, y });
    setCropBox(null);
    setIsCroppingDrag(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCroppingDrag || !cropStart || !cropMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    const x = Math.min(cropStart.x, currentX);
    const y = Math.min(cropStart.y, currentY);
    const w = Math.abs(currentX - cropStart.x);
    const h = Math.abs(currentY - cropStart.y);

    setCropBox({ x, y, w, h });
  };

  const handleCanvasMouseUp = () => {
    setIsCroppingDrag(false);
  };

  const handleApplyCropToQuestion = () => {
    if (!cropBox || selectedQuestionIdx === null || !canvasRef.current) return;
    if (cropBox.w < 10 || cropBox.h < 10) {
      toast({ title: "Crop Selection Too Small", description: "Drag a box around the diagram or circuit.", variant: "destructive" });
      return;
    }

    const canvas = canvasRef.current;
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropBox.w;
    cropCanvas.height = cropBox.h;
    const ctx = cropCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(canvas, cropBox.x, cropBox.y, cropBox.w, cropBox.h, 0, 0, cropBox.w, cropBox.h);
    const dataUrl = cropCanvas.toDataURL("image/png");

    setQuestions((prev) => {
      const next = [...prev];
      next[selectedQuestionIdx] = {
        ...next[selectedQuestionIdx],
        diagramUrl: dataUrl,
        questionType: "diagram",
      };
      return next;
    });

    toast({
      title: "Diagram Attached ✓",
      description: `Attached circuit/graph diagram to Question #${questions[selectedQuestionIdx].questionNumber}.`,
    });
    setCropMode(false);
    setCropBox(null);
    setSelectedQuestionIdx(null);
  };

  // ── Save All Questions to DB ───────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (questions.length === 0) {
      toast({ title: "No Questions", description: "Extract questions before saving.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      await saveTheoryQuestionsBatch(
        questions.map((q) => ({
          subject: subject.trim() || "General Academic",
          subjectCode: subjectCode.trim() || undefined,
          yearCohort,
          questionText: q.questionText,
          marks: q.marks,
          questionType: q.questionType,
          diagramUrl: q.diagramUrl,
          sourceFileName: pdfFile?.name || "Uploaded PDF",
        }))
      );

      toast({
        title: "Saved to Question Bank ✓",
        description: `Successfully stored ${questions.length} questions into ${subject}.`,
      });
      onQuestionsSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err?.message || "Could not save questions.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Sorted Questions View ──────────────────────────────────────────────────
  const sortedQuestions = [...questions].sort((a, b) => {
    if (sortOrder === "marks-desc") return (b.marks || 0) - (a.marks || 0);
    if (sortOrder === "marks-asc") return (a.marks || 0) - (b.marks || 0);
    return a.questionNumber - b.questionNumber;
  });

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
        {/* Accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/70 to-primary/20 shrink-0" />

        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-card/60 backdrop-blur-md">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0 pr-10 sm:pr-0">
              <DialogTitle className="text-lg sm:text-2xl font-heading font-light tracking-tight flex items-center gap-2 text-foreground truncate">
                <FileText className="w-5 h-5 text-primary shrink-0" /> PDF Question Extractor & Diagram Cropper
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground font-light mt-0.5 truncate">
                Extract up to 150+ theory and numerical questions, crop circuit/graph diagrams, and batch-assign marks.
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
                onClick={handleSaveAll}
                disabled={isSaving || questions.length === 0}
                className="rounded-xl text-xs font-medium gap-1.5 h-8 px-4 bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
              >
                <Check size={14} />
                <span>{isSaving ? "Saving..." : `Save ${questions.length} Questions`}</span>
              </Button>
            </div>
          </div>

          {/* Target Subject & Cohort Setup Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                Subject Name
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Computer Networks"
                className="h-8 text-xs rounded-xl border-border bg-background"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                Subject Code (Optional)
              </label>
              <Input
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                placeholder="e.g. BCS-502"
                className="h-8 text-xs rounded-xl border-border bg-background"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                Year / Cohort
              </label>
              <select
                value={yearCohort}
                onChange={(e) => setYearCohort(e.target.value)}
                className="w-full h-8 text-xs rounded-xl border border-border bg-background px-2.5 text-foreground focus:outline-none"
              >
                <option value="All">All Cohorts</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>
          </div>
        </DialogHeader>

        {/* Workspace Body: Split View (Canvas & Cropper on Left | Extracted Questions on Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border bg-muted/10">

          {/* LEFT: PDF VIEWER & DIAGRAM CANVAS (5 Cols on Desktop) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-card/40 overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="pdf-upload-input"
                  accept=".pdf,application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) parsePdfFile(file);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => document.getElementById("pdf-upload-input")?.click()}
                  className="h-7 text-xs rounded-lg gap-1.5 border-border"
                >
                  <Upload size={12} /> Choose PDF / Exam Paper
                </Button>
                {pdfFile && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                    {pdfFile.name}
                  </span>
                )}
              </div>

              {numPages > 1 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="font-mono text-[11px]">
                    {currentPage} / {numPages}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={currentPage >= numPages}
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              )}
            </div>

            {/* Canvas Container with drag cropping */}
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-start relative select-none">
              {!pdfDoc && !isParsing && (
                <div className="my-auto text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Upload size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-heading font-medium text-foreground">Upload Question Paper PDF</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Extracts all questions and allows cropping circuit diagrams or graphs directly from the pages.
                    </p>
                  </div>
                </div>
              )}

              {isParsing && (
                <div className="my-auto text-center p-6 space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                  <p className="text-xs text-muted-foreground">Parsing PDF & segmenting questions...</p>
                </div>
              )}

              <div className="relative border border-border shadow-md rounded-lg overflow-hidden bg-white max-w-full">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  className={cn("max-w-full h-auto block", cropMode ? "cursor-crosshair" : "cursor-default")}
                />

                {/* Cropping bounding box overlay */}
                {cropMode && cropBox && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${cropBox.x * (canvasRef.current ? canvasRef.current.clientWidth / canvasRef.current.width : 1)}px`,
                      top: `${cropBox.y * (canvasRef.current ? canvasRef.current.clientHeight / canvasRef.current.height : 1)}px`,
                      width: `${cropBox.w * (canvasRef.current ? canvasRef.current.clientWidth / canvasRef.current.width : 1)}px`,
                      height: `${cropBox.h * (canvasRef.current ? canvasRef.current.clientHeight / canvasRef.current.height : 1)}px`,
                      border: "2px dashed #6366f1",
                      backgroundColor: "rgba(99, 102, 241, 0.2)",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            </div>

            {/* Cropping Tool Control Bar */}
            {cropMode && (
              <div className="p-3 border-t border-border bg-primary/10 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <Scissors size={14} />
                  <span>Cropping for Question #{selectedQuestionIdx !== null ? questions[selectedQuestionIdx]?.questionNumber : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCropMode(false);
                      setCropBox(null);
                    }}
                    className="h-7 text-xs rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApplyCropToQuestion}
                    disabled={!cropBox}
                    className="h-7 text-xs rounded-lg bg-primary text-primary-foreground gap-1"
                  >
                    <Check size={12} /> Attach Diagram
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: EXTRACTED QUESTIONS REVIEW & MARKS ASSIGNMENT (7 Cols on Desktop) */}
          <div className="lg:col-span-7 flex flex-col h-full overflow-hidden">

            {/* BATCH MARKS BAR & CONTROLS */}
            <div className="p-3 sm:p-4 border-b border-border bg-card/60 backdrop-blur-xs flex items-center justify-between flex-wrap gap-2.5 shrink-0">
              {/* Bulk Marks Assignment */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-heading uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Apply Marks to All:
                </span>
                <Input
                  type="number"
                  placeholder="e.g. 2, 5, 10"
                  value={bulkMarksInput}
                  onChange={(e) => setBulkMarksInput(e.target.value)}
                  className="w-24 h-7 text-xs rounded-lg border-border bg-background"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApplyMarksToAll}
                  className="h-7 text-xs rounded-lg px-2.5 border-border"
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setBulkMarksInput("");
                    setQuestions((prev) => prev.map((q) => ({ ...q, marks: null })));
                  }}
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2"
                  title="Clear marks (stores under general uncategorized)"
                >
                  Leave Blank
                </Button>
              </div>

              {/* Sorting & Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sort:</span>
                <Button
                  size="sm"
                  variant={sortOrder === "num" ? "secondary" : "ghost"}
                  onClick={() => setSortOrder("num")}
                  className="h-7 text-[11px] px-2 rounded-lg"
                >
                  Q#
                </Button>
                <Button
                  size="sm"
                  variant={sortOrder === "marks-desc" ? "secondary" : "ghost"}
                  onClick={() => setSortOrder(sortOrder === "marks-desc" ? "marks-asc" : "marks-desc")}
                  className="h-7 text-[11px] px-2 rounded-lg gap-1"
                >
                  <ArrowUpDown size={11} /> Marks {sortOrder === "marks-desc" ? "↓" : "↑"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newItem: ExtractedStagingItem = {
                      tempId: crypto.randomUUID(),
                      questionNumber: questions.length + 1,
                      questionText: "New examination question...",
                      marks: null,
                      questionType: "theory",
                      sourcePage: currentPage,
                    };
                    setQuestions((prev) => [...prev, newItem]);
                  }}
                  className="h-7 text-xs rounded-lg px-2 border-border gap-1"
                >
                  <Plus size={12} /> Add
                </Button>
              </div>
            </div>

            {/* Questions Staging List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {questions.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <FileText className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm font-heading">No Extracted Questions Yet</p>
                  <p className="text-xs max-w-sm mt-1">
                    Upload a question paper PDF on the left. The engine will automatically segment all questions.
                  </p>
                </div>
              ) : (
                sortedQuestions.map((q, idx) => {
                  const originalIdx = questions.findIndex((item) => item.tempId === q.tempId);
                  return (
                    <div
                      key={q.tempId}
                      className="p-3.5 rounded-2xl border border-border bg-background/80 space-y-2.5 transition-all shadow-xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 border-primary/30 text-primary">
                            Q{q.questionNumber}
                          </Badge>
                          <select
                            value={q.questionType}
                            onChange={(e) => {
                              const val = e.target.value as QuestionCategory;
                              setQuestions((prev) => {
                                const next = [...prev];
                                next[originalIdx].questionType = val;
                                return next;
                              });
                            }}
                            className="h-6 text-[10px] rounded-md border border-border bg-card px-1.5 text-foreground capitalize focus:outline-none"
                          >
                            <option value="theory">Theory</option>
                            <option value="numerical">Numerical</option>
                            <option value="diagram">Diagram / Circuit</option>
                            <option value="short">Short Answer</option>
                            <option value="long">Long Answer</option>
                          </select>
                        </div>

                        {/* Marks & Actions */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">Marks:</span>
                            <Input
                              type="number"
                              value={q.marks ?? ""}
                              placeholder="General"
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                setQuestions((prev) => {
                                  const next = [...prev];
                                  next[originalIdx].marks = val;
                                  return next;
                                });
                              }}
                              className="w-16 h-6 text-xs rounded-md border-border bg-card text-center"
                            />
                          </div>

                          {/* Crop / Attach Diagram Button */}
                          <Button
                            type="button"
                            size="sm"
                            variant={q.diagramUrl ? "secondary" : "outline"}
                            onClick={() => {
                              setSelectedQuestionIdx(originalIdx);
                              setCropMode(true);
                              toast({
                                title: "Crop Mode Activated",
                                description: `Drag a box on the PDF page on the left to crop circuit/graph for Question #${q.questionNumber}.`,
                              });
                            }}
                            className="h-6 px-2 text-[11px] rounded-md gap-1 border-border"
                          >
                            <Scissors size={11} />
                            <span>{q.diagramUrl ? "Change Diagram" : "Crop Diagram"}</span>
                          </Button>

                          {/* Delete Question */}
                          <button
                            type="button"
                            onClick={() => {
                              setQuestions((prev) => prev.filter((_, i) => i !== originalIdx));
                            }}
                            className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                            title="Delete extracted question"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Question Text Editor */}
                      <Textarea
                        value={q.questionText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestions((prev) => {
                            const next = [...prev];
                            next[originalIdx].questionText = val;
                            return next;
                          });
                        }}
                        rows={2}
                        className="text-xs rounded-xl border-border bg-card/60 resize-none leading-relaxed font-sans"
                        placeholder="Question content..."
                      />

                      {/* Diagram Thumbnail Preview if attached */}
                      {q.diagramUrl && (
                        <div className="flex items-center gap-3 p-2 rounded-xl border border-primary/20 bg-primary/5">
                          <img
                            src={q.diagramUrl}
                            alt="Attached Circuit Diagram"
                            className="h-14 w-auto rounded-lg border border-border object-contain bg-white"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-medium text-foreground block">
                              Circuit / Graph Diagram Attached
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Will be embedded into Word (.docx) & university print layout.
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setQuestions((prev) => {
                                const next = [...prev];
                                next[originalIdx].diagramUrl = undefined;
                                return next;
                              });
                            }}
                            className="h-6 text-[10px] text-destructive hover:bg-destructive/10"
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

