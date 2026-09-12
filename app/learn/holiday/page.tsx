'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Recorder } from '@/components/academic/recorder';
import {
  AlertTriangle,
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
  description: string;
  topicId: string | null;
  topicName: string | null;
  subjectName: string | null;
  status: 'pending' | 'submitted' | 'late';
  dueAt: string | null;
  submittedAt: string | null;
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

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function HolidayPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<HolidayPackage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<'no_form' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/academic/holiday-packages');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.success) {
        setPackages(data.packages);
        setReason(data.reason ?? null);
      }
    } catch {
      console.error('Failed to fetch holiday packages');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (itemId: string, blob: Blob) => {
    const response = await fetch(`/api/academic/assignments/${itemId}/recording`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body: blob,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? 'Upload failed');
  };

  const submit = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/academic/assignments/${id}/submit`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? 'Could not submit');
        return;
      }
      await load();
    } catch {
      setError('Could not submit');
    } finally {
      setBusyId(null);
    }
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
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <PartyPopper className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Holiday package</h1>
              <p className="text-sm text-muted-foreground">Work for the break</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/learn')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {reason === 'no_form' ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              We do not know your class yet
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Holiday work comes from your syllabus, so we need to know which class you are in.
              Ask your parent to set your form or grade on your account.
            </p>
          </div>
        ) : !packages || packages.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
            <CalendarClock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No package right now</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Holiday packages appear when a break is close. Keep up with your homework in the
              meantime.
            </p>
          </div>
        ) : (
          packages.map((pkg) => (
            <section
              key={pkg.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-border/60 overflow-hidden"
            >
              <div className="p-5 border-b border-border/60">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{pkg.title}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{pkg.description}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                      <CalendarClock className="w-3.5 h-3.5" />
                      {formatDate(pkg.startsOn)} – {formatDate(pkg.endsOn)}
                    </div>
                  </div>
                  {pkg.complete ? (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 whitespace-nowrap">
                      Complete
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
                      {pkg.items.length - pkg.outstanding} of {pkg.items.length} done
                    </span>
                  )}
                </div>

                {pkg.recordingsRequired > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    {pkg.recordingsDone} of {pkg.recordingsRequired} answered out loud
                  </div>
                )}
              </div>

              <div className="divide-y divide-border/60">
                {pkg.items.map((item) => {
                  const needsRecording = item.requiresRecording && !item.recording;
                  return (
                    <div key={item.id} className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
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

                        {item.status !== 'pending' ? (
                          <span
                            className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                              item.status === 'late'
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            }`}
                          >
                            {item.status === 'late' ? 'Submitted late' : 'Submitted'}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => submit(item.id)}
                            disabled={busyId === item.id || needsRecording}
                            title={
                              needsRecording ? 'Record your answer first' : undefined
                            }
                          >
                            {busyId === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Submit'
                            )}
                          </Button>
                        )}
                      </div>

                      {item.status === 'pending' && item.requiresRecording && (
                        <>
                          {item.recording ? (
                            <div className="space-y-2">
                              <audio
                                src={`/api/academic/recordings/${item.recording.id}`}
                                controls
                                className="w-full"
                              />
                              <Recorder
                                mode={item.recording.kind === 'video' ? 'video' : 'audio'}
                                hasRecording
                                onUpload={(blob) => upload(item.id, blob)}
                                onUploaded={load}
                              />
                            </div>
                          ) : (
                            <Recorder
                              mode="audio"
                              onUpload={(blob) => upload(item.id, blob)}
                              onUploaded={load}
                            />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {pkg.complete && (
                <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  All done. Enjoy the rest of the break.
                </div>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
