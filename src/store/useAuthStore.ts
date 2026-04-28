import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TipoUsuario, Usuario } from "../types";
import { usuariosIniciais } from "../utils/mock-data";

type NovoUsuario = Omit<Usuario, "id">;

type AuthState = {
  usuarios: Usuario[];
  usuarioAtual: Usuario | null;
  login: (login: string, senha: string) => { ok: boolean; erro?: string };
  logout: () => void;
  addUsuario: (payload: NovoUsuario) => { ok: boolean; erro?: string };
};

const defaultsPorTipo: Record<TipoUsuario, NovoUsuario> = {
  administrador: { nome: "Administrador", login: "admin", senha: "admin123", tipo: "administrador" },
  diretoria: { nome: "Diretoria", login: "diretoria", senha: "diretoria123", tipo: "diretoria" },
  representante: { nome: "Ana Martins", login: "ana", senha: "ana123", tipo: "representante" },
};

function garantirUsuariosPadrao(usuarios: Usuario[]): Usuario[] {
  const lista = [...usuarios];
  (Object.keys(defaultsPorTipo) as TipoUsuario[]).forEach((tipo) => {
    const jaExiste = lista.some((u) => u.tipo === tipo);
    if (!jaExiste) {
      const base = defaultsPorTipo[tipo];
      lista.push({ ...base, id: crypto.randomUUID() });
    }
  });
  return lista;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuarios: usuariosIniciais,
      usuarioAtual: null,

      login: (login, senha) => {
        const user = get().usuarios.find((u) => u.login === login && u.senha === senha);
        if (!user) return { ok: false, erro: "Login ou senha invalidos." };
        set({ usuarioAtual: user });
        return { ok: true };
      },

      logout: () => set({ usuarioAtual: null }),

      addUsuario: (payload) => {
        if (!payload.nome || !payload.login || !payload.senha) {
          return { ok: false, erro: "Preencha nome, login e senha." };
        }
        if (get().usuarios.some((u) => u.login === payload.login)) {
          return { ok: false, erro: "Ja existe usuario com esse login." };
        }
        set((state) => ({
          usuarios: [...state.usuarios, { ...payload, id: crypto.randomUUID() }],
        }));
        return { ok: true };
      },
    }),
    {
      name: "export-auth-storage",
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as AuthState | undefined;
        if (!state) return { usuarios: usuariosIniciais, usuarioAtual: null };
        return {
          ...state,
          usuarios: garantirUsuariosPadrao(state.usuarios ?? usuariosIniciais),
          usuarioAtual: state.usuarioAtual ?? null,
        };
      },
    },
  ),
);
