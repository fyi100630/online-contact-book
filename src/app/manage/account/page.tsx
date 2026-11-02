import { AccountPage } from '@/components/manage/AccountPage';
import { pageUser } from '@/lib/server/guard';

export default async function Page() {
  const user = await pageUser();
  return <AccountPage user={user} />;
}
