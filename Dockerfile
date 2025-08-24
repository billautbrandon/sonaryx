# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create data directory for SQLite database
RUN mkdir -p /app/data /app/logs

# Change ownership of the app directory to the nodejs user
RUN chown -R nodejs:nodejs /app

# Initialize the database as the nodejs user
USER nodejs
RUN npx prisma generate
RUN npx prisma db push

# Expose the port (not strictly necessary for Discord bots, but good practice)
EXPOSE 3000

# Define the command to run the application
CMD ["node", "index.js"]