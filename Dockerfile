# Stage 1: Build the application
FROM node:18 AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application
FROM node:18

# Set the working directory
WORKDIR /app

# Copy the build output from the previous stage
COPY --from=build /app/dist /app/dist

# Install a lightweight web server (serve)
RUN npm install -g serve

# Expose the port the app runs on
EXPOSE 3000

# Command to run the app
CMD ["serve", "-s", "dist", "-l", "3000"]
