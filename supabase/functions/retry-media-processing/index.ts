import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Find messages with failed media processing or WhatsApp media IDs that need processing
    const { data: failedMessages, error } = await supabase
      .from('messages')
      .select('id, conversation_id, message_type, media_url, metadata')
      .not('media_url', 'is', null)
      .or('metadata->processing_failed.eq.true,and(not.media_url.like.http%,not.message_type.eq.text)')
      .limit(10); // Process in batches

    if (error) {
      throw error;
    }

    console.log(`Found ${failedMessages?.length || 0} messages to retry`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const message of failedMessages || []) {
      try {
        // Skip if media_url is already a valid URL
        if (message.media_url?.startsWith('http')) continue;

        processedCount++;
        console.log(`Retrying media processing for message ${message.id}`);

        // Call the media processor
        const { data, error: processingError } = await supabase.functions.invoke('whatsapp-media-processor', {
          body: {
            mediaId: message.media_url,
            conversationId: message.conversation_id,
            messageType: message.message_type
          }
        });

        if (processingError || !data?.success) {
          throw new Error(processingError?.message || 'Media processing failed');
        }

        // Update message with processed media URL
        await supabase
          .from('messages')
          .update({
            media_url: data.publicUrl,
            metadata: {
              ...message.metadata,
              original_media_id: message.media_url,
              file_name: data.fileName,
              mime_type: data.mimeType,
              file_size: data.fileSize,
              processed_at: new Date().toISOString(),
              retry_processed: true,
              processing_failed: false
            }
          })
          .eq('id', message.id);

        successCount++;
        console.log(`Successfully processed media for message ${message.id}`);

      } catch (error) {
        failedCount++;
        console.error(`Failed to process media for message ${message.id}:`, error);

        // Update metadata to track retry failures
        const retryCount = (message.metadata?.retry_count || 0) + 1;
        await supabase
          .from('messages')
          .update({
            metadata: {
              ...message.metadata,
              processing_failed: true,
              retry_count: retryCount,
              last_retry_at: new Date().toISOString(),
              last_retry_error: error.message
            }
          })
          .eq('id', message.id);
      }
    }

    // Log the retry operation
    await supabase.from('system_logs').insert({
      type: 'info',
      source: 'retry-media-processing',
      message: `Media retry operation completed`,
      details: {
        processed_count: processedCount,
        success_count: successCount,
        failed_count: failedCount,
        total_found: failedMessages?.length || 0
      }
    });

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      successful: successCount,
      failed: failedCount,
      total_found: failedMessages?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in retry-media-processing:', error);
    
    await supabase.from('system_logs').insert({
      type: 'error',
      source: 'retry-media-processing',
      message: 'Error during media retry operation',
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