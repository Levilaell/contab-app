export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function cleanCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  return cnpj.replace(/\D/g, '');
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'R$ 0,00';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n);
}

export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTimeBR(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatCompetencia(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${meses[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

export function formatYearMonth(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  // E164 BR: 5511999999999 → +55 (11) 99999-9999
  if (clean.length === 13 && clean.startsWith('55')) {
    return clean.replace(/^55(\d{2})(\d{5})(\d{4})$/, '+55 ($1) $2-$3');
  }
  if (clean.length === 11) {
    return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  return phone;
}

export function toE164(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('55') && clean.length === 13) return clean;
  if (clean.length === 11) return `55${clean}`;
  if (clean.length === 10) return `55${clean.slice(0, 2)}9${clean.slice(2)}`;
  return clean;
}

export function capitalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
