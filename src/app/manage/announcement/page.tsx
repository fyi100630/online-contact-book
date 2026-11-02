import { AnnouncementPage } from '@/components/manage/AdminPages';
import { pageUser } from '@/lib/server/guard';
import { getSettings } from '@/lib/server/repo';

export default async function Page() {
  await pageUser('admin');
  return <AnnouncementPage initial={await getSettings()} />;
}
