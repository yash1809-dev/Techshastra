import React, { useState, useEffect, useMemo } from "react";
import { getLocalTheoryQuestions, type TheoryQuestion } from "@/lib/services/theoryQuestionService";
import { Search, BookOpen, FileText, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface LivePaper {
  id: string;
  title: string;
  subject: string;
  questions: TheoryQuestion[];
  publishedAt: string;
  publishedBy: string;
}

export const QuestionBankPage: React.FC = () => {
  const [allQuestions, setAllQuestions] = useState<TheoryQuestion[]>([]);
  const [livePapers, setLivePapers] = useState<LivePaper[]>([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [marksFilter, setMarksFilter] = useState("All");
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);

  const loadData = () => {
    setAllQuestions(getLocalTheoryQuestions());
    try {
      const raw = localStorage.getItem("ts_live_papers");
      if (raw) setLivePapers(JSON.parse(raw));
      else setLivePapers([]);
    } catch {
      setLivePapers([]);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener("ts_theory_updated", loadData);
    return () => window.removeEventListener("ts_theory_updated", loadData);
  }, []);

  const subjects = useMemo(() => {
    const s = new Set(allQuestions.map((q) => q.subject));
    return ["All", ...Array.from(s).sort()];
  }, [allQuestions]);

  const marksOptions = useMemo(() => {
    const m = new Set(
      allQuestions
        .filter((q) => q.marks != null)
        .map((q) => String(q.marks))
    );
    return ["All", ...Array.from(m).sort((a, b) => Number(a) - Number(b))];
  }, [allQuestions]);

  const filtered = useMemo(() => {
    return allQuestions.filter((q) => {
      if (subjectFilter !== "All" && q.subject !== subjectFilter) return false;
      if (marksFilter !== "All") {
        if (marksFilter === "General" && q.marks != null) return false;
        if (marksFilter !== "General" && String(q.marks) !== marksFilter) return false;
      }
      if (
        search &&
        !q.questionText.toLowerCase().includes(search.toLowerCase()) &&
        !q.topic?.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [allQuestions, subjectFilter, marksFilter, search]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ── Live Papers Section ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Zap size={16} />
          </div>
          <h2 className="text-base font-heading font-semibold text-foreground">Live Papers</h2>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            {livePapers.length} published
          </Badge>
        </div>

        {livePapers.length === 0 ? (
          <Card className="border-border bg-card/60">
            <CardContent className="p-6 text-center space-y-2">
              <FileText className="mx-auto text-muted-foreground/50" size={32} />
              <p className="text-sm text-muted-foreground">No live papers published yet</p>
              <p className="text-xs text-muted-foreground/70">
                Check back during exam season — your faculty will publish practice papers here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {livePapers.map((paper) => (
              <Card key={paper.id} className="border-border bg-card/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-sm text-foreground">{paper.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] border-border capitalize">
                          {paper.subject}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {paper.questions.length} questions
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          · {new Date(paper.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExpandedPaperId(expandedPaperId === paper.id ? null : paper.id)
                      }
                      className="text-xs rounded-xl border-border h-7 gap-1 shrink-0"
                    >
                      {expandedPaperId === paper.id ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                      {expandedPaperId === paper.id ? "Hide" : "Open"}
                    </Button>
                  </div>

                  {expandedPaperId === paper.id && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      {paper.questions.map((q, idx) => (
                        <div
                          key={q.id + idx}
                          className="p-3 rounded-xl bg-background/60 border border-border space-y-2"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground">Q{idx + 1}.</span>
                            {q.marks != null && (
                              <Badge variant="outline" className="text-[10px] border-border">
                                {q.marks} marks
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] border-border capitalize">
                              {q.questionType}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{q.questionText}</p>
                          {q.diagramUrl && (
                            <img
                              src={q.diagramUrl}
                              alt={`Figure Q${idx + 1}`}
                              className="max-h-48 rounded border border-border object-contain bg-white"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Question Bank Browse Section ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <BookOpen size={16} />
          </div>
          <h2 className="text-base font-heading font-semibold text-foreground">Question Bank</h2>
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {allQuestions.length} questions
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs rounded-xl border-border bg-card"
            />
          </div>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="h-8 text-xs rounded-xl border border-border bg-card text-foreground px-2 pr-6 appearance-none cursor-pointer"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All Subjects" : s}
              </option>
            ))}
          </select>
          <select
            value={marksFilter}
            onChange={(e) => setMarksFilter(e.target.value)}
            className="h-8 text-xs rounded-xl border border-border bg-card text-foreground px-2 pr-6 appearance-none cursor-pointer"
          >
            <option value="All">All Marks</option>
            <option value="General">General (unranked)</option>
            {marksOptions
              .filter((m) => m !== "All")
              .map((m) => (
                <option key={m} value={m}>
                  {m} marks
                </option>
              ))}
          </select>
        </div>

        {/* Questions List */}
        {filtered.length === 0 ? (
          <Card className="border-border bg-card/60">
            <CardContent className="p-8 text-center">
              <BookOpen className="mx-auto text-muted-foreground/40 mb-3" size={32} />
              <p className="text-sm text-muted-foreground">No questions found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Try adjusting your filters or search term.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((q, idx) => (
              <Card
                key={q.id}
                className="border-border bg-card/60 hover:border-primary/30 transition-colors"
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground pt-0.5">
                      {idx + 1}.
                    </span>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">{q.questionText}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] border-border capitalize">
                          {q.subject}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-border capitalize">
                          {q.questionType}
                        </Badge>
                        {q.marks != null && (
                          <Badge variant="outline" className="text-[10px] border-border">
                            {q.marks} marks
                          </Badge>
                        )}
                        {q.topic && (
                          <span className="text-[10px] text-muted-foreground">{q.topic}</span>
                        )}
                      </div>
                      {q.diagramUrl && (
                        <img
                          src={q.diagramUrl}
                          alt="Figure"
                          className="max-h-32 rounded border border-border object-contain bg-white mt-1"
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionBankPage;
