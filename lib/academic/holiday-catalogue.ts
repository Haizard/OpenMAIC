/**
 * The holiday package catalogue — Slice 4.
 *
 * Packages are platform-authored (see the spec, Decision 3): v1 has no teacher role, and the
 * parent is a mentor rather than the person who designs work.
 *
 * A student's holiday work is drawn from their own curriculum form, so the catalogue names a
 * *slice* of that form's topic list rather than a fixed set of topics. Slices are disjoint,
 * which is what keeps two packages from claiming the same (student, topic) pair — Slice 3's
 * homework unique index forbids it.
 */

export interface HolidayPackageDefinition {
  /** Stable identity. Also the uniqueness key per student. */
  slug: string;
  title: string;
  description: string;
  /** Inclusive window start as [month 1-12, day of month]. */
  startsOn: readonly [number, number];
  /** Inclusive window end as [month 1-12, day of month]. */
  endsOn: readonly [number, number];
  /** Index into the student's ordered topic list where this package's slice begins. */
  topicOffset: number;
  /** How many topics the slice covers. */
  topicCount: number;
  /** How many items at the front of the slice must be answered with a recording. */
  recordingCount: number;
}

/**
 * Tanzania school calendar: three breaks. December runs across the year boundary, which is
 * why the window is stored as month/day rather than a single year.
 */
export const HOLIDAY_PACKAGES: readonly HolidayPackageDefinition[] = [
  {
    slug: 'june-break',
    title: 'June break package',
    description: 'A short set of revision items to keep the term fresh over the June break.',
    startsOn: [6, 1],
    endsOn: [6, 30],
    topicOffset: 0,
    topicCount: 3,
    recordingCount: 1,
  },
  {
    slug: 'august-break',
    title: 'August break package',
    description: 'Mid-year practice, including one item you answer out loud.',
    startsOn: [8, 1],
    endsOn: [8, 31],
    topicOffset: 3,
    topicCount: 3,
    recordingCount: 1,
  },
  {
    slug: 'december-break',
    title: 'December break package',
    description: 'The long-break package. Two items are answered by recording yourself.',
    startsOn: [12, 1],
    endsOn: [1, 5],
    topicOffset: 6,
    topicCount: 3,
    recordingCount: 2,
  },
];

/** How early, before its start date, a package becomes visible to the student. */
export const PACKAGE_LEAD_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Resolve a package's window for a given start year.
 *
 * December's window crosses into January, so the end year is the start year plus one when the
 * end month is earlier than the start month.
 */
export function resolveWindow(
  definition: HolidayPackageDefinition,
  year: number,
): { startsOn: string; endsOn: string } {
  const [startMonth, startDay] = definition.startsOn;
  const [endMonth, endDay] = definition.endsOn;
  const endYear = endMonth < startMonth ? year + 1 : year;

  return {
    startsOn: `${year}-${pad(startMonth)}-${pad(startDay)}`,
    endsOn: `${endYear}-${pad(endMonth)}-${pad(endDay)}`,
  };
}

/**
 * Whether `now` is inside the window or within the lead-up to it.
 *
 * Both this year's and last year's window are tested. A window that crosses the year boundary
 * is still open in January, and last year's instance is the one January falls inside — testing
 * only the current year would close the December package the moment the calendar turned.
 */
export function isWindowOpen(
  definition: HolidayPackageDefinition,
  now: Date = new Date(),
): boolean {
  const time = now.getTime();
  const year = now.getUTCFullYear();

  for (const candidate of [year - 1, year]) {
    const { startsOn, endsOn } = resolveWindow(definition, candidate);
    const start = Date.parse(`${startsOn}T00:00:00Z`);
    // The end date is inclusive, so the window closes at the end of that UTC day.
    const end = Date.parse(`${endsOn}T23:59:59Z`);
    if (time >= start - PACKAGE_LEAD_DAYS * DAY_MS && time <= end) return true;
  }

  return false;
}

/**
 * The window a package should be materialised with, for the instance `now` falls inside.
 *
 * Returns `null` when the package is not currently open.
 */
export function activeWindow(
  definition: HolidayPackageDefinition,
  now: Date = new Date(),
): { startsOn: string; endsOn: string } | null {
  const time = now.getTime();
  const year = now.getUTCFullYear();

  for (const candidate of [year - 1, year]) {
    const window = resolveWindow(definition, candidate);
    const start = Date.parse(`${window.startsOn}T00:00:00Z`);
    const end = Date.parse(`${window.endsOn}T23:59:59Z`);
    if (time >= start - PACKAGE_LEAD_DAYS * DAY_MS && time <= end) return window;
  }

  return null;
}
