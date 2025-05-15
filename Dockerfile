# Step 1: Build the TypeScript code
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy and build source
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Step 2: Run the app with compiled JS
FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

CMD ["node", "dist/server.js"]