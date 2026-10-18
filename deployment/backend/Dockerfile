
FROM golang:1.24-alpine AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates

COPY backend/go.mod backend/go.sum ./
RUN go mod download
RUN go mod verify

COPY backend/ ./
COPY deployment/backend/config.prod.sample.yml ./config/config.prod.sample.yml

RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/server \
    ./cmd/server

RUN mkdir -p /out/uploads

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /out/server /app/server
COPY --from=builder --chown=nonroot:nonroot /src/config/config.prod.sample.yml /app/config/config.prod.yml
COPY --from=builder --chown=nonroot:nonroot /src/rbac_model.conf /app/rbac_model.conf
COPY --from=builder --chown=nonroot:nonroot /out/uploads/ /app/uploads/

ENV GIN_MODE=release
ENV PORT=1313
ENV CONFIG_PATH=/app/config/config.prod.yml

EXPOSE 1313

USER nonroot:nonroot

ENTRYPOINT ["/app/server"]
