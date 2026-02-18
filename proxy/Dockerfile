# Dockerfile para el Proxy NocoDB
# Imagen base de Node.js
FROM node:20-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar código de la aplicación
COPY . .

# Exponer puerto
EXPOSE 3001

# Variable de entorno para el puerto
ENV PORT=3001

# Iniciar el servidor
CMD ["npm", "start"]
