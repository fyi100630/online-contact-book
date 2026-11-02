import { EntriesPage } from '@/components/manage/EntriesPage';
import { pageUser } from '@/lib/server/guard';
import { today } from '@/lib/server/repo';

export default async function ManageHome() {
  await pageUser();
  return <EntriesPage today={today()} />;
}
