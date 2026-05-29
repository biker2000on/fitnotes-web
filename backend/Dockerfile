# Stage 1: Build the Go API Binary
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy dependency manifests and download libraries
COPY go.mod ./

# Copy source code
COPY . .

# Run go mod tidy on copied source files to download dependencies and generate checksums
RUN go mod tidy
RUN go mod download

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 2: Create a minimal deployment image
FROM alpine:latest  

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/main .
COPY --from=builder /app/db/migrations ./db/migrations

EXPOSE 8080

CMD ["./main"]
