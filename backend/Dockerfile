FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY data ./data
COPY scripts ./scripts

ENV PORT=2515
EXPOSE 2515

# Produção: evita `npm` como PID 1 e reduz chance de SIGKILL (OOM) em hosts com pouca RAM.
CMD ["node", "src/index.js"]
