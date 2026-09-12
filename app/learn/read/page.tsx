'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Loader2,
  BookMarked,
} from 'lucide-react';

type ReadingKind = 'lesson_note' | 'explainer' | 'reference' | 'past_paper' | 'glossary';
type ReadingStatus = 'unread' | 'reading' | 'read';

interface ReadingListItem {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  kind: ReadingKind;
  readingMinutes: number;
  topicName: string;
  subjectName: string;
  formName: string;
  status: ReadingStatus;
}

interface ReadingSummary {
  unread: number;
  reading: number;
  read: number;
  total: number;
}

const KIND_LABELS: Record<ReadingKind, string> = {
  lesson_note: 'Lesson note',
  explainer: 'Explainer',
  reference: 'Reference',
  past_paper: 'Past paper',
  glossary: 'Glossary',
};

const KIND_STYLES: Record<ReadingKind, string> = {
  lesson_note: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  explainer: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  reference: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  past_paper: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  glossary: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
};

export default function ReadingLibraryPage() {
  const router = useRouter();
  const [readings, setReadings] = useState<ReadingListItem[]>([]);
  const [summary, setSummary] = useState<ReadingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlyUnread, setOnlyUnread] = useState(false);

  const fetchReadings = useCallback(async () => {
    try {
      const response = await fetch('/api/academic/readings');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.success) {
        setReadings(data.readings);
        setSummary(data.summary);
      }
    } catch {
      console.error('Failed to fetch readings');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const visible = useMemo(
    () => (onlyUnread ? readings.filter((r) => r.status !== 'read') : readings),
    [readings, onlyUnread],
  );

  // Group by subject, then by topic, so the library reads like a course outline.
  const grouped = useMemo(() => {
    const bySubject = new Map<string, Map<string, ReadingListItem[]>>();
    for (const reading of visible) {
      const topics = bySubject.get(reading.subjectName) ?? new Map();
      const items = topics.get(reading.topicName) ?? [];
      items.push(reading);
      topics.set(reading.topicName, items);
      bySubject.set(reading.subjectName, topics);
    }
    return bySubject;
  }, [visible]);

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
              <BookMarked className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Read</h1>
              <p className="text-sm text-muted-foreground">Lesson notes and reading material</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/learn')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {summary && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-border/60">
              <div className="text-2xl font-bold text-foreground">{summary.read}</div>
              <div className="text-sm text-muted-foreground">Read</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-border/60">
              <div className="text-2xl font-bold text-foreground">{summary.reading}</div>
              <div className="text-sm text-muted-foreground">In progress</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-border/60">
              <div className="text-2xl font-bold text-foreground">{summary.unread}</div>
              <div className="text-sm text-muted-foreground">Not started</div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            {visible.length} {visible.length === 1 ? 'item' : 'items'}
          </h2>
          <Button
            variant={onlyUnread ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyUnread((value) => !value)}
          >
            {onlyUnread ? 'Showing unfinished' : 'Show unfinished only'}
          </Button>
        </div>

        {visible.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {readings.length === 0
                ? 'No reading material for your level yet.'
                : 'Nothing left to read. Well done.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {[...grouped.entries()].map(([subjectName, topics]) => (
              <section key={subjectName}>
                <h3 className="text-base font-semibold text-foreground mb-3">{subjectName}</h3>
                <div className="space-y-5">
                  {[...topics.entries()].map(([topicName, items]) => (
                    <div key={topicName}>
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        {topicName}
                      </div>
                      <div className="space-y-2">
                        {items.map((reading) => (
                          <button
                            key={reading.id}
                            type="button"
                            onClick={() => router.push(`/learn/read/${reading.id}`)}
                            className="w-full text-left bg-white dark:bg-slate-900 rounded-xl p-4 border border-border/60 hover:border-blue-400/60 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {reading.status === 'read' ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                  <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-foreground">
                                    {reading.title}
                                  </span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${KIND_STYLES[reading.kind]}`}
                                  >
                                    {KIND_LABELS[reading.kind]}
                                  </span>
                                  {reading.status === 'reading' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                      In progress
                                    </span>
                                  )}
                                </div>
                                {reading.summary && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {reading.summary}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {reading.readingMinutes} min
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5" />
                                    {reading.formName}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
