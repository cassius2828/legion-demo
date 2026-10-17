FROM node:22-bookworm-slim

WORKDIR /app

ENV TZ=America/Los_Angeles
ENV SKIP_ENV_VALIDATION=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
