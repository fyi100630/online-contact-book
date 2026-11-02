import { ActivityPage } from '@/components/manage/AdminPages';
import { pageUser } from '@/lib/server/guard';

export default async function Page() {
  await pageUser('admin');
  return <ActivityPage />;
}
