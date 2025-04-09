# Dockerfile
FROM node:18

# 1. Set work directory
WORKDIR /usr/src/dungeon-revealer

# 2. Copy package files first (for caching layers)
COPY package.json package-lock.json ./


# 3. Ensure devDependencies are installed (so patch-package is available)
ENV NODE_ENV=development
RUN npm ci

# 4. Copy the rest 
COPY . .

# --- Optional debug: list what's in patches/ to confirm it’s there
RUN echo "===== Checking patches folder =====" \
 && ls -l patches || echo "No patches folder found"


# 5. Explicitly run patch-package to ensure patches are applied
#    was not working without this
RUN npm run patch-package

# 6. Switch to production mode for final build
ENV NODE_ENV=production

# Pass the build arg (defaults to some URL if not provided)
ARG VITE_EXCALIDRAW_URL

# Make it available as an ENV variable during the build

ENV VITE_EXCALIDRAW_URL=$VITE_EXCALIDRAW_URL
# 7. Build the app
RUN npm run build

# Add default settings.json
RUN mkdir -p ./data && echo '{ "currentMapId": "" }' > ./data/settings.json

# 8. Expose and run
EXPOSE 3000

CMD ["sh", "-c", "node server-build/index.js & node public/research/data.js"]

