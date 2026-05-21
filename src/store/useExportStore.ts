import { create } from "zustand";
import type { Pedido, PedidoAttachment, PedidoChangeLog, Status } from "../types";
import { apiRequest, handleAuthFailure } from "../services/api";
import { useAuthStore } from "./useAuthStore";

type PedidoInput = Omit<Pedido, "numeroPedido"> & { numeroPedido: string };
type StatusInput = Omit<Status, "id"> & { id?: string };
type ActionResult = { ok: boolean; erro?: string };

type PedidoLogsMap = Record<string, PedidoChangeLog[]>;
type PedidoAttachmentsMap = Record<string, PedidoAttachment[]>;

function normalizeLog(raw: PedidoChangeLog): PedidoChangeLog {
  return {
    ...raw,
    changedAt: new Date(raw.changedAt).toISOString(),
  };
}

type ExportState = {
  pedidos: Pedido[];
  status: Status[];
  pedidoLogs: PedidoLogsMap;
  pedidoAttachments: PedidoAttachmentsMap;
  loading: boolean;
  loadPedidos: () => Promise<void>;
  loadStatus: () => Promise<void>;
  loadData: () => Promise<void>;
  clearData: () => void;
  addPedido: (pedido: PedidoInput) => Promise<ActionResult>;
  updatePedido: (numeroPedidoOriginal: string, pedido: PedidoInput) => Promise<ActionResult>;
  loadPedidoLogs: (numeroPedido: string) => Promise<void>;
  loadPedidoAttachments: (numeroPedido: string) => Promise<void>;
  uploadPedidoAttachments: (numeroPedido: string, files: File[]) => Promise<ActionResult>;
  downloadPedidoAttachment: (numeroPedido: string, attachmentId: string, fileName: string, inline?: boolean) => Promise<ActionResult>;
  updatePedidoStatus: (numeroPedido: string, statusId: string) => Promise<ActionResult>;
  addStatus: (payload: StatusInput) => Promise<ActionResult>;
  updateStatus: (id: string, payload: Omit<StatusInput, "id">) => Promise<ActionResult>;
};

function getToken() {
  return useAuthStore.getState().token;
}

