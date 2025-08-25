import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mediaId, conversationId, messageType } = await req.json();
    
    console.log(`Processando mídia: ${mediaId} para conversa: ${conversationId}`);
    
    // 1. Obter URL da mídia do WhatsApp
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v17.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${metaAccessToken}`
        }
      }
    );
    
    if (!mediaResponse.ok) {
      throw new Error(`Erro ao obter URL da mídia: ${mediaResponse.statusText}`);
    }
    
    const mediaData = await mediaResponse.json();
    console.log('Dados da mídia:', mediaData);
    
    // 2. Baixar o arquivo
    const fileResponse = await fetch(mediaData.url, {
      headers: {
        'Authorization': `Bearer ${metaAccessToken}`
      }
    });
    
    if (!fileResponse.ok) {
      throw new Error(`Erro ao baixar arquivo: ${fileResponse.statusText}`);
    }
    
    const blob = await fileResponse.blob();
    
    // 3. Detectar extensão baseada no MIME type
    const mimeType = fileResponse.headers.get('content-type') || 'application/octet-stream';
    const extension = getExtensionFromMimeType(mimeType);
    const fileName = `${conversationId}/${Date.now()}-${mediaId}.${extension}`;
    
    console.log(`Fazendo upload do arquivo: ${fileName}, tipo: ${mimeType}`);
    
    // 4. Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(fileName, blob, {
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      throw uploadError;
    }

    // 5. Gerar URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(fileName);

    console.log(`Arquivo salvo com sucesso: ${publicUrl}`);

    // 6. Registrar no log do sistema
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'whatsapp-media-processor',
      message: `Mídia processada com sucesso: ${mediaId}`,
      details: {
        media_id: mediaId,
        conversation_id: conversationId,
        file_name: fileName,
        mime_type: mimeType,
        public_url: publicUrl,
        file_size: blob.size
      }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      publicUrl,
      fileName,
      mimeType,
      fileSize: blob.size
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro ao processar mídia:', error);
    
    // Log de erro
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'whatsapp-media-processor',
      message: 'Erro ao processar mídia do WhatsApp',
      details: {
        error: error.message,
        stack: error.stack
      }
    });

    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/amr': 'amr',
    'audio/ogg': 'ogg',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/mpeg': 'mpeg',
    'video/webm': 'webm',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt'
  };
  
  return mimeMap[mimeType] || 'bin';
}