CREATE TABLE IF NOT EXISTS public.contact_book (
    id TEXT PRIMARY KEY DEFAULT 'default',
    class_title TEXT NOT NULL DEFAULT '411班級聯絡簿',
    announcement TEXT NOT NULL DEFAULT '歡迎使用線上班級聯絡簿！',
    records JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.contact_book ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.contact_book;
CREATE POLICY "Allow public read access" 
ON public.contact_book 
FOR SELECT 
USING (true);
DROP POLICY IF EXISTS "Allow public update access" ON public.contact_book;
CREATE POLICY "Allow public update access" 
ON public.contact_book 
FOR UPDATE 
USING (true)
WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public insert access" ON public.contact_book;
CREATE POLICY "Allow public insert access" 
ON public.contact_book 
FOR INSERT 
WITH CHECK (true);
INSERT INTO public.contact_book (id, class_title, announcement, records)
VALUES (
    'default',
    '411班級聯絡簿',
    '內測進行中',
    '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
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
    CREATE PUBLICATION supabase_realtime FOR TABLE public.contact_book;
END $$;
CREATE TABLE IF NOT EXISTS public.contact_book_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    class_title TEXT NOT NULL,
    announcement TEXT DEFAULT '',
    records JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary TEXT DEFAULT '',
    editor_role TEXT DEFAULT 'admin'
);
CREATE INDEX IF NOT EXISTS idx_contact_book_logs_created_at ON public.contact_book_logs (created_at DESC);
ALTER TABLE public.contact_book_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read logs" ON public.contact_book_logs;
CREATE POLICY "Allow public read logs" ON public.contact_book_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert logs" ON public.contact_book_logs;
CREATE POLICY "Allow public insert logs" ON public.contact_book_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete logs" ON public.contact_book_logs;
CREATE POLICY "Allow public delete logs" ON public.contact_book_logs FOR DELETE USING (true);
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
NOTIFY pgrst, 'reload schema';