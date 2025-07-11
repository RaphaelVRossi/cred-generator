# Usa a imagem oficial do Go como base para a fase de build
FROM golang:1.24.4-alpine AS builder

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos go.mod e go.sum para o diretório de trabalho
COPY go.mod ./
COPY go.sum ./

# Baixa as dependências do módulo Go
RUN go mod download

# Copia todo o código-fonte da aplicação para o diretório de trabalho
COPY . .

# Constrói a aplicação Go
# -o main: define o nome do executável como 'main'
# -ldflags -s -w: remove tabelas de símbolos e informações de depuração para reduzir o tamanho do binário
RUN CGO_ENABLED=0 GOOS=linux go build -o main -ldflags "-s -w" .

# Usa uma imagem Alpine menor para a fase final de execução
FROM alpine:latest

# Define o diretório de trabalho
WORKDIR /root/

# Copia o executável 'main' da fase de build para a imagem final
COPY --from=builder /app/main .

# Expõe a porta em que a aplicação Go escutará
EXPOSE 8080

# Define o comando a ser executado quando o contêiner for iniciado
CMD ["./main"]

