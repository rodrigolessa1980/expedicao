import { motion } from "framer-motion";
import { Card } from "./ui/card";

type KpiCardProps = {
  titulo: string;
  valor: number;
  destaque?: string;
};

export function KpiCard({ titulo, valor, destaque }: KpiCardProps) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-5">
        <p className="text-sm text-slate-500">{titulo}</p>
        <p className="mt-1 text-3xl font-semibold text-slate-900">{valor}</p>
        {destaque ? <p className="mt-1 text-xs text-slate-500">{destaque}</p> : null}
      </Card>
    </motion.div>
  );
}
