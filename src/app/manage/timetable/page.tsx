import { TimetablePage } from '@/components/manage/TimetableAdmin';
import { pageUser } from '@/lib/server/guard';
import { getTimetable } from '@/lib/server/repo';

export default async function Page() {
  await pageUser('admin');
  return <TimetablePage initial={await getTimetable()} />;
}
