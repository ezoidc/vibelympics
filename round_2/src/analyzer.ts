import { $ } from "bun";

export interface ImageAnalysis {
  layers: number;
  sizeBytes: number;
  sizeMB: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  packages: {
    [ecosystem: string]: number;
  };
  healthBenefits: {
    rootFree: boolean;
    minimalBase: boolean;
    withoutCurlBash: boolean;
    alpineSourced: boolean;
    rustFortified: boolean;
    freshlyBaked: boolean;
    multiArch: boolean;
  };
  metadata: {
    created: string;
    architecture: string[];
    user?: string;
    baseImage?: string;
  };
}

export class ImageAnalyzer {
  async analyzeImage(imageName: string): Promise<ImageAnalysis> {
    // Run analysis in parallel where possible
    const [
      manifest,
      sbom,
      vulnerabilities,
    ] = await Promise.all([
      this.getManifest(imageName),
      this.generateSBOM(imageName),
      this.scanVulnerabilities(imageName),
    ]);

    return this.buildAnalysis(imageName, manifest, sbom, vulnerabilities);
  }

  async analyzeImageWithProgress(
    imageName: string,
    onProgress: (message: string) => void | Promise<void>
  ): Promise<ImageAnalysis> {
    // Run analysis steps sequentially with progress updates
    await onProgress("Fetching image manifest");
    const manifest = await this.getManifest(imageName);

    await onProgress("Generating Software Bill of Materials (SBOM)");
    const sbom = await this.generateSBOM(imageName);

    await onProgress("Scanning for vulnerabilities with Grype");
    const vulnerabilities = await this.scanVulnerabilities(imageName);

    await onProgress("Analyzing container health");
    return this.buildAnalysis(imageName, manifest, sbom, vulnerabilities);
  }

  private async getManifest(imageName: string): Promise<any> {
    try {
      // Try to get manifest info from image metadata
      // Note: This is a simplified version - in production you'd use regctl or crane
      return { manifests: [] };
    } catch {
      return { manifests: [] };
    }
  }

  private async generateSBOM(imageName: string): Promise<any> {
    try {
      // Using syft CLI to generate SBOM from registry
      const result = await $`syft ${imageName} -o json`.json();
      return result;
    } catch (error) {
      console.error("SBOM generation failed:", error);
      return { artifacts: [] };
    }
  }

  private async scanVulnerabilities(imageName: string): Promise<any> {
    try {
      // Using grype CLI for vulnerability scanning from registry
      const result = await $`grype ${imageName} -o json`.json();
      return result;
    } catch (error) {
      console.error("Vulnerability scan failed:", error);
      return { matches: [] };
    }
  }

