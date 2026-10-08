# Stage 1 — Build the binary
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN go build -o server ./cmd/server/main.go

# Stage 2 — Minimal runtime image
FROM alpine:latest

WORKDIR /app

# Copy only the compiled binary from builder
COPY --from=builder /app/server .

EXPOSE 1313

CMD ["./server"]