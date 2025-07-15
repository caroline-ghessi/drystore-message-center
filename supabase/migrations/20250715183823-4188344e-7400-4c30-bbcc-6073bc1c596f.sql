-- Criar bucket para armazenar mídias do WhatsApp
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media', 
  'whatsapp-media', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/*', 'audio/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

-- Política para permitir leitura pública
CREATE POLICY "Public read access for whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Política para permitir upload por usuários autenticados
CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.uid() IS NOT NULL);

-- Política para permitir update por usuários autenticados
CREATE POLICY "Authenticated users can update whatsapp media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'whatsapp-media' AND auth.uid() IS NOT NULL);

-- Política para permitir delete por usuários autenticados
CREATE POLICY "Authenticated users can delete whatsapp media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media' AND auth.uid() IS NOT NULL);