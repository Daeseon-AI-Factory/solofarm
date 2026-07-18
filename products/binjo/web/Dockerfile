FROM node:20-alpine

WORKDIR /app

# Install deps first (cache layer)
COPY package.json package-lock.json* ./
RUN npm install

# Copy application code
COPY . .

# Runtime uploads live on a named volume mounted at this path in Compose.
RUN mkdir -p /app/uploads

# Next.js dev server — hot reload works with volume mount
CMD ["npx", "next", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
