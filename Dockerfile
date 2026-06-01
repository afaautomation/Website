# Use official Node.js image
FROM node:20-slim

# Install system dependencies needed for Puppeteer (used for PDF generation)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory to the backend folder
WORKDIR /app

# Copy the backend package.json files
COPY Resume/backend/package*.json ./

# Install npm dependencies
RUN npm install

# Copy the rest of the backend source code
COPY Resume/backend/ ./

# Create necessary directories for the app
RUN mkdir -p data uploads/resumes uploads/avatars exports logs

# Hugging Face Spaces require applications to listen on port 7860
ENV PORT=7860

# Expose the port
EXPOSE 7860

# Start the server
CMD ["node", "src/server.js"]
