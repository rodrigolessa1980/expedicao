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
  dataFaturamento: string;
  dataExpedicao: string;
  prazoEntrega: string;
  dataEntrega: string;
  statusAtual: string;
};

export type TipoUsuario = "administrador" | "representante" | "diretoria";

export type Usuario = {
  id: string;
  nome: string;
  login: string;
  senha: string;
  tipo: TipoUsuario;
};
