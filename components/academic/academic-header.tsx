'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GraduationCap, Users, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AcademicHeader() {
  const pathname = usePathname();

  // Don't show on academic hub pages (they have their own headers)
  if (
    pathname.startsWith('/learn') ||
    pathname.startsWith('/parent') ||
    pathname.startsWith('/school') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')
  ) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
      <Link href="/learn">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-2 text-xs',
            pathname === '/learn' && 'bg-primary/10 text-primary',
          )}
        >
          <GraduationCap className="w-4 h-4" />
          Learn
        </Button>
      </Link>
      <Link href="/school">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-2 text-xs',
            pathname === '/school' && 'bg-primary/10 text-primary',
          )}
        >
          <Building2 className="w-4 h-4" />
          Debate
        </Button>
      </Link>
    </div>
  );
}
