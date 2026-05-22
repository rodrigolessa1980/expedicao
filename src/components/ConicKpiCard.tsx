import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";

export type ConicKpiSegmento = {
  id: string;
  nome: string;
  cor: string;
  valor: string;
  inicio: number;
  fim: number;
};

type ConicKpiCardProps = {
  titulo: string;
  total: number | string;
  segmentos: ConicKpiSegmento[];
  vazio?: string;
  rodape?: ReactNode;
  maxLegendasColapsadas?: number;
};

const RAIO_EXTERNO = 40;
const RAIO_INTERNO = 28;

function corComDestaque(hex: string, ativo: boolean) {
  if (ativo || !hex.startsWith("#") || hex.length !== 7) return hex;
  return `${hex}59`;
}

function montarConic(segmentos: ConicKpiSegmento[], destaqueId: string | null) {
  if (segmentos.length === 0) return "conic-gradient(#e5e7eb 0% 100%)";
  return `conic-gradient(${segmentos
    .map((seg) => {
      const ativo = !destaqueId || destaqueId === seg.id;
      return `${corComDestaque(seg.cor, ativo)} ${seg.inicio.toFixed(2)}% ${seg.fim.toFixed(2)}%`;
    })
    .join(", ")})`;
}

function segmentoNoPonto(segmentos: ConicKpiSegmento[], clientX: number, clientY: number, rect: DOMRect) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const x = clientX - cx;
  const y = clientY - cy;
  const dist = Math.hypot(x, y);
  if (dist < RAIO_INTERNO || dist > RAIO_EXTERNO) return null;

  let angulo = (Math.atan2(x, -y) * 180) / Math.PI;
  if (angulo < 0) angulo += 360;
  const percentual = (angulo / 360) * 100;

  return segmentos.find((seg) => percentual >= seg.inicio && percentual < seg.fim)?.id ?? null;
}

export function ConicKpiCard({
  titulo,
  total,
  segmentos,
  vazio = "Sem dados no periodo.",
  rodape,
  maxLegendasColapsadas = 3,
}: ConicKpiCardProps) {
  const [expandido, setExpandido] = useState(false);
  const [destaqueId, setDestaqueId] = useState<string | null>(null);

  const conic = useMemo(() => montarConic(segmentos, destaqueId), [segmentos, destaqueId]);

  const segmentosLegenda = useMemo(
    () => (expandido ? segmentos : segmentos.slice(0, maxLegendasColapsadas)),
    [expandido, segmentos, maxLegendasColapsadas],
  );

  const ocultas = Math.max(0, segmentos.length - maxLegendasColapsadas);
  const podeExpandir = ocultas > 0;

  const destacar = useCallback((id: string | null) => setDestaqueId(id), []);

  const aoMoverGrafico = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (segmentos.length === 0) return;
      const id = segmentoNoPonto(segmentos, event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
      destacar(id);
    },
    [segmentos, destacar],
  );

  return (
    <div
      className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5"
      onMouseLeave={() => destacar(null)}
    >
      <p className="mb-1 text-[11px] font-medium text-slate-500">{titulo}</p>
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`relative h-20 w-20 shrink-0 rounded-full transition-shadow ${
            destaqueId ? "ring-2 ring-slate-300" : ""
          }`}
          style={{ background: conic }}
          role="img"
          aria-label={`Grafico ${titulo}`}
          onMouseMove={aoMoverGrafico}
          onMouseEnter={aoMoverGrafico}
        >
          <div className="pointer-events-none absolute inset-3 rounded-full bg-white" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-700">
            {total}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {segmentos.length === 0 ? (
            <p className="text-[11px] text-slate-500">{vazio}</p>
          ) : (
            <>
              {segmentosLegenda.map((item) => {
                const emDestaque = destaqueId === item.id;
                const esmaecido = destaqueId != null && !emDestaque;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] transition-all ${
                      emDestaque
                        ? "bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-300"
                        : esmaecido
                          ? "text-slate-400 opacity-50"
                          : "text-slate-600 hover:bg-white/80"
                    }`}
                    onMouseEnter={() => destacar(item.id)}
                    onFocus={() => destacar(item.id)}
                    onBlur={() => destacar(null)}
                    onClick={() => destacar(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        destacar(item.id);
                      }
                    }}
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full transition-transform ${emDestaque ? "scale-125 ring-1 ring-slate-400" : ""}`}
                      style={{ backgroundColor: item.cor }}
                    />
                    <span className="max-w-[130px] truncate">{item.nome}</span>
                    <span className="font-medium text-slate-700">{item.valor}</span>
                  </div>
                );
              })}

              {podeExpandir ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-0.5 h-7 w-full px-2 text-[10px] font-semibold"
                  onClick={() => setExpandido((atual) => !atual)}
                >
                  {expandido ? (
                    <>
                      <ChevronUp className="h-3 w-3 shrink-0" />
                      Recolher legendas
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 shrink-0" />
                      Ver todas ({segmentos.length})
                    </>
                  )}
                </Button>
              ) : null}
            </>
          )}
          {rodape}
        </div>
      </div>
    </div>
  );
}
