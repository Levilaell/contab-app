export type ExternalClient = {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  ativo: boolean;
  solicitar_documentos: boolean;
  dia_solicitacao: number;
  modo_envio_guias: 'individual_automatico' | 'desativado';
  dominio_codigo_empresa: string | null;
  grupo_whatsapp_nome: string | null;
  created_at: string;
  updated_at: string;
};

export type ExternalClientContact = {
  id: string;
  external_client_id: string;
  nome: string;
  papel: string;
  whatsapp: string;
  email: string | null;
  ativo: boolean;
  receber_guias: boolean;
  receber_solicitacoes: boolean;
  ordem: number;
  created_at: string;
};

export type DocStatus =
  | 'recebido' | 'classificando' | 'classificado' | 'duvida'
  | 'pronto_envio' | 'enviando_dominio' | 'escriturado'
  | 'duplicado' | 'erro_dominio' | 'sem_envio';

export type DocTipo =
  | 'nfe' | 'nfse' | 'nfce' | 'cte'
  | 'comprovante' | 'recibo' | 'contrato' | 'outro';

export type Documento = {
  id: string;
  external_client_id: string | null;
  contact_id: string | null;
  solicitacao_id: string | null;
  remetente_phone: string;
  remetente_nome: string | null;
  wa_message_id: string | null;
  recebido_em: string;
  storage_path: string;
  mime_type: string;
  filename_original: string | null;
  file_size_bytes: number | null;
  sha256: string | null;
  status: DocStatus;
  tipo: DocTipo | null;
  confidence: number | null;
  metadata: Record<string, unknown> | null;
  reasoning: string | null;
  modelo_ia: string | null;
  chave_acesso_nfe: string | null;
  batch_id: string | null;
  escriturado: boolean;
  escriturado_em: string | null;
  escriturado_via: 'api_dominio' | 'manual' | null;
  dominio_response: Record<string, unknown> | null;
  escrituracao_erro: string | null;
  onedrive_file_id: string | null;
  onedrive_path: string | null;
  onedrive_uploaded_at: string | null;
  onedrive_erro: string | null;
  revisado_por: string | null;
  revisado_em: string | null;
  reclassificado: boolean;
  classificacao_original: Record<string, unknown> | null;
  created_at: string;
};

export type Guia = {
  id: string;
  coleta_id: string | null;
  external_client_id: string | null;
  tipo: 'DARF' | 'IRPJ' | 'CSLL' | 'PIS' | 'COFINS' | 'DAS' | 'INSS' | 'FGTS' | 'outro';
  competencia: string;
  vencimento: string;
  valor: number | null;
  storage_path: string;
  filename_original: string | null;
  cnpj_identificado: string | null;
  link_publico_url: string | null;
  link_publico_expira_at: string | null;
  created_at: string;
};

export type GuiaEnvioStatus =
  | 'pendente' | 'enviando' | 'enviado' | 'entregue'
  | 'lido' | 'erro' | 'cancelado';

export type GuiaEnvio = {
  id: string;
  guia_id: string;
  contact_id: string;
  status: GuiaEnvioStatus;
  template_nome: string;
  agendada_para: string;
  enviado_at: string | null;
  entregue_at: string | null;
  lido_at: string | null;
  respondido_at: string | null;
  wa_message_id: string | null;
  erro_mensagem: string | null;
  numero_followup: number;
  followup_dias_apos: number | null;
  cancelado_motivo: string | null;
  created_at: string;
};

export type SolicitacaoStatus = 'agendada' | 'enviada' | 'respondida' | 'erro' | 'cancelada';

export type SolicitacaoDocumento = {
  id: string;
  external_client_id: string;
  contact_id: string;
  competencia: string;
  template_nome: string;
  status: SolicitacaoStatus;
  agendada_para: string;
  enviada_at: string | null;
  respondida_at: string | null;
  wa_message_id: string | null;
  erro_mensagem: string | null;
  documentos_recebidos_count: number;
  created_at: string;
};

export type Coleta = {
  id: string;
  competencia: string;
  origem: 'watch_folder' | 'manual_upload' | 'mock';
  status: 'pendente' | 'executando' | 'concluida' | 'erro';
  total_arquivos_processados: number;
  total_guias_extraidas: number;
  total_clientes_identificados: number;
  total_orfas: number;
  iniciada_em: string;
  concluida_em: string | null;
  erro_mensagem: string | null;
  created_at: string;
};

export type EscrituracaoBatch = {
  id: string;
  external_client_id: string;
  total_documentos: number;
  sucessos: number;
  erros: number;
  duplicados: number;
  status: 'preparando' | 'enviando' | 'concluido' | 'erro_total';
  iniciado_em: string;
  concluido_em: string | null;
  dominio_response: Record<string, unknown> | null;
  erro_mensagem: string | null;
  created_at: string;
};
