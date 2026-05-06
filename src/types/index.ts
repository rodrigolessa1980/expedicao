export type Status = {
  id: string;
  nome: string;
  cor: string;
};

export type Pedido = {
  numeroPedido: string;
  representante: string;
  numeroNF: string;
  cliente: string;
  dataPedido: string;
  dataFaturamento: string;
  dataExpedicao: string;
  prazoEntrega: string;
  dataEntrega: string;
  statusAtual: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PedidoAttachment = {
  id: string;
  pedidoNumero: string;
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  criadoPor: string;
  criadoEm: string;
};

export type PedidoField =
  | "numeroPedido"
  | "representante"
  | "numeroNF"
  | "cliente"
  | "dataPedido"
  | "dataFaturamento"
  | "dataExpedicao"
  | "prazoEntrega"
  | "dataEntrega"
  | "statusAtual";

export type PedidoChangeLog = {
  id: string;
  pedidoNumero: string;
  field: PedidoField;
  fieldLabel: string;
  from: string;
  to: string;
  changedAt: string;
  changedBy: string;
};

export type TipoUsuario = "administrador" | "representante" | "diretoria";

export type Usuario = {
  id: string;
  nome: string;
  login: string;
  senha?: string;
  email?: string | null;
  tipo: TipoUsuario;
  ativo?: boolean;
  confirmadoEm?: string | null;
};
