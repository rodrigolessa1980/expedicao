import { Router } from "express";
import { processarNotificacoesAtrasoPedidoManual } from "./atrasoPedidoJob.js";
import {
  getAtrasoPedidoDiasAtraso,
  getAtrasoPedidoWebhookUrl,
  isAtrasoPedidoDispatchBlocked,
} from "./atrasoPedidoConfig.js";
import { requireAdmin, requireAuth } from "./middleware/auth.js";

function requireDevelopment(_req, res, next) {
  if (!isAtrasoPedidoDispatchBlocked()) {
    return res.status(404).json({
      message: "Disparo manual disponivel apenas com NODE_ENV=development.",
    });
  }
  next();
}

const router = Router();
router.use(requireDevelopment, requireAuth, requireAdmin);

router.post("/atraso-pedido/disparar-manual", async (_req, res) => {
  try {
    const result = await processarNotificacoesAtrasoPedidoManual();
    if (result.reason === "manual_apenas_em_development") {
      return res.status(403).json({ message: "Disparo manual so em NODE_ENV=development." });
    }
    return res.json({
      ok: true,
      ...result,
      minDiasAtraso: getAtrasoPedidoDiasAtraso(),
      webhookUrl: getAtrasoPedidoWebhookUrl(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ message });
  }
});

export default router;
