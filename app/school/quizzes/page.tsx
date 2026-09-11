'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus, Trash2, FileQuestion, Eye, EyeOff, ChevronDown, ChevronRight,
  ListOrdered, CheckCircle2, Clock, BarChart3
} from 'lucide-react';

type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay';

interface Quiz {
  id: string;
  title: string;
  description: string;
  timeLimitMinutes: number | null;
  isPublished: boolean;
  createdAt: string;
}

interface Question {
  id: string;
  questionType: QuestionType;
  questionText: string;
  options: string[] | null;
  correctAnswer: string | null;
  points: number;
  sortOrder: number;
}

interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
}

export default function SchoolQuizzesPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Record<string, Question[]>>({});
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({});
  const [showAddQuestion, setShowAddQuestion] = useState<string | null>(null);

  // Create quiz form
  const [newQuiz, setNewQuiz] = useState({ title: '', description: '', timeLimitMinutes: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Add question form
  const [newQuestion, setNewQuestion] = useState({
    questionType: 'multiple_choice' as QuestionType,
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    points: '1',
  });
  const [addQLoading, setAddQLoading] = useState(false);

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await fetch('/api/academic/quizzes');
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (data.success) setQuizzes(data.quizzes);
    } catch { console.error('Failed to fetch quizzes'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    try {
      const res = await fetch('/api/academic/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newQuiz.title,
          description: newQuiz.description,
          timeLimitMinutes: newQuiz.timeLimitMinutes ? parseInt(newQuiz.timeLimitMinutes) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || 'Failed to create quiz'); return; }
      setShowCreate(false);
      setNewQuiz({ title: '', description: '', timeLimitMinutes: '' });
      await fetchQuizzes();
    } catch { setCreateError('An error occurred'); }
    finally { setCreateLoading(false); }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm('Delete this quiz and all its questions?')) return;
    try {
      await fetch(`/api/academic/quizzes/${id}`, { method: 'DELETE' });
      await fetchQuizzes();
    } catch { console.error('Failed to delete quiz'); }
  };

  const handleTogglePublish = async (id: string, currentlyPublished: boolean) => {
    try {
      await fetch(`/api/academic/quizzes/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: currentlyPublished ? 'unpublish' : 'publish' }),
      });
      await fetchQuizzes();
    } catch { console.error('Failed to toggle publish'); }
  };

  const handleExpandQuiz = async (quizId: string) => {
    if (expandedQuiz === quizId) { setExpandedQuiz(null); return; }
    setExpandedQuiz(quizId);

    // Fetch questions
    try {
      const res = await fetch(`/api/academic/quizzes/${quizId}/questions`);
      const data = await res.json();
      if (data.success) setQuestions((prev) => ({ ...prev, [quizId]: data.questions }));
    } catch { console.error('Failed to fetch questions'); }

    // Fetch submissions
    try {
      const res = await fetch(`/api/academic/quizzes/${quizId}/submissions`);
      const data = await res.json();
      if (data.success) setSubmissions((prev) => ({ ...prev, [quizId]: data.submissions }));
    } catch { console.error('Failed to fetch submissions'); }
  };

  const handleAddQuestion = async (quizId: string) => {
    setAddQLoading(true);
    try {
      const body: Record<string, unknown> = {
        questionType: newQuestion.questionType,
        questionText: newQuestion.questionText,
        points: parseInt(newQuestion.points) || 1,
      };
      if (newQuestion.questionType === 'multiple_choice') {
        body.options = newQuestion.options.filter((o) => o.trim());
        body.correctAnswer = newQuestion.correctAnswer;
      } else if (newQuestion.questionType === 'true_false') {
        body.correctAnswer = newQuestion.correctAnswer;
      } else if (newQuestion.questionType === 'fill_blank') {
        body.correctAnswer = newQuestion.correctAnswer;
      }

      const res = await fetch(`/api/academic/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { console.error('Failed to add question'); return; }

      setShowAddQuestion(null);
      setNewQuestion({ questionType: 'multiple_choice', questionText: '', options: ['', '', '', ''], correctAnswer: '', points: '1' });

      // Refresh questions
      const qRes = await fetch(`/api/academic/quizzes/${quizId}/questions`);
      const qData = await qRes.json();
      if (qData.success) setQuestions((prev) => ({ ...prev, [quizId]: qData.questions }));
    } catch { console.error('Failed to add question'); }
    finally { setAddQLoading(false); }
  };

  const handleDeleteQuestion = async (quizId: string, questionId: string) => {
    try {
      await fetch(`/api/academic/quizzes/${quizId}/questions/${questionId}`, { method: 'DELETE' });
      const res = await fetch(`/api/academic/quizzes/${quizId}/questions`);
      const data = await res.json();
      if (data.success) setQuestions((prev) => ({ ...prev, [quizId]: data.questions }));
    } catch { console.error('Failed to delete question'); }
  };

  const typeLabels: Record<QuestionType, string> = {
    multiple_choice: 'Multiple Choice',
    true_false: 'True/False',
    fill_blank: 'Fill in the Blank',
    essay: 'Essay',
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Online Quizzes</h1>
            <p className="text-sm text-muted-foreground">Create and manage quizzes for students</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/school')}>Back to Dashboard</Button>
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />New Quiz</Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* Create Quiz Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-md border border-border/60">
              <h3 className="text-lg font-semibold text-foreground mb-4">Create New Quiz</h3>
              <form onSubmit={handleCreateQuiz} className="space-y-4">
                {createError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{createError}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={newQuiz.title} onChange={(e) => setNewQuiz((p) => ({ ...p, title: e.target.value }))} placeholder="Quiz title" required />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input value={newQuiz.description} onChange={(e) => setNewQuiz((p) => ({ ...p, description: e.target.value }))} placeholder="Brief description" />
                </div>
                <div className="space-y-2">
                  <Label>Time Limit (minutes, optional)</Label>
                  <Input type="number" value={newQuiz.timeLimitMinutes} onChange={(e) => setNewQuiz((p) => ({ ...p, timeLimitMinutes: e.target.value }))} placeholder="No time limit" min="1" />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={createLoading}>{createLoading ? 'Creating...' : 'Create Quiz'}</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Question Modal */}
        {showAddQuestion && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-lg border border-border/60 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-foreground mb-4">Add Question</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <select
                    value={newQuestion.questionType}
                    onChange={(e) => setNewQuestion((p) => ({ ...p, questionType: e.target.value as QuestionType }))}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="true_false">True / False</option>
                    <option value="fill_blank">Fill in the Blank</option>
                    <option value="essay">Essay</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Question Text</Label>
                  <textarea
                    value={newQuestion.questionText}
                    onChange={(e) => setNewQuestion((p) => ({ ...p, questionText: e.target.value }))}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px]"
                    placeholder="Enter your question..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Points</Label>
                  <Input type="number" value={newQuestion.points} onChange={(e) => setNewQuestion((p) => ({ ...p, points: e.target.value }))} min="1" className="w-24" />
                </div>

                {newQuestion.questionType === 'multiple_choice' && (
                  <div className="space-y-2">
                    <Label>Options (mark correct answer)</Label>
                    {newQuestion.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctOption"
                          checked={newQuestion.correctAnswer === opt && opt.trim() !== ''}
                          onChange={() => setNewQuestion((p) => ({ ...p, correctAnswer: opt }))}
                          disabled={!opt.trim()}
                        />
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const opts = [...newQuestion.options];
                            opts[i] = e.target.value;
                            setNewQuestion((p) => ({ ...p, options: opts }));
                          }}
                          placeholder={`Option ${i + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {newQuestion.questionType === 'true_false' && (
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <div className="flex gap-4">
                      {['true', 'false'].map((v) => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="tfAnswer"
                            checked={newQuestion.correctAnswer === v}
                            onChange={() => setNewQuestion((p) => ({ ...p, correctAnswer: v }))}
                          />
                          <span className="text-sm capitalize">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {newQuestion.questionType === 'fill_blank' && (
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <Input
                      value={newQuestion.correctAnswer}
                      onChange={(e) => setNewQuestion((p) => ({ ...p, correctAnswer: e.target.value }))}
                      placeholder="The correct answer"
                    />
                  </div>
                )}

                {newQuestion.questionType === 'essay' && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                    Essay questions require manual grading by the school after submission.
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddQuestion(null)}>Cancel</Button>
                  <Button className="flex-1" onClick={() => handleAddQuestion(showAddQuestion)} disabled={addQLoading || !newQuestion.questionText.trim()}>
                    {addQLoading ? 'Adding...' : 'Add Question'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quiz List */}
        {quizzes.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-border/60">
            <FileQuestion className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No quizzes yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first quiz to test student knowledge.</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />Create First Quiz</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="bg-white dark:bg-slate-900 rounded-xl border border-border/60 overflow-hidden">
                {/* Quiz Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => handleExpandQuiz(quiz.id)}
                >
                  <div className="flex items-center gap-3">
                    <FileQuestion className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium text-foreground">{quiz.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {quiz.description && <span>{quiz.description}</span>}
                        {quiz.timeLimitMinutes && <span><Clock className="w-3 h-3 inline mr-1" />{quiz.timeLimitMinutes}min</span>}
                        <span>{questions[quiz.id]?.length ?? 0} questions</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${quiz.isPublished ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                      {quiz.isPublished ? 'Published' : 'Draft'}
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleTogglePublish(quiz.id, quiz.isPublished); }}>
                      {quiz.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleDeleteQuiz(quiz.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    {expandedQuiz === quiz.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedQuiz === quiz.id && (
                  <div className="border-t border-border/60 p-4 space-y-4">
                    {/* Questions Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                          <ListOrdered className="w-4 h-4" />Questions
                        </h4>
                        <Button size="xs" onClick={() => setShowAddQuestion(quiz.id)}><Plus className="w-3 h-3 mr-1" />Add Question</Button>
                      </div>
                      {(questions[quiz.id] ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No questions yet. Add questions to build this quiz.</p>
                      ) : (
                        <div className="space-y-2">
                          {questions[quiz.id]?.map((q, i) => (
                            <div key={q.id} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-mono text-muted-foreground">Q{i + 1}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{typeLabels[q.questionType]}</span>
                                  <span className="text-xs text-muted-foreground">{q.points}pt</span>
                                </div>
                                <p className="text-sm text-foreground">{q.questionText}</p>
                                {q.options && (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {q.options.map((opt, j) => (
                                      <span key={j} className={`text-xs px-2 py-0.5 rounded-full ${opt === q.correctAnswer ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                                        {String.fromCharCode(65 + j)}. {opt}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {q.questionType === 'true_false' && q.correctAnswer && (
                                  <p className="text-xs text-muted-foreground mt-1">Answer: <span className="text-green-600">{q.correctAnswer}</span></p>
                                )}
                                {q.questionType === 'fill_blank' && q.correctAnswer && (
                                  <p className="text-xs text-muted-foreground mt-1">Answer: <span className="text-green-600">{q.correctAnswer}</span></p>
                                )}
                              </div>
                              <Button variant="ghost" size="icon-xs" onClick={() => handleDeleteQuestion(quiz.id, q.id)}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Submissions Section */}
                    <div>
                      <h4 className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4" />Submissions
                      </h4>
                      {(submissions[quiz.id] ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No submissions yet.</p>
                      ) : (
                        <div className="bg-muted/30 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/60">
                                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Student</th>
                                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Score</th>
                                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Submitted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {submissions[quiz.id]?.map((sub) => (
                                <tr key={sub.id} className="border-b border-border/60 last:border-0">
                                  <td className="px-4 py-2 font-medium text-foreground">{sub.studentName}</td>
                                  <td className="px-4 py-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      sub.status === 'graded' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                      sub.status === 'submitted' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                      {sub.status === 'graded' ? 'Graded' : sub.status === 'submitted' ? 'Needs Review' : 'In Progress'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-foreground">
                                    {sub.score !== null && sub.maxScore !== null ? `${sub.score}/${sub.maxScore}` : '—'}
                                  </td>
                                  <td className="px-4 py-2 text-muted-foreground text-xs">
                                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
