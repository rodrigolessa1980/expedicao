FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY data ./data
COPY scripts ./scripts

ENV PORT=2515
EXPOSE 2515

CMD ["npm", "start"]
