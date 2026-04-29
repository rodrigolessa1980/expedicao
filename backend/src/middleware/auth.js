import jwt from "jsonwebtoken";
import { findUserById } from "../db.js";

function tokenFromHeader(header = "") {
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export async function requireAuth(req, res, next) {
  try {
    const token = tokenFromHeader(req.headers.authorization);
    if (!token) return res.status(401).json({ message: "Token ausente." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(decoded.sub);
    if (!user) return res.status(401).json({ message: "Usuario invalido." });
    if (!user.ativo) return res.status(403).json({ message: "Usuario inativo." });
    if (!user.confirmadoEm) return res.status(403).json({ message: "Conta nao confirmada." });

    req.user = {
      id: user.id,
      nome: user.nome,
      login: user.login,
      email: user.email,
      tipo: user.tipo
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Token invalido." });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.tipo !== "administrador") {
    return res.status(403).json({ message: "Apenas administrador." });
  }
  return next();
}
