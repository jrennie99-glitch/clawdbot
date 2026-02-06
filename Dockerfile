FROM node:22-bookworm

# Install supervisor for multi-process management
RUN apt-get update && \
    apt-get install -y --no-install-recommends supervisor curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install   | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

ARG CLAWDBOT_DOCKER_APT_PACKAGES=""
RUN if [ -n "$CLAWDBOT_DOCKER_APT_PACKAGES" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $CLAWDBOT_DOCKER_APT_PACKAGES && \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*; \
    fi

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN CLAWDBOT_A2UI_SKIP_MISSING=1 pnpm build
ENV CLAWDBOT_PREFER_PNPM=1
RUN pnpm ui:install
RUN pnpm ui:build

# Create required directories
RUN mkdir -p /var/log/supervisor /root/.moltbot

# Copy supervisor and server configs
COPY docker/supervisord-main.conf /etc/supervisor/supervisord.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/moltbot.conf
COPY docker/start-gateway.sh /app/docker/start-gateway.sh
COPY docker/moltbot.json /root/.moltbot/moltbot.json

# Make startup script executable
RUN chmod +x /app/docker/start-gateway.sh

ENV NODE_ENV=production

# Expose ports (3002 for frontend, 8001 for gateway)
EXPOSE 3002 8001

# Health check - checks BOTH frontend and gateway
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3002/healthz >/dev/null && \
        curl -fsS http://127.0.0.1:8001/ >/dev/null || exit 1

# Start supervisor (manages both gateway and UI server)
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
