
/**
 * Normaliza números de telefone brasileiros para o formato aceito pelo WHAPI
 * Remove o 9º dígito dos números de celular conforme necessário para compatibilidade
 */

export function normalizePhoneForWhapi(phone: string): string {
  // Remove caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove zeros à esquerda
  cleaned = cleaned.replace(/^0+/, '');
  
  // Se não tem código do país, adiciona 55
  if (!cleaned.startsWith('55')) {
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }
  }
  
  // Verifica se é número brasileiro válido
  if (!cleaned.startsWith('55') || cleaned.length < 12 || cleaned.length > 13) {
    throw new Error(`Número brasileiro inválido: ${phone}`);
  }
  
  // Extrai componentes: 55 + DDD + número
  const countryCode = cleaned.substring(0, 2); // 55
  const areaCode = cleaned.substring(2, 4); // 51
  const number = cleaned.substring(4); // 997519607 ou 97519607
  
  console.log('🔍 Analisando número para WHAPI:', {
    original: phone,
    cleaned,
    countryCode,
    areaCode,
    number,
    numberLength: number.length
  });
  
  // Se o número tem 9 dígitos e começa com 9 (celular novo formato)
  if (number.length === 9 && number.startsWith('9')) {
    // Remove o 9º dígito para compatibilidade com WHAPI
    const normalizedNumber = number.substring(1); // Remove o primeiro 9
    const result = countryCode + areaCode + normalizedNumber;
    
    console.log('📱 Normalizando celular para WHAPI (removendo 9º dígito):', {
      original: `${countryCode}${areaCode}${number}`,
      normalized: result,
      change: `${number} → ${normalizedNumber}`
    });
    
    return result;
  }
  
  // Se já está no formato correto (8 dígitos) ou é fixo, retorna como está
  console.log('📞 Número já no formato correto para WHAPI:', cleaned);
  return cleaned;
}

export function validateBrazilianPhone(phone: string): {
  isValid: boolean;
  type: 'mobile' | 'landline' | 'unknown';
  formatted: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned) {
    return { isValid: false, type: 'unknown', formatted: '', warnings: ['Número vazio'] };
  }
  
  // Remove zeros à esquerda
  cleaned = cleaned.replace(/^0+/, '');
  
  // Adiciona código do país se necessário
  if (!cleaned.startsWith('55')) {
    if (cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
      warnings.push('Código do país (55) adicionado automaticamente');
    } else {
      warnings.push('Número com formato suspeito');
    }
  }
  
  // Validar comprimento
  if (cleaned.length < 12 || cleaned.length > 13) {
    warnings.push(`Comprimento inválido: ${cleaned.length} dígitos`);
    return { isValid: false, type: 'unknown', formatted: cleaned, warnings };
  }
  
  // Verificar DDD válido
  const ddd = cleaned.substring(2, 4);
  if (parseInt(ddd) < 11 || parseInt(ddd) > 99) {
    warnings.push(`DDD inválido: ${ddd}`);
    return { isValid: false, type: 'unknown', formatted: cleaned, warnings };
  }
  
  // Determinar tipo
  const numberPart = cleaned.substring(4);
  let type: 'mobile' | 'landline' | 'unknown' = 'unknown';
  
  if (numberPart.length === 9 && numberPart.startsWith('9')) {
    type = 'mobile';
  } else if (numberPart.length === 8 && !numberPart.startsWith('9')) {
    // Pode ser celular formato antigo ou fixo
    type = parseInt(numberPart.substring(0, 1)) >= 6 ? 'mobile' : 'landline';
  } else if (numberPart.length === 8 && ['2', '3', '4', '5'].includes(numberPart.charAt(0))) {
    type = 'landline';
  }
  
  return { isValid: true, type, formatted: cleaned, warnings };
}
