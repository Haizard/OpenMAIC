'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Streamdown } from 'streamdown';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Clock, Loader2 } from 'lucide-react';

type ReadingKind = 'lesson_note' | 'explainer' | 'reference' | 'past_paper' | 'glossary';
type ReadingStatus = 'unread' | 'reading' | 'read';

interface Reading {
  id: string;
  title: string;
  summary: string;
  body: string;
  kind: ReadingKind;
  readingMinutes: number;
  topicName: string;
  subjectName: string;
  formName: string;
  status: ReadingStatus;
}

const KIND_LABELS: Record<ReadingKind, string> = {
  lesson_note: 'Lesson note',
  explainer: 'Explainer',
  reference: 'Reference',
  past_paper: 'Past paper',
  glossary: 'Glossary',
};

export default function ReadingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const readingId = params?.id;

  const [reading, setReading] = useState<Reading | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchReading = useCallback(async () => {
    if (!readingId) return;
    try {
      const response = await fetch(`/api/academic/readings/${readingId}`);
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setReading(data.reading);
      }
    } catch {
      console.error('Failed to fetch reading');
    } finally {
      setLoading(false);
    }
  }, [readingId, router]);

  useEffect(() => {
    fetchReading();
  }, [fetchReading]);

  const markAsRead = async () => {
    if (!readingId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/academic/readings/${readingId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'read' }),
      });
      const data = await response.json();
      if (data.success && reading) {
        setReading({ ...reading, status: 'read' });
      }
    } catch {
      console.error('Failed to update reading progress');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !reading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">This reading is not available.</p>
        <Button variant="outline" onClick={() => router.push('/learn/read')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to library
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/learn/read')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Library
          </Button>
          {reading.status === 'read' ? (
            <span className="inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Read
            </span>
          ) : (
            <Button size="sm" onClick={markAsRead} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Mark as read
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <article className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-border/60">
          <div className="mb-6">
            <div className="text-sm text-muted-foreground mb-2">
              {reading.formName} · {reading.subjectName} · {reading.topicName}
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{reading.title}</h1>
            {reading.summary && (
              <p className="text-muted-foreground mb-3">{reading.summary}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                {KIND_LABELS[reading.kind]}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {reading.readingMinutes} min read
              </span>
            </div>
          </div>

          <div className="border-t border-border/60 pt-6">
            <Streamdown className="prose prose-slate dark:prose-invert max-w-none prose-headings:mt-6 prose-headings:mb-2 prose-table:text-sm">
              {reading.body}
            </Streamdown>
          </div>
        </article>

        {reading.status !== 'read' && (
          <div className="mt-6 flex justify-center">
            <Button onClick={markAsRead} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Mark as read
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
