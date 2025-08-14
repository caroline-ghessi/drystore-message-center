/**
 * Input validation and sanitization utilities
 */

export interface ValidationResult {
  isValid: boolean;
  sanitized?: any;
  errors: string[];
}

/**
 * Validates and sanitizes phone numbers
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  const errors: string[] = [];
  
  if (!phone || typeof phone !== 'string') {
    errors.push('Phone number is required and must be a string');
    return { isValid: false, errors };
  }

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length < 10 || cleaned.length > 15) {
    errors.push('Phone number must be between 10 and 15 digits');
  }

  // Additional validation for Brazilian numbers
  if (cleaned.startsWith('55') && cleaned.length !== 13 && cleaned.length !== 12) {
    errors.push('Brazilian phone number format is invalid');
  }

  return {
    isValid: errors.length === 0,
    sanitized: cleaned,
    errors
  };
}

/**
 * Validates and sanitizes text content
 */
export function validateTextContent(content: string, maxLength: number = 4096): ValidationResult {
  const errors: string[] = [];
  
  if (!content || typeof content !== 'string') {
    errors.push('Content is required and must be a string');
    return { isValid: false, errors };
  }

  if (content.length > maxLength) {
    errors.push(`Content exceeds maximum length of ${maxLength} characters`);
  }

  // Remove potentially dangerous characters
  const sanitized = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();

  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Validates email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email || typeof email !== 'string') {
    errors.push('Email is required and must be a string');
    return { isValid: false, errors };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }

  return {
    isValid: errors.length === 0,
    sanitized: email.toLowerCase().trim(),
    errors
  };
}

/**
 * Validates UUID format
 */
export function validateUUID(uuid: string): ValidationResult {
  const errors: string[] = [];
  
  if (!uuid || typeof uuid !== 'string') {
    errors.push('UUID is required and must be a string');
    return { isValid: false, errors };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    errors.push('Invalid UUID format');
  }

  return {
    isValid: errors.length === 0,
    sanitized: uuid.toLowerCase(),
    errors
  };
}