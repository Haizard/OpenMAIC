'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Plus, Trash2, LogOut, User, FileQuestion } from 'lucide-react';

interface RosterEntry {
  id: string;
  student_name: string;
  grade: string;
}

export default function SchoolDashboard() {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addStudentLoading, setAddStudentLoading] = useState(false);
  const [addStudentError, setAddStudentError] = useState('');
  const [newStudent, setNewStudent] = useState({
    studentName: '',
    grade: '',
  });

  useEffect(() => {
    fetchRoster();
  }, []);

  const fetchRoster = async () => {
    try {
      const response = await fetch('/api/academic/roster');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.success) {
        setRoster(data.roster);
      }
    } catch {
      console.error('Failed to fetch roster');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStudentError('');
    setAddStudentLoading(true);

    try {
      const response = await fetch('/api/academic/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent),
      });

      const data = await response.json();

      if (!response.ok) {
        setAddStudentError(data.error || 'Failed to add student');
        return;
      }

      setShowAddStudent(false);
      setNewStudent({ studentName: '', grade: '' });
      await fetchRoster();
    } catch {
      setAddStudentError('An error occurred. Please try again.');
    } finally {
      setAddStudentLoading(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Are you sure you want to remove this student from the roster?')) {
      return;
    }

    try {
      const response = await fetch(`/api/academic/roster?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchRoster();
      }
    } catch {
      console.error('Failed to delete student');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/academic/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">School Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage your debate roster</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/school/quizzes')}>
              <FileQuestion className="w-4 h-4 mr-2" />
              Quizzes
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Debate Roster</h2>
          <Button onClick={() => setShowAddStudent(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Student
          </Button>
        </div>

        {roster.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-border/60">
            <User className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No students yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add students to your debate roster. These students don&apos;t need to create accounts.
            </p>
            <Button onClick={() => setShowAddStudent(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Student
            </Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Grade</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((student) => (
                  <tr key={student.id} className="border-b border-border/60 last:border-0">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{student.student_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted-foreground">{student.grade}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteStudent(student.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Student Modal */}
        {showAddStudent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-md border border-border/60">
              <h3 className="text-lg font-semibold text-foreground mb-4">Add Student to Roster</h3>
              
              <form onSubmit={handleAddStudent} className="space-y-4">
                {addStudentError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{addStudentError}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="studentName">Student Name</Label>
                  <Input
                    id="studentName"
                    value={newStudent.studentName}
                    onChange={(e) => setNewStudent((prev) => ({ ...prev, studentName: e.target.value }))}
                    placeholder="John Smith"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grade">Grade</Label>
                  <Input
                    id="grade"
                    value={newStudent.grade}
                    onChange={(e) => setNewStudent((prev) => ({ ...prev, grade: e.target.value }))}
                    placeholder="10th Grade"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddStudent(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={addStudentLoading}>
                    {addStudentLoading ? 'Adding...' : 'Add Student'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
