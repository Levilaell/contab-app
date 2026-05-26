import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { Guia, GuiaEnvio, ExternalClient, ExternalClientContact } from '@/lib/types';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  header: { borderBottom: '1pt solid #999', paddingBottom: 8, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 'bold' },
  subtitle: { fontSize: 11, color: '#555', marginTop: 4 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 100, color: '#555' },
  value: { flex: 1 },
  envioItem: {
    border: '1pt solid #ddd',
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  envioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  envioName: { fontWeight: 'bold' },
  envioStatus: { fontSize: 9, padding: '2pt 6pt', borderRadius: 4 },
  envioTimestamp: { fontSize: 9, color: '#555' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
  },
});

function formatBR(date: Date | string | null) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function statusLabel(s: GuiaEnvio['status']): string {
  const map: Record<GuiaEnvio['status'], string> = {
    pendente: 'Pendente',
    enviando: 'Enviando',
    enviado: 'Enviado',
    entregue: 'Entregue',
    lido: 'Lido',
    erro: 'Erro',
    cancelado: 'Cancelado',
  };
  return map[s];
}

type Props = {
  guia: Guia;
  cliente: Pick<ExternalClient, 'razao_social' | 'cnpj'> | null;
  envios: GuiaEnvio[];
  contatos: Pick<ExternalClientContact, 'id' | 'nome' | 'whatsapp'>[];
};

export function ProvaEnvioPDF({ guia, cliente, envios, contatos }: Props) {
  const contatoMap = new Map(contatos.map((c) => [c.id, c]));
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'Contabilliza';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{brandName} — Comprovante de envio</Text>
          <Text style={styles.subtitle}>
            Guia {guia.tipo} · {cliente?.razao_social ?? 'Sem cliente'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalhes da guia</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Tipo</Text>
            <Text style={styles.value}>{guia.tipo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Competência</Text>
            <Text style={styles.value}>{guia.competencia}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vencimento</Text>
            <Text style={styles.value}>{guia.vencimento}</Text>
          </View>
          {cliente && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>CNPJ</Text>
                <Text style={styles.value}>{cliente.cnpj}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Razão social</Text>
                <Text style={styles.value}>{cliente.razao_social}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Envios ({envios.length})</Text>
          {envios.length === 0 ? (
            <Text>Nenhum envio registrado.</Text>
          ) : (
            envios.map((e) => {
              const c = contatoMap.get(e.contact_id);
              return (
                <View key={e.id} style={styles.envioItem}>
                  <View style={styles.envioHeader}>
                    <Text style={styles.envioName}>
                      {c?.nome ?? '?'}
                      {e.numero_followup > 0 && ` · follow-up #${e.numero_followup}`}
                    </Text>
                    <Text style={styles.envioStatus}>{statusLabel(e.status)}</Text>
                  </View>
                  <Text style={styles.envioTimestamp}>WhatsApp: {c?.whatsapp ?? '—'}</Text>
                  {e.enviado_at && (
                    <Text style={styles.envioTimestamp}>
                      Enviado em: {formatBR(e.enviado_at)}
                    </Text>
                  )}
                  {e.entregue_at && (
                    <Text style={styles.envioTimestamp}>
                      Entregue em: {formatBR(e.entregue_at)}
                    </Text>
                  )}
                  {e.lido_at && (
                    <Text style={styles.envioTimestamp}>
                      Lido em: {formatBR(e.lido_at)}
                    </Text>
                  )}
                  {e.respondido_at && (
                    <Text style={styles.envioTimestamp}>
                      Respondeu em: {formatBR(e.respondido_at)}
                    </Text>
                  )}
                  {e.wa_message_id && (
                    <Text style={styles.envioTimestamp}>
                      ID WhatsApp: {e.wa_message_id}
                    </Text>
                  )}
                  {e.erro_mensagem && (
                    <Text style={styles.envioTimestamp}>Erro: {e.erro_mensagem}</Text>
                  )}
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.footer}>
          Documento gerado automaticamente em {formatBR(new Date())} · {brandName}
        </Text>
      </Page>
    </Document>
  );
}
