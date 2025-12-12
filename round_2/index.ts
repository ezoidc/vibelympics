import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { ImageAnalyzer, generateDrContainerLetter } from "./src/analyzer";

const app = new Hono();
const analyzer = new ImageAnalyzer();

// Serve static files
app.use("/static/*", serveStatic({ root: "./" }));

// Home page
app.get("/", (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dr. Container - Container Image Nutrition Facts</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-section">
        <div class="stethoscope">🩺</div>
        <h1>Dr. Container</h1>
        <p class="tagline">Board Certified in Container Security</p>
      </div>
    </header>

    <main>
      <div class="intro-card">
        <h2>Container Image Health Analysis</h2>
        <p>Get a comprehensive "Nutrition Facts" style report for any Docker container image. I'll analyze security vulnerabilities, package composition, and provide expert recommendations.</p>
      </div>

      <div class="analyzer-form">
        <form id="analyzeForm">
          <div class="form-group">
            <label for="imageName">Container Image Name:</label>
            <input
              type="text"
              id="imageName"
              name="imageName"
              value="nginx:alpine"
              placeholder="e.g., nginx:alpine, node:20-slim"
              required
            />
          </div>
          <button type="submit" class="analyze-btn">
            <span class="btn-icon">🔬</span>
            Analyze Image
          </button>
        </form>
        <div id="loading" class="loading hidden">
          <div class="spinner"></div>
          <p>Dr. Container is examining your image...</p>
        </div>
      </div>

      <div id="results" class="hidden"></div>
    </main>

    <footer>
      <p>&copy; 2025 Dr. Container Labs. Keeping containers healthy since containers existed.</p>
    </footer>
  </div>

  <script src="/static/app.js"></script>
</body>
</html>
  `);
});

// Container puns for SSE updates
const containerPuns = [
  "Layering on the analysis...",
  "Containerizing the data...",
  "Orchestrating the results...",
  "Docker-ing all the details...",
  "Isolating the vulnerabilities...",
  "Shipping the examination...",
  "Composing the health report...",
  "Unpacking the layers...",
  "Mounting the investigation...",
  "Networking the findings...",
  "Pushing through the data...",
  "Building the assessment...",
  "Tagging the issues...",
  "Caching the insights...",
  "Pulling in the details...",
  "Scanning the manifests...",
  "Committing to thoroughness...",
  "Inspecting every byte...",
  "Running the diagnostics...",
  "Exposing the facts...",
];

function getRandomPun(): string {
  return containerPuns[Math.floor(Math.random() * containerPuns.length)] || "Processing...";
}

// API endpoint to analyze image with SSE
app.get("/api/analyze-stream", async (c) => {
  const imageName = c.req.query("image");

  if (!imageName) {
    return c.json({ error: "Image name is required" }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      // Send initial message
      await stream.writeSSE({ data: JSON.stringify({ type: "status", message: "Starting analysis...", pun: getRandomPun() }) });

      // Run analysis with real-time progress updates
      const analysis = await analyzer.analyzeImageWithProgress(
        imageName,
        async (message) => {
          await stream.writeSSE({ data: JSON.stringify({ type: "status", message, pun: getRandomPun() }) });
        }
      );

      // Generate letter
      await stream.writeSSE({ data: JSON.stringify({ type: "status", message: "Preparing Dr. Container's assessment", pun: getRandomPun() }) });
      const letter = generateDrContainerLetter(analysis);

      // Send final result
      await stream.writeSSE({ data: JSON.stringify({ type: "complete", analysis, letter }) });
    } catch (error: any) {
      console.error("Analysis failed:", error);
      await stream.writeSSE({ data: JSON.stringify({ type: "error", message: "Failed to analyze image", details: error.message }) });
    }
  });
});

// API endpoint to analyze image (legacy)
app.post("/api/analyze", async (c) => {
  try {
    const { imageName } = await c.req.json();

    if (!imageName) {
      return c.json({ error: "Image name is required" }, 400);
    }

    console.log(`Analyzing image: ${imageName}`);
    const analysis = await analyzer.analyzeImage(imageName);
    const letter = generateDrContainerLetter(analysis);

    return c.json({
      success: true,
      analysis,
      letter,
    });
  } catch (error: any) {
    console.error("Analysis failed:", error);
    return c.json(
      {
        error: "Failed to analyze image",
        details: error.message
      },
      500
    );
  }
});

const port = process.env.PORT || 3000;

console.log(`🩺 Dr. Container is ready at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120,
};