  private buildAnalysis(
    imageName: string,
    manifest: any,
    sbom: any,
    vulnerabilities: any
  ): ImageAnalysis {
    // Extract metadata from SBOM
    const source = sbom.source || {};
    const sourceMetadata = source.metadata || source.target || {};

    // Count layers from SBOM metadata
    const layers = sourceMetadata.layers?.length || 0;

    // Get size from SBOM metadata
    const sizeBytes = sourceMetadata.imageSize || 0;
    const sizeMB = Math.round(sizeBytes / (1024 * 1024) * 10) / 10;

    // Count vulnerabilities by severity
    const vulnCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    if (vulnerabilities.matches) {
      for (const match of vulnerabilities.matches) {
        const severity = match.vulnerability?.severity?.toLowerCase();
        if (severity === "critical") vulnCounts.critical++;
        else if (severity === "high") vulnCounts.high++;
        else if (severity === "medium") vulnCounts.medium++;
        else if (severity === "low") vulnCounts.low++;
      }
    }

    // Count packages by ecosystem
    const packages: { [key: string]: number } = {};
    if (sbom.artifacts) {
      for (const artifact of sbom.artifacts) {
        const type = artifact.type || "unknown";
        packages[type] = (packages[type] || 0) + 1;
      }
    }

    // Get metadata from SBOM
    let config = sourceMetadata.config || {};

    // Handle base64 encoded config (syft behavior for some images)
    if (typeof config === 'string') {
      try {
        config = JSON.parse(atob(config));
      } catch (e) {
        console.error("Failed to parse config string", e);
        config = {};
      }
    }

    const created = config.created || "";

    // Try multiple paths to find user configuration
    let user = config.config?.User || config.User || "";

    // Check history for USER commands if not found in config
    const history = sourceMetadata.history || config.history || [];
    if (!user && history.length > 0) {
      for (const historyItem of history) {
        const cmd = historyItem.created_by || "";
        const userMatch = cmd.match(/USER\s+(\S+)/);
        if (userMatch) {
          user = userMatch[1];
        }
      }
    }

    // Determine architectures from SBOM or manifest
    const architectures: string[] = [];
    if (manifest.manifests && manifest.manifests.length > 0) {
      for (const m of manifest.manifests) {
        if (m.platform?.architecture) {
          architectures.push(m.platform.architecture);
        }
      }
    } else if (sourceMetadata.architecture) {
      architectures.push(sourceMetadata.architecture);
    } else {
      architectures.push("unknown");
    }

    // Check health benefits
    const healthBenefits = {
      rootFree: this.isRootFree(user),
      minimalBase: this.isMinimalBase(imageName, sbom),
      withoutCurlBash: this.withoutCurlBash(sourceMetadata),
      alpineSourced: this.isAlpineSourced(imageName, sbom),
      rustFortified: this.isRustFortified(sbom),
      freshlyBaked: this.isFreshlyBaked(created),
      multiArch: architectures.length > 1,
    };

    return {
      layers,
      sizeBytes,
      sizeMB,
      vulnerabilities: vulnCounts,
      packages,
      healthBenefits,
      metadata: {
        created,
        architecture: architectures,
        user,
      },
    };
  }

  private isRootFree(user: string): boolean {
    // Empty string, "root", or "0" means running as root
    if (!user || user === "" || user === "root" || user === "0") {
      return false;
    }
    return true;
  }

  private isMinimalBase(imageName: string, sbom: any): boolean {
    const lowerName = imageName.toLowerCase();
    if (lowerName.includes("distroless") || lowerName.includes("scratch")) {
      return true;
    }

    // Check if package count is very low (< 50 packages suggests minimal)
    const totalPackages = sbom.artifacts?.length || 0;
    return totalPackages < 50;
  }

  private withoutCurlBash(sourceMetadata: any): boolean {
    // Check Dockerfile history for dangerous curl | bash or curl | sh patterns
    const history = sourceMetadata.history || [];

    for (const historyItem of history) {
      const cmd = (historyItem.created_by || "").toLowerCase();

      // Look for curl piped to bash/sh patterns
      if (
        cmd.includes("curl") &&
        (cmd.includes("| bash") || cmd.includes("| sh") || cmd.includes("|bash") || cmd.includes("|sh"))
      ) {
        return false;
      }

      // Also check for wget piped patterns
      if (
        cmd.includes("wget") &&
        (cmd.includes("| bash") || cmd.includes("| sh") || cmd.includes("|bash") || cmd.includes("|sh"))
      ) {
        return false;
      }
    }

    return true;
  }

  private isAlpineSourced(imageName: string, sbom: any): boolean {
    if (imageName.toLowerCase().includes("alpine")) {
      return true;
    }

    // Check SBOM for alpine packages
    const artifacts = sbom.artifacts || [];
    return artifacts.some((a: any) =>
      a.type === "apk" ||
      (a.metadata && a.metadata.originPackage === "alpine-base")
    );
  }

