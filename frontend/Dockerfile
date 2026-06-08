# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# This helper only rewrites the stock port-80 config for IPv6. FitNotes uses a
# custom port-3000 config and the helper can stall on some Docker/ZFS hosts.
RUN rm -f /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
