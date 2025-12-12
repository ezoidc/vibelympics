# Dr. Container - Container Image Nutrition Facts Analyzer

A web application that analyzes Docker container images and provides a "Nutrition Facts" style report with security insights, package composition, and expert recommendations from Dr. Container.

## Features

- 🩺 **Comprehensive Image Analysis**: Analyzes container images using industry-standard tools (Syft, Grype)
- 📊 **Nutrition Facts Label**: Presents image metrics in a familiar, easy-to-read format
- 🏅 **Certification Badges**: Visual indicators for security best practices
- 📝 **Expert Assessment**: Detailed letter from Dr. Container with personalized recommendations
- 🎨 **Clean, Modern UI**: Light blue and green color scheme for a fresh, trustworthy feel

## Analysis Metrics

### Container Facts Label
- **Servings**: Number of image layers
- **Calories**: Total image size in MB
- **Vulnerabilities**: Count of critical/high and medium/low severity issues
- **Packages**: Breakdown by ecosystem (OS packages, language packages, etc.)

### Certifications
- 🔒 **Root Free**: Container runs as non-root user
- 📦 **Minimal Base**: Based on minimal/distroless image
- 🚫 **Without curl | bash**: No dangerous download-and-execute patterns
- 🏔️ **Alpine Sourced**: Based on Alpine Linux
- 🦀 **Rust Fortified**: Contains Rust-based binaries
- 🥖 **Freshly Baked**: Built within the last 7 days
- 🌐 **Multi-Vitamin-Arch**: Supports multiple architectures

## Prerequisites

- [Bun](https://bun.sh/) runtime installed
- Docker installed and running
- Syft and Grype installed (included in Dockerfile for containerized deployment)

## Quick Start

```bash
# Install dependencies
bun install

# Run the application
bun run index.ts
```

Open `http://localhost:3000` to start analyzing container images!

## Usage

1. Open your browser to `http://localhost:3000`
2. Enter a Docker image name (e.g., `nginx:alpine`, `node:20-slim`)
3. Click "Analyze Image"
4. View the comprehensive Container Facts report

## Docker Deployment

Build and run the application in a container:

```bash
# Build the image
docker build -t dr-container .

# Run the container
docker run -p 3000:3000 dr-container
```

**Note**: The application uses Syft and Grype to analyze images directly from container registries without requiring Docker socket access.

## Architecture

- **Backend**: Bun + Hono web framework
- **Frontend**: Vanilla JavaScript with modern CSS
- **Analysis Tools**:
  - Syft (SBOM generation)
  - Grype (vulnerability scanning)
  - Docker CLI (image inspection)

## Project Structure

```
.
├── index.ts              # Main application server
├── src/
│   └── analyzer.ts       # Image analysis logic
├── static/
│   ├── style.css        # Styling
│   └── app.js           # Frontend JavaScript
├── Dockerfile           # Container build file
└── README.md
```

## About Dr. Container

Dr. Container is board certified in Container Security and dedicated to keeping your containers healthy and secure. Trust the expert. Trust Dr. Container. 🩺


