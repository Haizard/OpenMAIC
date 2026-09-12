'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Mic,
  PartyPopper,
} from 'lucide-react';

interface Recording {
  id: string;
  mime: string;
  byteLength: number;
  kind: 'audio' | 'video';
}

interface HolidayPackageItem {
  id: string;
  title: string;
  subjectName: string | null;
  topicName: string | null;
  status: 'pending' | 'submitted' | 'late';
  dueAt: string | null;
  requiresRecording: boolean;
  recording: Recording | null;
}

interface HolidayPackage {
  id: string;
  slug: string;
  title: string;
  description: string;
  startsOn: string;
  endsOn: string;
  items: HolidayPackageItem[];
  outstanding: number;
  recordingsRequired: number;
  recordingsDone: number;
  missingItemIds: string[];
  complete: boolean;
}

interface ChildPackages {
  studentId: string;
  studentName: string;
  packages: HolidayPackage[];
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The parent mentor view of holiday work.
 *
 * This is a nudge surface, not a marking surface: it shows what is still outstanding and which
 * answers were meant to be recorded but have no take yet. The parent does not grade anything.
 */
export default function ParentHolidayPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildPackages[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/academic/children/holiday-packages');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.success) setChildren(data.children);
    } catch {
      console.error('Failed to fetch children holiday packages');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

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
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <PartyPopper className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Holiday packages</h1>
              <p className="text-sm text-muted-foreground">What is still outstanding</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/parent')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {!children || children.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Nothing outstanding over the break
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Finished packages disappear from here. If a break is close and you see nothing, the
              package has not opened yet.
            </p>
          </div>
        ) : (
          children.map((child) =>
            child.packages.map((pkg) => (
              <section
                key={`${child.studentId}-${pkg.id}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-border/60 overflow-hidden"
              >
                <div className="p-5 border-b border-border/60">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-base font-semibold text-foreground">
                        {child.studentName} · {pkg.title}
                      </h2>
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="w-3.5 h-3.5" />
                        {formatDate(pkg.startsOn)} – {formatDate(pkg.endsOn)}
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
                      {pkg.items.length - pkg.outstanding} of {pkg.items.length} done
                    </span>
                  </div>

                  {pkg.missingItemIds.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                      <Mic className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        {pkg.recordingsRequired - pkg.recordingsDone} answer
                        {pkg.recordingsRequired - pkg.recordingsDone === 1 ? '' : 's'} still need to
                        be recorded. A nudge to sit down and record them is usually all it takes.
                      </span>
                    </div>
                  )}
                </div>

                <div className="divide-y divide-border/60">
                  {pkg.items.map((item) => (
                    <div key={item.id} className="p-5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{item.title}</span>
                          {item.requiresRecording && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                              Answer out loud
                            </span>
                          )}
                        </div>
                        {item.subjectName && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.subjectName}
                            {item.topicName ? ` · ${item.topicName}` : ''}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          Due {formatDate(item.dueAt)}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {item.recording ? (
                          <audio
                            src={`/api/academic/recordings/${item.recording.id}`}
                            controls
                            className="w-56"
                          />
                        ) : item.requiresRecording ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 whitespace-nowrap">
                            Recording missing
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Not started
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )),
          )
        )}
      </main>
    </div>
  );
}
