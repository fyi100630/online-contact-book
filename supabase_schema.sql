-- ========================================================
-- 線上班級聯絡簿 (Online Contact Book) - Supabase 初始化腳本
-- 說明：請登入 Supabase 控制台 (supabase.com)，進入專案後的「SQL Editor」貼上並點擊「Run」執行此腳本。
-- ========================================================

-- 1. 建立聯絡簿主要資料表
CREATE TABLE IF NOT EXISTS public.contact_book (
    id TEXT PRIMARY KEY DEFAULT 'default',
    class_title TEXT NOT NULL DEFAULT '411班級聯絡簿',
    announcement TEXT NOT NULL DEFAULT '歡迎使用線上班級聯絡簿！',
    records JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 啟用資料列層級安全機制 (Row Level Security, RLS)
ALTER TABLE public.contact_book ENABLE ROW LEVEL SECURITY;

-- 3. 建立存取策略 (RLS Policies)
-- 策略 A：允許所有人（大眾/家長/學生）公開讀取聯絡簿
DROP POLICY IF EXISTS "Allow public read access" ON public.contact_book;
CREATE POLICY "Allow public read access" 
ON public.contact_book 
FOR SELECT 
USING (true);

-- 策略 B：允許更新聯絡簿資料（配合前端密碼驗證）
DROP POLICY IF EXISTS "Allow public update access" ON public.contact_book;
CREATE POLICY "Allow public update access" 
ON public.contact_book 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 策略 C：允許初次寫入
DROP POLICY IF EXISTS "Allow public insert access" ON public.contact_book;
CREATE POLICY "Allow public insert access" 
ON public.contact_book 
FOR INSERT 
WITH CHECK (true);

-- 4. 寫入初始資料（若無紀錄才新增）
INSERT INTO public.contact_book (id, class_title, announcement, records)
VALUES (
    'default',
    '411班級聯絡簿',
    '內測進行中',
    '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 5. 啟用 Supabase Realtime 即時推播監聽
-- 讓多台裝置在某台更新時，其他人瀏覽器不用重新整理即可自動同步！
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'contact_book'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_book;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- 如果 publication 尚未存在，則建立
    CREATE PUBLICATION supabase_realtime FOR TABLE public.contact_book;
END $$;

-- 6. 建立 72 小時歷史版本紀錄表 (contact_book_logs)
CREATE TABLE IF NOT EXISTS public.contact_book_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    class_title TEXT NOT NULL,
    announcement TEXT DEFAULT '',
    records JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary TEXT DEFAULT '',
    editor_role TEXT DEFAULT 'admin'
);

-- 建立時間排序索引
CREATE INDEX IF NOT EXISTS idx_contact_book_logs_created_at ON public.contact_book_logs (created_at DESC);

-- 啟用 RLS
ALTER TABLE public.contact_book_logs ENABLE ROW LEVEL SECURITY;

-- 存取策略
DROP POLICY IF EXISTS "Allow public read logs" ON public.contact_book_logs;
CREATE POLICY "Allow public read logs" ON public.contact_book_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert logs" ON public.contact_book_logs;
CREATE POLICY "Allow public insert logs" ON public.contact_book_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete logs" ON public.contact_book_logs;
CREATE POLICY "Allow public delete logs" ON public.contact_book_logs FOR DELETE USING (true);

-- 7. 建立逾期 72 小時自動清理觸發器 (Auto Prune Trigger)
-- 每次寫入新快照時，自動刪除 72 小時以前的歷史紀錄
CREATE OR REPLACE FUNCTION public.prune_expired_contact_book_logs()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.contact_book_logs
    WHERE created_at < (now() - INTERVAL '72 hours');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prune_contact_book_logs ON public.contact_book_logs;
CREATE TRIGGER trigger_prune_contact_book_logs
AFTER INSERT ON public.contact_book_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.prune_expired_contact_book_logs();

