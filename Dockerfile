# Distroless Node: no shell, no package manager, runs as user 65532.
# No npm install: the app has no dependencies.
FROM gcr.io/distroless/nodejs22-debian12:nonroot

# The version the card shows. CI passes the image tag, e.g. 0.1.0.
ARG VERSION=dev
ENV APP_VERSION=$VERSION

# Lets fetch trust the cluster's CA when calling the Kubernetes API.
ENV NODE_EXTRA_CA_CERTS=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

WORKDIR /app
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 8080
CMD ["src/server.js"]
