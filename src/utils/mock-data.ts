import dayjs from "dayjs";
import type { Pedido, Status, Usuario } from "../types";

export const statusIniciais: Status[] = [
  { id: "aguardando-carregamento", nome: "Aguardando carregamento", cor: "#6b7280" },
  { id: "em-transito", nome: "Em transito", cor: "#2563eb" },
  { id: "no-porto", nome: "No porto", cor: "#f97316" },
  { id: "finalizado", nome: "Finalizado", cor: "#16a34a" },
];

function criarPedidoFake(representante: string, index: number): Pedido {
  const base = 1100 + index;
  return {
    numeroPedido: `PED-${base}`,
    representante,
    numeroNF: `NF-${7000 + index}`,
    cliente: index % 2 === 0 ? "Atlas Trading" : "Global Foods",
    dataFaturamento: dayjs().subtract(18 - (index % 10), "day").format("YYYY-MM-DD"),
    dataExpedicao: dayjs().subtract(15 - (index % 8), "day").format("YYYY-MM-DD"),
    prazoEntrega: dayjs().add((index % 7) - 3, "day").format("YYYY-MM-DD"),
    dataEntrega: statusIniciais[index % statusIniciais.length].id === "finalizado" ? dayjs().format("YYYY-MM-DD") : "",
    statusAtual: statusIniciais[index % statusIniciais.length].id,
  };
}

const pedidosAna = Array.from({ length: 10 }, (_, idx) => criarPedidoFake("Ana Martins", idx + 1));
const pedidosBruno = Array.from({ length: 10 }, (_, idx) => criarPedidoFake("Bruno Lima", idx + 101));

export const pedidosIniciais: Pedido[] = [...pedidosAna, ...pedidosBruno];

export const usuariosIniciais: Usuario[] = [
  { id: "admin-1", nome: "Administrador", login: "admin", senha: "admin123", tipo: "administrador" },
  { id: "dir-1", nome: "Diretoria", login: "diretoria", senha: "diretoria123", tipo: "diretoria" },
  { id: "rep-1", nome: "Ana Martins", login: "ana", senha: "ana123", tipo: "representante" },
  { id: "rep-2", nome: "Bruno Lima", login: "bruno", senha: "bruno123", tipo: "representante" },
];
