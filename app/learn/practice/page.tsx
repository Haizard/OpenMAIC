'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Dumbbell,
  Loader2,
  XCircle,
} from 'lucide-react';

type MasteryLabel = 'unknown' | 'weak' | 'developing' | 'strong';

interface PracticeTopic {
  topicId: string;
  topicName: string;
  subjectName: string;
  attempts: number;
  correct: number;
  accuracy: number;
  label: MasteryLabel;
  itemCount: number;
  hasItems?: boolean;
}

interface PracticeItem {
  id: string;
  topicId: string;
  prompt: string;
  choices: string[];
  sortOrder: number;
}

const LABEL_TONE: Record<MasteryLabel, string> = {
  unknown: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  weak: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  developing: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  strong: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

const LABEL_TEXT: Record<MasteryLabel, string> = {
  unknown: 'Not tried yet',
  weak: 'Needs work',
  developing: 'Getting there',
  strong: 'Strong',
};

export default function PracticePage() {
  const router = useRouter();
  const [topics, setTopics] = useState<PracticeTopic[] | null>(null);
  const [activeTopic, setActiveTopic] = useState<PracticeTopic | null>(null);
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingTopic, setStartingTopic] = useState(false);
  const [score, setScore] = useState({ correct: 0, answered: 0 });

  const loadTopics = useCallback(async () => {
    try {
      const response = await fetch('/api/academic/practice/topics');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.success) setTopics(data.topics);
    } catch {
      console.error('Failed to fetch practice topics');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  // The plan deep-links here with ?topic=<id>, so open that drill directly. Read from
  // location rather than useSearchParams to keep this page statically renderable.
  useEffect(() => {
    if (!topics) return;
    const topicId = new URLSearchParams(window.location.search).get('topic');
    if (!topicId) return;
    const match = topics.find((topic) => topic.topicId === topicId);
    if (match) void startDrill(match);
  }, [topics]);

  const startDrill = async (topic: PracticeTopic) => {
    setStartingTopic(true);
    setResult(null);
    setChosen(null);
    setIndex(0);
    setScore({ correct: 0, answered: 0 });
    try {
      const response = await fetch(
        `/api/academic/practice/items?topicId=${encodeURIComponent(topic.topicId)}`,
      );
      const data = await response.json();
      if (data.success) {
        setItems(data.items);
        setActiveTopic(topic);
      }
    } catch {
      console.error('Failed to fetch drill');
    } finally {
      setStartingTopic(false);
    }
  };

  const answer = async (choiceIndex: number) => {
    const item = items[index];
    if (!item || result) return;

    setChosen(choiceIndex);
    try {
      const response = await fetch(`/api/academic/practice/items/${item.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choiceIndex }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult({ correct: data.correct, explanation: data.explanation });
        setScore((prev) => ({
          correct: prev.correct + (data.correct ? 1 : 0),
          answered: prev.answered + 1,
        }));
      }
    } catch {
      console.error('Failed to record answer');
    }
  };

  const nextQuestion = () => {
    setResult(null);
    setChosen(null);
    setIndex((value) => value + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {activeTopic ? activeTopic.topicName : 'Practice'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {activeTopic
                  ? `${score.correct} of ${score.answered} right so far`
                  : 'Short drills, marked instantly'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTopic) {
                setActiveTopic(null);
                setItems([]);
                void loadTopics();
              } else {
                router.push('/learn');
              }
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {activeTopic ? 'Topics' : 'Back'}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {!activeTopic ? (
          <>
            {!topics || topics.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  No drills for your class yet
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  The practice bank does not cover your class yet. It is being written topic by
                  topic — keep going with your homework and reading in the meantime.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {topics.map((topic) => (
                  <button
                    key={topic.topicId}
                    type="button"
                    onClick={() => startDrill(topic)}
                    disabled={startingTopic}
                    className="w-full text-left bg-white dark:bg-slate-900 rounded-xl p-4 border border-border/60 hover:border-border transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">{topic.topicName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {topic.subjectName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {topic.attempts === 0
                            ? `${topic.itemCount} questions`
                            : `${topic.correct}/${topic.attempts} right recently`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${LABEL_TONE[topic.label]}`}
                        >
                          {LABEL_TEXT[topic.label]}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : index >= items.length ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Drill finished</h2>
            <p className="text-muted-foreground">
              {score.correct} of {score.answered} correct.
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <Button onClick={() => startDrill(activeTopic)}>Drill again</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setActiveTopic(null);
                  void loadTopics();
                }}
              >
                Another topic
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-border/60">
            <div className="text-xs text-muted-foreground mb-3">
              Question {index + 1} of {items.length}
            </div>
            <h2 className="text-base font-medium text-foreground mb-4">{items[index].prompt}</h2>

            <div className="space-y-2">
              {items[index].choices.map((choice, choiceIndex) => {
                const isChosen = chosen === choiceIndex;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => answer(choiceIndex)}
                    disabled={result !== null}
                    className={`w-full text-left rounded-xl p-3 border transition-colors ${
                      result === null
                        ? 'border-border/60 hover:border-border'
                        : isChosen && result.correct
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                          : isChosen
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                            : 'border-border/60'
                    }`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>

            {result && (
              <div
                className={`mt-4 rounded-xl p-4 flex items-start gap-2 ${
                  result.correct
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200'
                }`}
              >
                {result.correct ? (
                  <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 mt-0.5 shrink-0" />
                )}
                <div className="text-sm">
                  <div className="font-medium">{result.correct ? 'Correct' : 'Not quite'}</div>
                  <div className="mt-0.5">{result.explanation}</div>
                </div>
              </div>
            )}

            {result && (
              <div className="mt-4 flex justify-end">
                <Button onClick={nextQuestion}>
                  {index + 1 >= items.length ? 'Finish' : 'Next'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
