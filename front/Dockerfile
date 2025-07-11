# Stage 1: Build the React application
# Usa uma imagem Node.js para construir a aplicação React
FROM node:22-alpine as builder

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos package.json e package-lock.json (ou yarn.lock)
COPY package*.json ./

# Instala as dependências do Node.js
RUN npm install

# Copia todo o código-fonte da aplicação para o diretório de trabalho
COPY . .

# Constrói a aplicação React para produção
# Isso criará uma pasta 'build' com os arquivos estáticos otimizados
RUN npm run build

# Stage 2: Serve the application with Nginx
# Usa uma imagem Nginx leve para servir os arquivos estáticos
FROM nginx:alpine

# Copia a configuração personalizada do Nginx
# Certifique-se de que o arquivo nginx.conf existe na raiz do seu projeto
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove a pasta padrão do Nginx e copia os arquivos de build da aplicação
# A pasta 'build' é gerada na Stage 1
COPY --from=builder /app/build /usr/share/nginx/html

# Expõe a porta 80 do container
EXPOSE 80

# Comando para iniciar o Nginx
CMD ["nginx", "-g", "daemon off;"]

