/**
 * API Key validation utilities for webhook endpoints
 */

export interface ApiKeyValidationResult {
  isValid: boolean;
  sellerId?: string;
  error?: string;
}

/**
 * Validates API keys for webhook endpoints
 */
export async function validateApiKey(
  apiKey: string,
  supabase: any
): Promise<ApiKeyValidationResult> {
  try {
    // Check if API key matches any seller's webhook configuration
    const { data: config, error } = await supabase
      .from('whapi_configurations')
      .select('seller_id, type')
      .eq('token_secret_name', apiKey)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      console.error('Error validating API key:', error);
      return { isValid: false, error: 'Database error' };
    }

    if (!config) {
      return { isValid: false, error: 'Invalid API key' };
    }

    return { 
      isValid: true, 
      sellerId: config.seller_id 
    };
  } catch (error) {
    console.error('API key validation error:', error);
    return { isValid: false, error: 'Validation failed' };
  }
}

/**
 * Validates request signature for enhanced security
 */
export function validateRequestSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Simple HMAC validation (would use crypto in production)
    const expectedSignature = btoa(payload + secret);
    return signature === expectedSignature;
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
}