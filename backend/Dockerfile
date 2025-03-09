FROM golang:1.23-alpine

WORKDIR /app

COPY go.mod ./
COPY go.sum ./

RUN go mod download

COPY . .

EXPOSE 1313

CMD ["sh", "-c", "exec go run cmd/server/main.go"]