  private isRustFortified(sbom: any): boolean {
    const artifacts = sbom.artifacts || [];

    // Look for Rust packages or binaries
    return artifacts.some((a: any) =>
      a.language === "rust" ||
      a.type === "rust-crate" ||
      (a.metadata && a.metadata.virtualPath?.includes("cargo"))
    );
  }

  private isFreshlyBaked(created: string): boolean {
    if (!created) return false;

    const createdDate = new Date(created);
    const now = new Date();
    const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    return daysDiff <= 7;
  }
}

export function generateDrContainerLetter(analysis: ImageAnalysis): string {
  const lines: string[] = [];

  lines.push("Dear Container User,\n");
  lines.push("I am Dr. Container, and I have thoroughly examined your container image. Here is my professional assessment:\n");

  // Overall health score
  const healthScore = calculateHealthScore(analysis);
  if (healthScore >= 80) {
    lines.push("**Overall Health: Excellent** ✨\n");
  } else if (healthScore >= 60) {
    lines.push("**Overall Health: Good** 👍\n");
  } else if (healthScore >= 40) {
    lines.push("**Overall Health: Fair** ⚠️\n");
  } else {
    lines.push("**Overall Health: Needs Attention** 🚨\n");
  }

  // Health benefits explanation
  lines.push("**Health Benefits:**\n");

  if (analysis.healthBenefits.rootFree) {
    lines.push("- ✅ **Root Free**: This container runs as a non-root user, reducing security risks from privilege escalation attacks.\n");
  } else {
    lines.push("- ❌ **Root Free**: Container runs as root. Consider configuring a non-root user to improve security posture.\n");
  }

  if (analysis.healthBenefits.minimalBase) {
    lines.push("- ✅ **Minimal Base**: Based on a minimal or distroless image, reducing attack surface.\n");
  }

  if (analysis.healthBenefits.withoutCurlBash) {
    lines.push("- ✅ **Without curl | bash**: No dangerous curl-pipe-bash patterns detected in build history.\n");
  } else {
    lines.push("- ⚠️ **curl | bash Detected**: Build process may use risky download-and-execute patterns.\n");
  }

  if (analysis.healthBenefits.alpineSourced) {
    lines.push("- ✅ **Alpine Sourced**: Built on Alpine Linux for a lightweight, security-focused base.\n");
  }

  if (analysis.healthBenefits.rustFortified) {
    lines.push("- ✅ **Rust Fortified**: Contains Rust-based components known for memory safety.\n");
  }

  if (analysis.healthBenefits.freshlyBaked) {
    lines.push("- ✅ **Freshly Baked**: Built within the last 7 days, ensuring recent security patches.\n");
  } else if (analysis.metadata.created) {
    const createdDate = new Date(analysis.metadata.created);
    if (!isNaN(createdDate.getTime())) {
      const daysSinceCreation = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      lines.push(`- ⏰ **Image Age**: Built ${daysSinceCreation} days ago. Consider rebuilding to incorporate latest security updates.\n`);
    } else {
      lines.push("- ⏰ **Image Age**: Creation date unknown. Consider tagging images with build metadata.\n");
    }
  } else {
    lines.push("- ⏰ **Image Age**: Creation date unknown. Consider tagging images with build metadata.\n");
  }

  if (analysis.healthBenefits.multiArch) {
    lines.push("- ✅ **Multi-Vitamin-Arch**: Supports multiple architectures for broad compatibility.\n");
  }

  // Vulnerability assessment
  lines.push("\n**Security Vulnerabilities:**\n");
  const totalVulns = analysis.vulnerabilities.critical + analysis.vulnerabilities.high +
                     analysis.vulnerabilities.medium + analysis.vulnerabilities.low;

  if (totalVulns === 0) {
    lines.push("No known vulnerabilities detected. Excellent! 🎉\n");
  } else {
    const criticalHighParts: string[] = [];
    if (analysis.vulnerabilities.critical > 0) {
      criticalHighParts.push(`${analysis.vulnerabilities.critical} critical`);
    }
    if (analysis.vulnerabilities.high > 0) {
      criticalHighParts.push(`${analysis.vulnerabilities.high} high severity`);
    }

    if (criticalHighParts.length > 0) {
      lines.push(`⚠️ I urge immediate attention: Found ${criticalHighParts.join(" and ")} vulnerabilities. Immediate patching recommended.\n`);
    }

    const mediumLowParts: string[] = [];
    if (analysis.vulnerabilities.medium > 0) {
      mediumLowParts.push(`${analysis.vulnerabilities.medium} medium`);
    }
    if (analysis.vulnerabilities.low > 0) {
      mediumLowParts.push(`${analysis.vulnerabilities.low} low severity`);
    }

    if (mediumLowParts.length > 0) {
      lines.push(`Found ${mediumLowParts.join(" and ")} issues. Address these in your next update cycle.\n`);
    }
  }

  // Size assessment
  lines.push("\n**Size & Efficiency:**\n");
  if (analysis.sizeMB < 50) {
    lines.push(`At ${analysis.sizeMB} MB, this is a lean, efficient image. Well done!\n`);
  } else if (analysis.sizeMB < 200) {
    lines.push(`At ${analysis.sizeMB} MB, this is a reasonably sized image.\n`);
  } else {
    lines.push(`At ${analysis.sizeMB} MB, consider optimizing to reduce image size and attack surface.\n`);
  }

  // Recommendations
  lines.push("\n**Recommendations:**\n");
  const recommendations = generateRecommendations(analysis);
  recommendations.forEach(rec => lines.push(`- ${rec}\n`));

  lines.push("\nStay secure and containerized,\n");
  lines.push("**Dr. Container, MD**\n");
  lines.push("_Board Certified in Container Security_");

  return lines.join("");
}

