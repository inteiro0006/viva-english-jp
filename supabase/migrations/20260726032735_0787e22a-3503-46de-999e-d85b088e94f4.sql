
-- 1) Profiles: communication preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS communication_preferences JSONB NOT NULL DEFAULT
    jsonb_build_object('product_updates', true, 'learning_reminders', true, 'marketing', false);

-- 2) Support category enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_category') THEN
    CREATE TYPE public.support_category AS ENUM ('payment','access','content','video','account','other');
  END IF;
END $$;

ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS category public.support_category NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS response TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- 3) Storage policies
-- Avatars: public bucket, users may only write inside a folder named after their user id.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_write" ON storage.objects;
CREATE POLICY "avatars_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Support attachments: private bucket, per-user prefix.
DROP POLICY IF EXISTS "support_owner_read" ON storage.objects;
CREATE POLICY "support_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "support_owner_write" ON storage.objects;
CREATE POLICY "support_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "support_owner_delete" ON storage.objects;
CREATE POLICY "support_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

-- 4) Seed FAQ
INSERT INTO public.faq_items (question_ja, question_en, answer_ja, answer_en, category, published, position)
VALUES
  ('支払いはどのように行いますか?', 'How do I pay for the course?',
   'Stripeによる安全な決済でクレジットカード払いに対応しています。決済完了後、すぐにコースにアクセスできます。',
   'Payment is handled securely via Stripe with credit card. You get instant access once the payment is confirmed.',
   'payment', true, 1),
  ('返金はできますか?', 'Is a refund possible?',
   '受講開始から14日以内で、視聴進捗が10%未満の場合は返金が可能です。サポートまでご連絡ください。',
   'Refunds are available within 14 days of purchase if you have watched less than 10% of the course. Contact support to request one.',
   'payment', true, 2),
  ('ログインできません', 'I cannot log in',
   'メールアドレスとパスワードをご確認ください。「パスワードをお忘れですか?」からリセットも可能です。',
   'Please double-check your email and password. You can also use "Forgot password" to reset it.',
   'access', true, 3),
  ('動画が再生されません', 'The video is not playing',
   'ネットワーク接続と、ブラウザが最新であることをご確認ください。数分後にもう一度お試しください。',
   'Please check your network connection and make sure your browser is up to date. Try again after a few minutes.',
   'video', true, 4),
  ('スマートフォンから受講できますか?', 'Can I take the course on my phone?',
   'はい、スマートフォンやタブレットから受講できます。学習進捗も自動で保存されます。',
   'Yes, the course works on phones and tablets, and your progress is saved automatically.',
   'content', true, 5),
  ('登録メールアドレスを変更したい', 'How do I change my registered email?',
   'メールアドレスの変更にはご本人確認が必要です。サポートまでご連絡ください。',
   'Changing your email requires identity verification. Please contact support to proceed.',
   'account', true, 6),
  ('コースの有効期限はありますか?', 'Does my access to the course expire?',
   '通常のコースは無期限でアクセス可能です。特別なプランに期限がある場合は、購入時に明記します。',
   'The standard course does not expire. Any special plan with an expiry date is stated clearly at checkout.',
   'access', true, 7),
  ('修了証はもらえますか?', 'Do I get a completion certificate?',
   'すべてのレッスンを完了すると、修了証を発行できるようになります(近日公開)。',
   'A completion certificate will be available once you finish all lessons (coming soon).',
   'content', true, 8);
