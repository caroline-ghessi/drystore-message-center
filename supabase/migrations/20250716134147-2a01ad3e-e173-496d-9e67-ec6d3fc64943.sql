-- Add metadata column to conversations table to store dify_conversation_id
ALTER TABLE public.conversations 
ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;