function calculateHealthScore(analysis: ImageAnalysis): number {
  let score = 100;

  // Deduct for vulnerabilities
  score -= analysis.vulnerabilities.critical * 15;
  score -= analysis.vulnerabilities.high * 8;
  score -= analysis.vulnerabilities.medium * 3;
  score -= analysis.vulnerabilities.low * 1;

  // Deduct for running as root
  if (!analysis.healthBenefits.rootFree) score -= 15;

  // Deduct for old images
  if (!analysis.healthBenefits.freshlyBaked) score -= 10;

  // Deduct for large size
  if (analysis.sizeMB > 500) score -= 10;
  else if (analysis.sizeMB > 200) score -= 5;

  // Bonus for health benefits
  if (analysis.healthBenefits.minimalBase) score += 5;
  if (analysis.healthBenefits.withoutCurlBash) score += 5;
  if (analysis.healthBenefits.multiArch) score += 5;

  return Math.max(0, Math.min(100, score));
}

function generateRecommendations(analysis: ImageAnalysis): string[] {
  const recommendations: string[] = [];

  if (analysis.vulnerabilities.critical > 0 || analysis.vulnerabilities.high > 0) {
    recommendations.push("Run vulnerability scanning regularly and patch critical/high issues immediately");
  }

  if (!analysis.healthBenefits.rootFree) {
    recommendations.push("Configure a non-root user in your Dockerfile (USER directive)");
  }

  if (!analysis.healthBenefits.freshlyBaked) {
    recommendations.push("Rebuild your image to incorporate latest base image security patches");
  }

  if (analysis.sizeMB > 200) {
    recommendations.push("Consider using multi-stage builds or a smaller base image to reduce size");
  }

  if (!analysis.healthBenefits.withoutCurlBash) {
    recommendations.push("Avoid curl | bash patterns; download scripts and verify checksums instead");
  }

  if (!analysis.healthBenefits.multiArch) {
    recommendations.push("Consider building multi-architecture images for broader platform support");
  }

  if (recommendations.length === 0) {
    recommendations.push("Your container image looks great! Keep following security best practices.");
  }

  return recommendations;
}
