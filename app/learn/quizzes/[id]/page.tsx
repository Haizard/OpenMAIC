'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Clock, ChevronLeft, ChevronRight, Send, CheckCircle2 } from 'lucide-react';

interface Question {
  id: string;
  questionType: 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay';
  questionText: string;
  options: string[] | null;
  points: number;
  sortOrder: number;
}

export default function TakeQuizPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [quizInfo, setQuizInfo] = useState<{ title: string; description: string; timeLimitMinutes: number | null } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; maxScore: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startQuiz = useCallback(async () => {
    try {
      const res = await fetch(`/api/academic/quizzes/${quizId}/start`, { method: 'POST' });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to start quiz');
        router.push('/learn/quizzes');
        return;
      }
      setSubmissionId(data.submissionId);
      setQuizInfo(data.quiz);
      setQuestions(data.questions);

      if (data.quiz.timeLimitMinutes) {
        setTimeLeft(data.quiz.timeLimitMinutes * 60);
      }
    } catch {
      console.error('Failed to start quiz');
      router.push('/learn/quizzes');
    } finally {
      setLoading(false);
    }
  }, [quizId, router]);

  useEffect(() => { startQuiz(); }, [startQuiz]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft !== null && !submitted]);

  const saveAnswer = async (questionId: string, answerText: string) => {
    if (!submissionId) return;
    try {
      await fetch(`/api/academic/quizzes/${quizId}/submissions/${submissionId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answerText }),
      });
    } catch { console.error('Failed to save answer'); }
  };

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    saveAnswer(questionId, value);
  };

  const handleSubmit = async () => {
    if (!submissionId || submitting || submitted) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const res = await fetch(`/api/academic/quizzes/${quizId}/submissions/${submissionId}/submit`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setResult({ score: data.score, maxScore: data.maxScore });
      }
    } catch { console.error('Failed to submit quiz'); }
    finally { setSubmitting(false); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading quiz...</div>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 w-full max-w-md border border-border/60 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Quiz Submitted!</h2>
          <p className="text-muted-foreground mb-6">{quizInfo?.title}</p>

          <div className="bg-muted/50 rounded-xl p-6 mb-6">
            <div className="text-4xl font-bold text-foreground mb-1">
              {result.score} / {result.maxScore}
            </div>
            <div className="text-sm text-muted-foreground">
              {Math.round((result.score / result.maxScore) * 100)}% correct
            </div>
          </div>

          <Button onClick={() => router.push('/learn/quizzes')} className="w-full">
            Back to Quizzes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-foreground">{quizInfo?.title}</h1>
            <p className="text-xs text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 text-sm font-mono ${timeLeft < 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                <Clock className="w-4 h-4" />
                {formatTime(timeLeft)}
              </div>
            )}
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Send className="w-4 h-4 mr-1" />
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-3xl mx-auto px-6 pt-4">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Area */}
      {currentQuestion && (
        <main className="max-w-3xl mx-auto p-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-border/60 p-8">
            {/* Question Header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                Q{currentIndex + 1}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {currentQuestion.questionType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
              <span className="text-xs text-muted-foreground">{currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}</span>
            </div>

            {/* Question Text */}
            <p className="text-lg text-foreground mb-6 whitespace-pre-wrap">{currentQuestion.questionText}</p>

            {/* Answer Input */}
            {currentQuestion.questionType === 'multiple_choice' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      answers[currentQuestion.id] === option
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${currentQuestion.id}`}
                      checked={answers[currentQuestion.id] === option}
                      onChange={() => handleAnswer(currentQuestion.id, option)}
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span className="text-sm text-foreground">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.questionType === 'true_false' && (
              <div className="flex gap-4">
                {['True', 'False'].map((v) => (
                  <label
                    key={v}
                    className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      answers[currentQuestion.id] === v.toLowerCase()
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${currentQuestion.id}`}
                      checked={answers[currentQuestion.id] === v.toLowerCase()}
                      onChange={() => handleAnswer(currentQuestion.id, v.toLowerCase())}
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium text-foreground">{v}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.questionType === 'fill_blank' && (
              <input
                type="text"
                value={answers[currentQuestion.id] ?? ''}
                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                placeholder="Type your answer..."
                className="w-full p-4 rounded-xl border-2 border-border/60 bg-transparent text-sm focus:border-primary focus:outline-none transition-colors"
              />
            )}

            {currentQuestion.questionType === 'essay' && (
              <textarea
                value={answers[currentQuestion.id] ?? ''}
                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                placeholder="Write your answer here..."
                className="w-full p-4 rounded-xl border-2 border-border/60 bg-transparent text-sm min-h-[200px] focus:border-primary focus:outline-none transition-colors resize-y"
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />Previous
            </Button>

            {/* Question dots */}
            <div className="flex gap-1.5">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                    i === currentIndex
                      ? 'bg-primary text-primary-foreground'
                      : answers[q.id]
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {currentIndex < questions.length - 1 ? (
              <Button onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}>
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Send className="w-4 h-4 mr-1" />Submit
              </Button>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
