import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TipoUsuario, Usuario } from "../types";
import { apiRequest } from "../services/api";

type NovoUsuario = {
  nome: string;
  email?: string;
  login: string;
  senha: string;
  tipo: TipoUsuario;
};

type AuthState = {
  usuarios: Usuario[];
  usuarioAtual: Usuario | null;
  token: string | null;
  login: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  logout: () => void;
  addUsuario: (payload: NovoUsuario) => Promise<{ ok: boolean; erro?: string }>;
  loadUsuarios: () => Promise<void>;
  registrarRepresentante: (payload: { nome: string; email: string; senha: string }) => Promise<{ ok: boolean; erro?: string }>;
  confirmarConta: (token: string) => Promise<{ ok: boolean; erro?: string }>;
  esqueciSenha: (loginOuEmail: string) => Promise<{ ok: boolean; erro?: string }>;
  redefinirSenha: (token: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuarios: [],
      usuarioAtual: null,
      token: null,

      login: async (email, senha) => {
        try {
          const data = await apiRequest<{ token: string; usuario: Usuario }>("/api/auth/login", {
            method: "POST",
            body: { email, senha }
          });
          set({ usuarioAtual: data.usuario, token: data.token });
          if (data.usuario.tipo === "administrador") {
            await get().loadUsuarios();
          }
          return { ok: true };
        } catch (error) {
          return { ok: false, erro: error instanceof Error ? error.message : "Falha no login." };
        }
      },

      logout: () => set({ usuarioAtual: null, token: null }),

      loadUsuarios: async () => {
        const token = get().token;
        if (!token) return;
        const users = await apiRequest<Usuario[]>("/api/users", { token });
        set({ usuarios: users });
      },

      addUsuario: async (payload) => {
        const token = get().token;
        if (!token) return { ok: false, erro: "Sessao expirada." };
        try {
          await apiRequest<Usuario>("/api/users", { method: "POST", token, body: payload });
          await get().loadUsuarios();
          return { ok: true };
        } catch (error) {
          return { ok: false, erro: error instanceof Error ? error.message : "Erro ao cadastrar usuario." };
        }
      },

      registrarRepresentante: async (payload) => {
        try {
          await apiRequest<{ ok: boolean }>("/api/auth/register", { method: "POST", body: payload });
          return { ok: true };
        } catch (error) {
          return { ok: false, erro: error instanceof Error ? error.message : "Falha ao criar conta." };
        }
      },

      confirmarConta: async (token) => {
        try {
          await apiRequest<{ ok: boolean }>("/api/auth/confirm-account", { method: "POST", body: { token } });
          return { ok: true };
        } catch (error) {
          return { ok: false, erro: error instanceof Error ? error.message : "Falha ao confirmar conta." };
        }
      },

      esqueciSenha: async (loginOuEmail) => {
        try {
          await apiRequest<{ ok: boolean }>("/api/auth/forgot-password", { method: "POST", body: { loginOuEmail } });
          return { ok: true };
        } catch (error) {
          return { ok: false, erro: error instanceof Error ? error.message : "Falha ao solicitar redefinicao." };
        }
      },

      redefinirSenha: async (token, senha) => {
        try {
          await apiRequest<{ ok: boolean }>("/api/auth/reset-password", { method: "POST", body: { token, senha } });
          return { ok: true };
        } catch (error) {
          return { ok: false, erro: error instanceof Error ? error.message : "Falha ao redefinir senha." };
        }
      }
    }),
    {
      name: "export-auth-storage",
      version: 3
    }
  )
);
