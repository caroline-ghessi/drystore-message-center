/**
 * Secure logging utilities with data masking
 */

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: any;
  userId?: string;
  timestamp?: string;
}

/**
 * Masks sensitive data in logs
 */
export function maskSensitiveData(data: any): any {
  if (!data) return data;

  const sensitiveFields = [
    'phone', 'phone_number', 'phoneNumber',
    'email', 'password', 'token', 'api_key',
    'credit_card', 'ssn', 'cpf'
  ];

  if (typeof data === 'string') {
    // Mask phone numbers
    if (/^\+?[\d\s-()]+$/.test(data) && data.length > 7) {
      return data.substring(0, 2) + '****' + data.substring(data.length - 2);
    }
    // Mask emails
    if (data.includes('@')) {
      const [username, domain] = data.split('@');
      return username.substring(0, 2) + '****@' + domain;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  if (typeof data === 'object') {
    const masked = { ...data };
    
    for (const key of Object.keys(masked)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        if (typeof masked[key] === 'string') {
          masked[key] = '****';
        }
      } else {
        masked[key] = maskSensitiveData(masked[key]);
      }
    }
    
    return masked;
  }

  return data;
}

/**
 * Logs to system with data masking
 */
export async function logSecurely(
  entry: LogEntry,
  supabase: any
): Promise<void> {
  try {
    const maskedDetails = maskSensitiveData(entry.details);
    
    await supabase
      .from('system_logs')
      .insert({
        type: entry.level,
        source: 'edge_function',
        message: entry.message,
        details: {
          ...maskedDetails,
          user_id: entry.userId,
          timestamp: entry.timestamp || new Date().toISOString()
        }
      });
  } catch (error) {
    console.error('Failed to log securely:', error);
  }
}

/**
 * Creates structured error response with logging
 */
export async function createErrorResponse(
  message: string,
  status: number,
  details?: any,
  supabase?: any
): Promise<Response> {
  const errorId = crypto.randomUUID();
  
  if (supabase) {
    await logSecurely({
      level: 'error',
      message: `[${errorId}] ${message}`,
      details
    }, supabase);
  }

  return new Response(
    JSON.stringify({
      error: message,
      errorId,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}