import { create } from "zustand";
import { persist } from "zustand/middleware";
import dayjs from "dayjs";
import type { Pedido, Status } from "../types";
import { pedidosIniciais, statusIniciais } from "../utils/mock-data";

type PedidoInput = Omit<Pedido, "numeroPedido"> & { numeroPedido: string };
type StatusInput = Omit<Status, "id"> & { id?: string };

type ExportState = {
  pedidos: Pedido[];
  status: Status[];
  addPedido: (pedido: PedidoInput) => { ok: boolean; erro?: string };
  updatePedidoStatus: (numeroPedido: string, statusId: string) => void;
  addStatus: (payload: StatusInput) => { ok: boolean; erro?: string };
  updateStatus: (id: string, payload: Omit<StatusInput, "id">) => void;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function criarPedidoFakeMigracao(representante: string, index: number): Pedido {
  const base = 5000 + index;
  return {
    numeroPedido: `PED-${base}`,
    representante,
    numeroNF: `NF-${9000 + index}`,
    cliente: index % 2 === 0 ? "Atlas Trading" : "Global Foods",
    dataFaturamento: dayjs().subtract(18 - (index % 10), "day").format("YYYY-MM-DD"),
    dataExpedicao: dayjs().subtract(15 - (index % 8), "day").format("YYYY-MM-DD"),
    prazoEntrega: dayjs().add((index % 7) - 3, "day").format("YYYY-MM-DD"),
    dataEntrega: statusIniciais[index % statusIniciais.length].id === "finalizado" ? dayjs().format("YYYY-MM-DD") : "",
    statusAtual: statusIniciais[index % statusIniciais.length].id,
  };
}

function garantirDezPorRepresentante(origem: Pedido[]): Pedido[] {
  const repsAlvo = ["Ana Martins", "Bruno Lima"];
  const lista = [...origem];
  const pedidosIds = new Set(lista.map((p) => p.numeroPedido));
  let idx = 1;

  repsAlvo.forEach((rep) => {
    const atuais = lista.filter((p) => p.representante === rep).length;
    const faltantes = Math.max(0, 10 - atuais);
    for (let i = 0; i < faltantes; i += 1) {
      let novo = criarPedidoFakeMigracao(rep, idx);
      while (pedidosIds.has(novo.numeroPedido)) {
        idx += 1;
        novo = criarPedidoFakeMigracao(rep, idx);
      }
      pedidosIds.add(novo.numeroPedido);
      lista.push(novo);
      idx += 1;
    }
  });

  return lista;
}

export const useExportStore = create<ExportState>()(
  persist(
    (set, get) => ({
      pedidos: pedidosIniciais,
      status: statusIniciais,

      addPedido: (pedido) => {
        if (!pedido.numeroPedido || !pedido.representante || !pedido.numeroNF || !pedido.cliente) {
          return { ok: false, erro: "Preencha todos os campos obrigatorios." };
        }

        const jaExiste = get().pedidos.some((p) => p.numeroPedido === pedido.numeroPedido);
        if (jaExiste) {
          return { ok: false, erro: "Numero de pedido ja cadastrado." };
        }

        const dataEntregaAutomatica = pedido.statusAtual === "finalizado" ? dayjs().format("YYYY-MM-DD") : pedido.dataEntrega || "";
        set((state) => ({ pedidos: [{ ...pedido, dataEntrega: dataEntregaAutomatica }, ...state.pedidos] }));
        return { ok: true };
      },

      updatePedidoStatus: (numeroPedido, statusId) => {
        set((state) => ({
          pedidos: state.pedidos.map((pedido) =>
            pedido.numeroPedido === numeroPedido
              ? {
                  ...pedido,
                  statusAtual: statusId,
                  dataEntrega: statusId === "finalizado" ? pedido.dataEntrega || dayjs().format("YYYY-MM-DD") : pedido.dataEntrega,
                }
              : pedido,
          ),
        }));
      },

      addStatus: (payload) => {
        if (!payload.nome || !payload.cor) {
          return { ok: false, erro: "Informe nome e cor para o status." };
        }

        const id = payload.id ? slugify(payload.id) : slugify(payload.nome);
        if (get().status.some((item) => item.id === id)) {
          return { ok: false, erro: "Ja existe um status com esse identificador." };
        }

        set((state) => ({
          status: [...state.status, { id, nome: payload.nome, cor: payload.cor }],
        }));
        return { ok: true };
      },

      updateStatus: (id, payload) => {
        set((state) => ({
          status: state.status.map((item) =>
            item.id === id ? { ...item, nome: payload.nome, cor: payload.cor } : item,
          ),
        }));
      },
    }),
    {
      name: "export-dashboard-storage",
      version: 4,
      migrate: (persistedState) => {
        const state = persistedState as ExportState | undefined;
        if (!state) return { pedidos: pedidosIniciais, status: statusIniciais };
        return {
          ...state,
          pedidos: garantirDezPorRepresentante(
            (state.pedidos ?? pedidosIniciais).map((pedido) => ({
              ...pedido,
              representante: pedido.representante ?? "Nao informado",
              dataEntrega:
                pedido.dataEntrega ??
                (pedido.statusAtual === "finalizado" ? dayjs().format("YYYY-MM-DD") : ""),
            })),
          ),
        };
      },
    },
  ),
);
