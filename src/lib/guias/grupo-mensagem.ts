import { formatDateBR } from '@/lib/format';

export type GuiaParaEnvio = {
  tipo: string;
  competencia: string;
  vencimento: string;
  valor: number | null;
  link_publico_url: string | null;
};

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function competenciaPorExtenso(iso: string): string {
  const [ano, mes] = iso.split('-');
  const idx = parseInt(mes, 10) - 1;
  return `${MESES[idx] ?? mes}/${ano}`;
}

function formatBRL(v: number | null): string {
  if (v === null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function montarMensagemGrupo(opts: {
  razaoSocial: string;
  guias: GuiaParaEnvio[];
  nomeEscritorio: string;
}): string {
  const { razaoSocial, guias, nomeEscritorio } = opts;
  const competencia = guias[0] ? competenciaPorExtenso(guias[0].competencia) : '';

  const linhasGuias = guias
    .map((g, i) => {
      const cabecalho = `${i + 1}. ${g.tipo} — vence ${formatDateBR(g.vencimento)} — ${formatBRL(g.valor)}`;
      const link = g.link_publico_url ? `\n   ${g.link_publico_url}` : '';
      return `${cabecalho}${link}`;
    })
    .join('\n\n');

  return [
    `Boa tarde, equipe da ${razaoSocial}.`,
    '',
    competencia
      ? `Seguem as guias referentes a ${competencia}:`
      : 'Seguem as guias:',
    '',
    linhasGuias,
    '',
    'Qualquer dúvida estamos à disposição.',
    '',
    nomeEscritorio,
  ].join('\n');
}
