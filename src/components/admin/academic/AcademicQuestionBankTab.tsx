import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText,
  Upload,
  Shuffle,
  Plus,
  Trash2,
  Edit3,
  Search,
  Filter,
  Layers,
  BookOpen,
  Hash,
  Sparkles,
  Camera,
  Scissors,
  Check,
  Calculator,
  Cpu,
  GraduationCap,
} from "lucide-react";
import {
  type TheoryQuestion,
  type QuestionCategory,
  getTheoryQuestions,
  saveTheoryQuestionsBatch,
  updateTheoryQuestion,
  deleteTheoryQuestion,
  getDistinctSubjects,
} from "@/lib/services/theoryQuestionService";
import { PdfDiagramExtractorModal } from "./PdfDiagramExtractorModal";
import { ExamPaperGeneratorModal } from "./ExamPaperGeneratorModal";

export const AcademicQuestionBankTab: React.FC = () => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<TheoryQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [extractorOpen, setExtractorOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TheoryQuestion | null>(null);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>("All");
  const [selectedMarksFilter, setSelectedMarksFilter] = useState<string>("All");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Manual Question Form State
  const [manualForm, setManualForm] = useState<{
    subject: string;
    subjectCode: string;
    yearCohort: string;
    questionText: string;
    marks: string;
    questionType: QuestionCategory;
    topic: string;
    diagramUrl: string;
  }>({
    subject: "Computer Networks",
    subjectCode: "BCS-502",
    yearCohort: "All",
    questionText: "",
    marks: "5",
    questionType: "theory",
    topic: "",
    diagramUrl: "",
  });

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await getTheoryQuestions();
      setQuestions(data);
    } catch (_e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const distinctSubjects = useMemo(() => getDistinctSubjects(questions), [questions]);

  // Filtered List
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (selectedSubject !== "All" && q.subject.toLowerCase() !== selectedSubject.toLowerCase()) {
        return false;
      }
      if (selectedMarksFilter !== "All") {
        if (selectedMarksFilter === "Uncategorized") {
          if (q.marks !== null && q.marks !== undefined) return false;
        } else {
          if (Number(q.marks) !== Number(selectedMarksFilter)) return false;
        }
      }
      if (selectedTypeFilter !== "All" && q.questionType !== selectedTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const qText = (q.questionText || "").toLowerCase();
        const sub = (q.subject || "").toLowerCase();
        const top = (q.topic || "").toLowerCase();
        const query = searchQuery.toLowerCase();
        if (!qText.includes(query) && !sub.includes(query) && !top.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [questions, selectedSubject, selectedMarksFilter, selectedTypeFilter, searchQuery]);

  // Stats
  const totalQuestions = questions.length;
  const numericalCount = questions.filter((q) => q.questionType === "numerical").length;
  const diagramCount = questions.filter((q) => !!q.diagramUrl || q.questionType === "diagram").length;
  const theoryCount = questions.filter((q) => q.questionType === "theory").length;

  // Save Manual Question
  const handleSaveManual = async () => {
    if (!manualForm.questionText.trim()) {
      toast({ title: "Required", description: "Please enter question text.", variant: "destructive" });
      return;
    }

    try {
      if (editingQuestion) {
        await updateTheoryQuestion(editingQuestion.id, {
          subject: manualForm.subject,
          subjectCode: manualForm.subjectCode || undefined,
          yearCohort: manualForm.yearCohort,
          questionText: manualForm.questionText,
          marks: manualForm.marks ? Number(manualForm.marks) : null,
          questionType: manualForm.questionType,
          topic: manualForm.topic || undefined,
          diagramUrl: manualForm.diagramUrl || undefined,
        });
        toast({ title: "Question Updated ✓" });
      } else {
        await saveTheoryQuestionsBatch([
          {
            subject: manualForm.subject,
            subjectCode: manualForm.subjectCode || undefined,
            yearCohort: manualForm.yearCohort,
            questionText: manualForm.questionText,
            marks: manualForm.marks ? Number(manualForm.marks) : null,
            questionType: manualForm.questionType,
            topic: manualForm.topic || undefined,
            diagramUrl: manualForm.diagramUrl || undefined,
          },
        ]);
        toast({ title: "Question Added ✓" });
      }
      setManualAddOpen(false);
      setEditingQuestion(null);
      loadQuestions();
    } catch (_err) {
      toast({ title: "Save Error", description: "Could not save question.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTheoryQuestion(id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    toast({ title: "Question Deleted" });
  };

  const handleEdit = (q: TheoryQuestion) => {
    setEditingQuestion(q);
    setManualForm({
      subject: q.subject,
      subjectCode: q.subjectCode || "",
      yearCohort: q.yearCohort || "All",
      questionText: q.questionText,
      marks: q.marks !== null && q.marks !== undefined ? String(q.marks) : "",
      questionType: q.questionType,
      topic: q.topic || "",
      diagramUrl: q.diagramUrl || "",
    });
    setManualAddOpen(true);
  };

  return (
    <div className="space-y-6">

      {/* TOP HEADER & ACTION CARDS */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-light tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Universal Academic Question Bank
          </h2>
          <p className="text-xs text-muted-foreground font-light mt-0.5">
            Ingest theory, circuit & numerical questions from PDFs, batch-assign marks, and generate randomized examination papers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setExtractorOpen(true)}
            className="rounded-xl text-xs font-medium gap-1.5 h-8 px-3.5 bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
          >
            <Upload size={13} />
            <span>Upload PDF & Extract</span>
          </Button>

          <Button
            onClick={() => setGeneratorOpen(true)}
            variant="outline"
            className="rounded-xl text-xs font-medium gap-1.5 h-8 px-3.5 border-border bg-card hover:bg-muted/40 text-foreground"
          >
            <Shuffle size={13} className="text-primary" />
            <span>Generate Exam Paper</span>
          </Button>

          <Button
            onClick={() => {
              setEditingQuestion(null);
              setManualForm({
                subject: distinctSubjects[0] || "Computer Networks",
                subjectCode: "",
                yearCohort: "All",
                questionText: "",
                marks: "5",
                questionType: "theory",
                topic: "",
                diagramUrl: "",
              });
              setManualAddOpen(true);
            }}
            variant="outline"
            className="rounded-xl text-xs font-light gap-1 h-8 px-2.5 border-border"
          >
            <Plus size={13} />
            <span>Add Single</span>
          </Button>
        </div>
      </div>

      {/* STATS TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-border bg-card/60 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
            Total Questions
          </span>
          <span className="text-xl font-heading font-bold text-foreground">
            {totalQuestions}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl border border-border bg-card/60 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
            Subjects in Bank
          </span>
          <span className="text-xl font-heading font-bold text-foreground">
            {distinctSubjects.length}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl border border-border bg-card/60 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
            Numericals
          </span>
          <span className="text-xl font-heading font-bold text-primary font-mono">
            {numericalCount}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl border border-border bg-card/60 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
            Circuits / Diagrams
          </span>
          <span className="text-xl font-heading font-bold text-emerald-500 font-mono">
            {diagramCount}
          </span>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-3.5 rounded-2xl border border-border bg-card/60 backdrop-blur-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search question text or topic..."
              className="h-8 pl-8 text-xs rounded-xl border-border bg-background"
            />
          </div>

          {/* Subject Filter */}
          <div className="min-w-[140px]">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full h-8 text-xs rounded-xl border border-border bg-background px-2 text-foreground focus:outline-none"
            >
              <option value="All">All Subjects</option>
              {distinctSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Marks Filter */}
          <div className="w-28">
            <select
              value={selectedMarksFilter}
              onChange={(e) => setSelectedMarksFilter(e.target.value)}
              className="w-full h-8 text-xs rounded-xl border border-border bg-background px-2 text-foreground focus:outline-none"
            >
              <option value="All">All Marks</option>
              <option value="2">2 Marks</option>
              <option value="4">4 Marks</option>
              <option value="5">5 Marks</option>
              <option value="10">10 Marks</option>
              <option value="Uncategorized">General (No Marks)</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="w-32">
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="w-full h-8 text-xs rounded-xl border border-border bg-background px-2 text-foreground focus:outline-none"
            >
              <option value="All">All Formats</option>
              <option value="theory">Theory</option>
              <option value="numerical">Numerical</option>
              <option value="diagram">Diagram / Circuit</option>
              <option value="short">Short Answer</option>
              <option value="long">Long Answer</option>
            </select>
          </div>
        </div>

        <span className="text-[11px] text-muted-foreground">
          Showing <strong>{filteredQuestions.length}</strong> of {totalQuestions}
        </span>
      </div>

      {/* QUESTION CARDS LIST */}
      <div className="space-y-3">
        {filteredQuestions.length === 0 ? (
          <div className="h-48 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <BookOpen className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm font-heading">No Questions Match Selected Criteria</p>
            <p className="text-xs max-w-sm mt-0.5">
              Adjust your filters or upload a question paper PDF to add more questions to the repository.
            </p>
          </div>
        ) : (
          filteredQuestions.map((q, idx) => (
            <div
              key={q.id}
              className="p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-xs space-y-3 relative group transition-all hover:border-primary/40 shadow-xs"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs font-mono px-2 py-0.5">
                    #{idx + 1}
                  </Badge>
                  <span className="font-heading font-medium text-xs text-foreground">
                    {q.subject}
                  </span>
                  {q.subjectCode && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ({q.subjectCode})
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize border-border">
                    {q.questionType}
                  </Badge>
                  {q.marks !== null && q.marks !== undefined ? (
                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                      {q.marks} Marks
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border">
                      General
                    </Badge>
                  )}
                  {q.topic && (
                    <span className="text-[11px] text-muted-foreground">
                      · {q.topic}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(q)}
                    className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-lg"
                    title="Edit Question"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg"
                    title="Delete Question"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <p className="text-xs sm:text-sm text-foreground/90 font-light leading-relaxed whitespace-pre-line">
                {q.questionText}
              </p>

              {/* Sub-parts if present */}
              {q.subParts && q.subParts.length > 0 && (
                <div className="space-y-1 pl-4 border-l-2 border-border text-xs">
                  {q.subParts.map((sp, spIdx) => (
                    <div key={spIdx} className="text-muted-foreground">
                      <strong className="text-foreground">{sp.label}</strong> {sp.text}{" "}
                      {sp.marks && <span className="text-primary font-mono">[{sp.marks} M]</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Diagram / Circuit Preview if attached */}
              {q.diagramUrl && (
                <div className="pt-1">
                  <div className="p-2 rounded-xl border border-border bg-white inline-block shadow-xs">
                    <img
                      src={q.diagramUrl}
                      alt="Circuit / Graph diagram"
                      className="max-h-36 max-w-xs rounded object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: PDF EXTRACTOR */}
      <PdfDiagramExtractorModal
        open={extractorOpen}
        onOpenChange={setExtractorOpen}
        onQuestionsSaved={loadQuestions}
        defaultSubject={selectedSubject !== "All" ? selectedSubject : "Computer Networks"}
      />

      {/* MODAL 2: EXAM PAPER GENERATOR */}
      <ExamPaperGeneratorModal
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        allQuestions={questions}
        initialSubject={selectedSubject !== "All" ? selectedSubject : undefined}
      />

      {/* MODAL 3: MANUAL QUESTION ADD / EDIT */}
      <Dialog open={manualAddOpen} onOpenChange={setManualAddOpen}>
        <DialogContent className="max-w-xl bg-card border-border text-foreground rounded-2xl p-5 sm:p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-heading font-medium flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-primary" /> {editingQuestion ? "Edit Academic Question" : "Add Academic Question"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add subjective, theoretical, or numerical question directly to the university repository.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground block mb-1">Subject</label>
                <Input
                  value={manualForm.subject}
                  onChange={(e) => setManualForm({ ...manualForm, subject: e.target.value })}
                  placeholder="e.g. Operating Systems"
                  className="h-8 text-xs rounded-xl border-border bg-background"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground block mb-1">Subject Code</label>
                <Input
                  value={manualForm.subjectCode}
                  onChange={(e) => setManualForm({ ...manualForm, subjectCode: e.target.value })}
                  placeholder="e.g. BCS-401"
                  className="h-8 text-xs rounded-xl border-border bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground block mb-1">Marks (or leave blank)</label>
                <Input
                  type="number"
                  value={manualForm.marks}
                  onChange={(e) => setManualForm({ ...manualForm, marks: e.target.value })}
                  placeholder="Leave blank for general"
                  className="h-8 text-xs rounded-xl border-border bg-background"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground block mb-1">Format / Category</label>
                <select
                  value={manualForm.questionType}
                  onChange={(e) => setManualForm({ ...manualForm, questionType: e.target.value as QuestionCategory })}
                  className="w-full h-8 text-xs rounded-xl border border-border bg-background px-2 text-foreground focus:outline-none"
                >
                  <option value="theory">Theory</option>
                  <option value="numerical">Numerical</option>
                  <option value="diagram">Diagram / Circuit</option>
                  <option value="short">Short Answer</option>
                  <option value="long">Long Answer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase text-muted-foreground block mb-1">Topic / Unit</label>
              <Input
                value={manualForm.topic}
                onChange={(e) => setManualForm({ ...manualForm, topic: e.target.value })}
                placeholder="e.g. Memory Management & Paging"
                className="h-8 text-xs rounded-xl border-border bg-background"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-muted-foreground block mb-1">Question Content</label>
              <Textarea
                rows={4}
                value={manualForm.questionText}
                onChange={(e) => setManualForm({ ...manualForm, questionText: e.target.value })}
                placeholder="Type or paste question statement..."
                className="text-xs rounded-xl border-border bg-background leading-relaxed"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setManualAddOpen(false)}
              className="h-8 text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveManual}
              className="h-8 text-xs rounded-xl bg-primary text-primary-foreground font-medium px-4 shadow-sm shadow-primary/20 hover:bg-primary/90"
            >
              Save Question
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

