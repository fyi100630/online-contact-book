import { LoginActivityPage } from '@/components/manage/LoginActivity';
import { pageUser } from '@/lib/server/guard';

export default async function Page() {
  await pageUser('admin');
  return <LoginActivityPage />;
}
