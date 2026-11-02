import { UsersPage } from '@/components/manage/AdminPages';
import { pageUser } from '@/lib/server/guard';

export default async function Page() {
  const user = await pageUser('admin');
  return <UsersPage meId={user.id} />;
}