function normalizeDate(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizePedido(pedido: Pedido): Pedido {
  return {
    ...pedido,
    regiao: pedido.regiao ?? "",
    dataPedido: normalizeDate(pedido.dataPedido),
    dataFaturamento: normalizeDate(pedido.dataFaturamento),
    dataExpedicao: normalizeDate(pedido.dataExpedicao),
    prazoEntrega: normalizeDate(pedido.prazoEntrega),
    dataAgendamento: normalizeDate(pedido.dataAgendamento),
    dataEntrega: normalizeDate(pedido.dataEntrega),
    createdAt: pedido.createdAt ?? null,
    updatedAt: pedido.updatedAt ?? null,
  };
}

export const useExportStore = create<ExportState>()((set, get) => ({
  pedidos: [],
  status: [],
  pedidoLogs: {},
  pedidoAttachments: {},
  loading: false,

  clearData: () => set({ pedidos: [], status: [], pedidoLogs: {}, pedidoAttachments: {}, loading: false }),

  loadPedidos: async () => {
    const token = getToken();
    if (!token) return;
    const pedidos = await apiRequest<Pedido[]>("/api/orders", { token });
    set({ pedidos: pedidos.map(normalizePedido) });
  },

  loadStatus: async () => {
    const token = getToken();
    if (!token) return;
    const status = await apiRequest<Status[]>("/api/status", { token });
    set({ status });
  },

  loadData: async () => {
    const token = getToken();
    if (!token) return;
    set({ loading: true });
    try {
      const [pedidos, status] = await Promise.all([
        apiRequest<Pedido[]>("/api/orders", { token }),
        apiRequest<Status[]>("/api/status", { token }),
      ]);
      set({
        pedidos: pedidos.map(normalizePedido),
        status,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  addPedido: async (pedido) => {
    const token = getToken();
    if (!token) return { ok: false, erro: "Sessao expirada." };
    try {
      const novo = await apiRequest<Pedido>("/api/orders", { method: "POST", token, body: pedido });
      set((state) => ({ pedidos: [normalizePedido(novo), ...state.pedidos] }));
      return { ok: true };
    } catch (error) {
      return { ok: false, erro: error instanceof Error ? error.message : "Erro ao cadastrar pedido." };
    }
  },

  updatePedido: async (numeroPedidoOriginal, pedido) => {
    const token = getToken();
    if (!token) return { ok: false, erro: "Sessao expirada." };
    try {
      const original = get().pedidos.find((item) => item.numeroPedido === numeroPedidoOriginal);
      const body: PedidoInput = { ...pedido };
      // Não envia região vazia quando o pedido já tem região salva (o backend preserva, mas evita ambiguidade).
      if (!String(pedido.regiao ?? "").trim() && String(original?.regiao ?? "").trim()) {
        delete (body as Partial<PedidoInput>).regiao;
      }
      const atualizado = await apiRequest<Pedido>(`/api/orders/${numeroPedidoOriginal}`, {
        method: "PUT",
        token,
        body,
      });
      const atualizadoNormalizado = normalizePedido(atualizado);
      set((state) => {
        const novoNumeroPedido = atualizadoNormalizado.numeroPedido;
        const pedidoLogsAtualizado: PedidoLogsMap = { ...state.pedidoLogs };
        if (numeroPedidoOriginal !== novoNumeroPedido) {
          delete pedidoLogsAtualizado[numeroPedidoOriginal];
        }
        return {
          pedidos: state.pedidos.map((item) =>
            item.numeroPedido === numeroPedidoOriginal ? atualizadoNormalizado : item,
          ),
          pedidoLogs: pedidoLogsAtualizado,
        };
      });
      await get().loadPedidoLogs(atualizadoNormalizado.numeroPedido);
      return { ok: true };
    } catch (error) {
      return { ok: false, erro: error instanceof Error ? error.message : "Erro ao editar pedido." };
    }
  },

  loadPedidoLogs: async (numeroPedido) => {
    const token = getToken();
    if (!token || !numeroPedido) return;
    const logs = await apiRequest<PedidoChangeLog[]>(`/api/orders/${numeroPedido}/logs`, { token });
    set((state) => ({
      pedidoLogs: {
        ...state.pedidoLogs,
        [numeroPedido]: logs.map(normalizeLog),
      },
    }));
  },

  loadPedidoAttachments: async (numeroPedido) => {
    const token = getToken();
    if (!token || !numeroPedido) return;
    const anexos = await apiRequest<PedidoAttachment[]>(`/api/orders/${numeroPedido}/attachments`, { token });
    set((state) => ({
      pedidoAttachments: {
        ...state.pedidoAttachments,
        [numeroPedido]: anexos,
      },
    }));
  },

  uploadPedidoAttachments: async (numeroPedido, files) => {
    const token = getToken();
    if (!token) return { ok: false, erro: "Sessao expirada." };
    if (!numeroPedido || files.length === 0) return { ok: true };
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/orders/${encodeURIComponent(numeroPedido)}/attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        handleAuthFailure(response.status);
        return { ok: false, erro: data?.message || "Erro ao enviar anexos." };
      }
      await get().loadPedidoAttachments(numeroPedido);
      return { ok: true };
    } catch (error) {
      return { ok: false, erro: error instanceof Error ? error.message : "Erro ao enviar anexos." };
    }
  },

  downloadPedidoAttachment: async (numeroPedido, attachmentId, fileName, inline = false) => {
    const token = getToken();
    if (!token) return { ok: false, erro: "Sessao expirada." };
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/orders/${encodeURIComponent(numeroPedido)}/attachments/${encodeURIComponent(attachmentId)}${inline ? "?inline=1" : ""}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        handleAuthFailure(response.status);
        const data = await response.json().catch(() => ({}));
        return { ok: false, erro: data?.message || "Erro ao baixar anexo." };
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (inline) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName || "anexo";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return { ok: true };
    } catch (error) {
      return { ok: false, erro: error instanceof Error ? error.message : "Erro ao baixar anexo." };
    }
  },

  updatePedidoStatus: async (numeroPedido, statusId) => {
    const token = getToken();
    if (!token) return { ok: false, erro: "Sessao expirada." };
    try {
      const atualizado = await apiRequest<Pedido>(`/api/orders/${numeroPedido}/status`, {
        method: "PATCH",
        token,
        body: { statusId },
      });
      set((state) => ({
        pedidos: state.pedidos.map((item) =>
          item.numeroPedido === numeroPedido ? normalizePedido(atualizado) : item,
        ),
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, erro: error instanceof Error ? error.message : "Erro ao atualizar status do pedido." };
    }
  },

  addStatus: async (payload) => {
    const token = getToken();
    if (!token) return { ok: false, erro: "Sessao expirada." };
    try {
      const novo = await apiRequest<Status>("/api/status", { method: "POST", token, body: payload });
      set((state) => ({ status: [...state.status, novo] }));
      return { ok: true };
    } catch (error) {
      return { ok: false, erro: error instanceof Error ? error.message : "Erro ao criar status." };
    }
  },

  updateStatus: async (id, payload) => {
    const token = getToken();
    if (!token) return { ok: false, erro: "Sessao expirada." };
    try {
      const atualizado = await apiRequest<Status>(`/api/status/${id}`, { method: "PUT", token, body: payload });
      set((state) => ({
        status: state.status.map((item) => (item.id === id ? atualizado : item)),
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, erro: error instanceof Error ? error.message : "Erro ao atualizar status." };
    }
  },
}));
