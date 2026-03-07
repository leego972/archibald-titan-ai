# ─── Stage 1: Install dependencies ───────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests, npmrc, and patches
COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches/ ./patches/
# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ─────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build client (Vite) and server (esbuild)
RUN pnpm build

# ─── Stage 3: Production runtime ────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Install Python3 for sandbox code execution/verification
# Install Go 1.22 compiler for sandbox Go builds (requires 1.21+ for 'slices' package)
# Install Playwright/Chromium system dependencies for fetcher engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    gcc \
    wget \
    curl \
    git \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/* \
    && wget -q https://go.dev/dl/go1.22.10.linux-amd64.tar.gz -O /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz

# Set Go environment
ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/tmp/go"
ENV GOROOT="/usr/local/go"

# Pre-install common Python packages so sandbox builds can test without pip install
# This covers 90%+ of typical build requests
RUN pip3 install --break-system-packages --no-cache-dir \
    requests \
    flask \
    fastapi \
    uvicorn \
    aiohttp \
    asyncio \
    websockets \
    httpx \
    beautifulsoup4 \
    lxml \
    scrapy \
    selenium \
    dnspython \
    python-whois \
    cryptography \
    pycryptodome \
    paramiko \
    scapy \
    impacket \
    rich \
    click \
    typer \
    colorama \
    tabulate \
    pyyaml \
    toml \
    python-dotenv \
    jinja2 \
    pillow \
    numpy \
    pandas \
    matplotlib \
    sqlalchemy \
    psutil \
    pynput \
    pyautogui \
    schedule \
    watchdog \
    pytest \
    black \
    mypy \
    builtwith \
    tqdm \
    pydantic \
    python-jose \
    passlib \
    bcrypt \
    python-multipart

# Copy package manifests, npmrc, patches, and install production-only dependencies
COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

# Install Playwright Chromium browser
RUN npx playwright install chromium

# Copy built artifacts
COPY --from=build /app/dist ./dist

# Copy Drizzle migrations
COPY --from=build /app/dist/drizzle ./drizzle

# Non-root user for security
RUN addgroup --system --gid 1001 titan && \
    adduser --system --uid 1001 titan

# Give titan user access to Playwright browser cache
RUN mkdir -p /home/titan/.cache && chown -R titan:titan /home/titan

# Create sandbox temp directory with proper permissions
RUN mkdir -p /tmp/titan-sandboxes && chown -R titan:titan /tmp/titan-sandboxes

# Ensure Go module cache is writable for sandbox builds
RUN mkdir -p /tmp/go && chmod -R a+rwx /tmp/go

# Give titan user write access to Python site-packages so sandbox pip install works
# PEP 668 workaround: allow pip to install system-wide
RUN chmod -R a+rw /usr/local/lib/python3*/dist-packages/ 2>/dev/null || true && \
    chmod -R a+rw /usr/lib/python3/dist-packages/ 2>/dev/null || true && \
    mkdir -p /usr/local/lib/python3.11/dist-packages && chmod a+rw /usr/local/lib/python3.11/dist-packages

USER titan

# Railway injects PORT; default to 5000
ENV NODE_ENV=production
ENV PORT=5000
ENV PIP_BREAK_SYSTEM_PACKAGES=1
EXPOSE 5000

CMD ["node", "dist/index.js"]
