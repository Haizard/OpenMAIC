import { redirect } from 'next/navigation';

import { AcademicForbidden } from '@/components/academic/academic-forbidden';
import { getCurrentSession } from '@/lib/academic/auth';

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'parent') {
    return <AcademicForbidden />;
  }

  return <>{children}</>;
}
