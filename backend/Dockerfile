FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/zainsaham ./cmd/zainsaham

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /out/zainsaham /usr/local/bin/zainsaham
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh
ENV APP_HOST=0.0.0.0 \
    APP_PORT=8000 \
    TZ=Asia/Jakarta
EXPOSE 8000
VOLUME /app/data
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["serve"]
