import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="state">
      <p className="state-title">找不到這個頁面</p>
      <Link href="/" className="btn btn-secondary">回到聯絡簿</Link>
    </main>
  );
}
