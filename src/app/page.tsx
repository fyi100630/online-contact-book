import { Board } from '@/components/board/Board';
import { getBoard, today } from '@/lib/server/repo';
import { getSessionUser } from '@/lib/server/session';
import { isValidDateStr } from '@/lib/shared/dates';
import type { BoardData } from '@/lib/shared/types';

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = typeof sp.d === 'string' && isValidDateStr(sp.d) ? sp.d : today();

  let board: BoardData | null = null;
  let signedIn = false;
  try {
    [board, signedIn] = await Promise.all([getBoard(d), getSessionUser().then((u) => !!u)]);
  } catch (err) {
    console.error('[home] failed to load board', err);
  }

  if (!board) {
    return (
      <main className="state">
        <p className="state-title">聯絡簿暫時無法載入</p>
        <p className="muted">請稍後再試一次。如果一直出現這個畫面，請通知幹部。</p>
      </main>
    );
  }
  return <Board initial={board} signedIn={signedIn} />;
}
