# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk -U upgrade && apk add --no-cache openssl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
