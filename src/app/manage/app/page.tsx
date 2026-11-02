import { InstallStatsPage } from '@/components/manage/TimetableAdmin';
import { pageUser } from '@/lib/server/guard';

export default async function Page() {
  await pageUser('admin');
  return <InstallStatsPage />;
}
