document.getElementById('analyzeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const imageName = document.getElementById('imageName').value.trim();
  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results');
  const formEl = document.querySelector('.analyzer-form');

  // Show loading with streaming updates
  loadingEl.classList.remove('hidden');
  resultsEl.classList.add('hidden');

  // Clear any existing progress messages from previous analysis
  const existingProgress = document.getElementById('progressMessages');
  if (existingProgress) {
    existingProgress.remove();
  }

  // Create progress message container
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-messages';
  progressContainer.id = 'progressMessages';
  loadingEl.appendChild(progressContainer);

  try {
    // Use EventSource for SSE
    const eventSource = new EventSource(`/api/analyze-stream?image=${encodeURIComponent(imageName)}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        // Add status update with pun
        const statusMsg = document.createElement('div');
        statusMsg.className = 'status-message';
        statusMsg.innerHTML = `
          <div class="status-text">${escapeHtml(data.message)}</div>
          <div class="status-pun">💬 ${escapeHtml(data.pun)}</div>
        `;
        progressContainer.appendChild(statusMsg);

        // Auto-scroll to latest message
        progressContainer.scrollTop = progressContainer.scrollHeight;
      } else if (data.type === 'complete') {
        // Analysis complete
        eventSource.close();
        loadingEl.classList.add('hidden');

        // Display results
        displayResults(data.analysis, data.letter, imageName);
        resultsEl.classList.remove('hidden');

        // Scroll to results
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (data.type === 'error') {
        eventSource.close();
        throw new Error(data.message);
      }
    };

    eventSource.onerror = (error) => {
      eventSource.close();
      loadingEl.classList.add('hidden');
      resultsEl.innerHTML = `
        <div class="error-message">
          <h3>❌ Analysis Failed</h3>
          <p>Connection error during analysis</p>
          <p>Please check that the image name is correct and try again.</p>
        </div>
      `;
      resultsEl.classList.remove('hidden');
    };

  } catch (error) {
    loadingEl.classList.add('hidden');
    resultsEl.innerHTML = `
      <div class="error-message">
        <h3>❌ Analysis Failed</h3>
        <p>${escapeHtml(error.message)}</p>
        <p>Please check that the image name is correct and that Docker is running.</p>
      </div>
    `;
    resultsEl.classList.remove('hidden');
  }
});

function displayResults(analysis, letter, imageName) {
  const resultsEl = document.getElementById('results');

  // Build nutrition facts label
  const nutritionLabel = buildNutritionLabel(analysis, imageName);

  // Build certifications section
  const certifications = buildCertifications(analysis);

  // Format letter with markdown-like rendering
  const formattedLetter = formatLetter(letter);

  resultsEl.innerHTML = `
    ${nutritionLabel}
    ${certifications}
    <div class="dr-letter">
      <h3>📋 Dr. Container's Professional Assessment</h3>
      <div class="letter-content">
        ${formattedLetter}
      </div>
    </div>
  `;
}

function buildNutritionLabel(analysis, imageName) {
  const svgId = `nutritionSvg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const svgMarkup = createNutritionFactsSvg(analysis, imageName, svgId);
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  return `
    <div class="nutrition-facts-card">
      <img id="${svgId}" src="${url}" alt="Nutrition Facts" class="nutrition-facts-svg" />
    </div>
  `;
}

function buildCertifications(analysis) {
  const certs = [
    {
      key: 'rootFree',
      icon: '🔒',
      label: 'Root Free',
      awarded: analysis.healthBenefits.rootFree
    },
    {
      key: 'minimalBase',
      icon: '📦',
      label: 'Minimal Base',
      awarded: analysis.healthBenefits.minimalBase
    },
    {
      key: 'withoutCurlBash',
      icon: '🚫',
      label: 'Without curl | bash',
      awarded: analysis.healthBenefits.withoutCurlBash
    },
    {
      key: 'alpineSourced',
      icon: '🏔️',
      label: 'Alpine Sourced',
      awarded: analysis.healthBenefits.alpineSourced
    },
    {
      key: 'rustFortified',
      icon: '🦀',
      label: 'Rust Fortified',
      awarded: analysis.healthBenefits.rustFortified
    },
    {
      key: 'freshlyBaked',
      icon: '🥖',
      label: 'Freshly Baked',
      awarded: analysis.healthBenefits.freshlyBaked
    },
    {
      key: 'multiArch',
      icon: '🌐',
      label: 'Multi-Vitamin-Arch',
      awarded: analysis.healthBenefits.multiArch
    },
  ];

  const badges = certs
    .filter(cert => cert.awarded)
    .map(cert => `
      <div class="cert-badge awarded">
        <div class="cert-icon">${cert.icon}</div>
        <div class="cert-label">${cert.label}</div>
      </div>
    `).join('');

  return `
    <div class="certifications">
      <h3>🏅 Health Benefits</h3>
      <div class="cert-grid">
        ${badges}
      </div>
    </div>
  `;
}

function formatLetter(letter) {
  // Simple markdown-like formatting
  let formatted = escapeHtml(letter);

  // Bold text
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Line breaks to paragraphs
  formatted = formatted.split('\n\n').map(para => {
    if (para.trim().startsWith('-')) {
      // List items
      const items = para.split('\n').filter(line => line.trim());
      return '<ul>' + items.map(item => `<li>${item.replace(/^- /, '')}</li>`).join('') + '</ul>';
    }
    return `<p>${para.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return formatted;
}

function formatEcosystem(ecosystem) {
  const mapping = {
    'apk': 'Alpine (apk)',
    'deb': 'Debian (deb)',
    'rpm': 'RPM',
    'python': 'Python',
    'npm': 'npm',
    'gem': 'Ruby Gems',
    'go-module': 'Go Modules',
    'java-archive': 'Java (JAR/WAR)',
    'rust-crate': 'Rust Crates',
  };

  return mapping[ecosystem] || ecosystem;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function createNutritionFactsSvg(analysis, imageName, svgId) {
  const width = 640;
  const padding = 48;
  const baseGap = 30;
  let currentY = padding;
  const svgParts = [];
  const safeImage = imageName ? imageName : 'Unknown Image';
  const vulns = analysis.vulnerabilities || {};
  const majorVulns = (vulns.critical || 0) + (vulns.high || 0);
  const minorVulns = (vulns.medium || 0) + (vulns.low || 0);
  const packageEntries = Object.entries(analysis.packages || {});
  const formattedSize = formatNumericDisplay(analysis.sizeMB, { maximumFractionDigits: 1 });
  const formattedLayers = formatNumericDisplay(analysis.layers);

  const addRow = (left, right = '', options = {}) => {
    const {
      gap = baseGap,
      leftIndent = 0,
      leftSize = 16,
      leftWeight = 400,
      leftColor = '#000',
      rightSize = 16,
      rightWeight = 400,
      rightColor = '#000',
    } = options;

    currentY += gap;
    const y = currentY;

    if (left) {
      svgParts.push(`<text x="${padding + leftIndent}" y="${y}" font-size="${leftSize}" font-weight="${leftWeight}" font-family="Arial, sans-serif" fill="${leftColor}">${svgEscape(left)}</text>`);
    }

    if (right) {
      svgParts.push(`<text x="${width - padding}" y="${y}" font-size="${rightSize}" font-weight="${rightWeight}" font-family="Arial, sans-serif" fill="${rightColor}" text-anchor="end">${svgEscape(right)}</text>`);
    }
  };

  const addDivider = (thickness = 2, gap = 12) => {
    currentY += gap;
    svgParts.push(`<line x1="${padding}" y1="${currentY}" x2="${width - padding}" y2="${currentY}" stroke="#000" stroke-width="${thickness}" />`);
  };

  const addCalories = () => {
    currentY += 36;
    const y = currentY;
    svgParts.push(`<text x="${padding}" y="${y}" font-size="20" font-weight="700" font-family="Arial, sans-serif" fill="#000">Calories</text>`);
    svgParts.push(`<text x="${width - padding}" y="${y}" font-size="46" font-weight="700" font-family="Arial, sans-serif" fill="#000" text-anchor="end">${svgEscape(formattedSize)}<tspan font-size="16" font-weight="500" dx="6">MB</tspan></text>`);
  };

  addRow('Container Facts', '', { gap: 10, leftSize: 42, leftWeight: 900 });
  addRow(`Image: ${safeImage}`, '', { gap: 12, leftSize: 14 });
  addRow(`Servings: ${formattedLayers} layers`, '', { gap: 18, leftSize: 16, leftWeight: 600 });

  addDivider(10, 20);
  addCalories();
  addDivider(4, 18);

  addRow('', '% Daily Value*', { gap: 18, rightSize: 12, rightWeight: 700 });
  addDivider(2, 8);

  addRow('Public Vulnerabilities', '', { gap: 22, leftSize: 20, leftWeight: 700 });
  addRow('Critical & High', String(majorVulns), {
    leftIndent: 18,
    leftWeight: 600,
    rightSize: 22,
    rightWeight: 700,
    rightColor: majorVulns > 0 ? '#EF5350' : '#66BB6A'
  });
  addRow('Medium & Low', String(minorVulns), {
    leftIndent: 18,
    leftWeight: 600,
    rightSize: 22,
    rightWeight: 700,
    rightColor: minorVulns > 0 ? '#FFA726' : '#66BB6A'
  });

  addDivider(6, 16);
  addRow('Packages by Ecosystem', '', { gap: 26, leftSize: 18, leftWeight: 700 });

  if (packageEntries.length === 0) {
    addRow('No packages detected', '', { gap: 20, leftIndent: 18, leftSize: 15, leftWeight: 500 });
  } else {
    packageEntries.forEach(([ecosystem, count]) => {
      addRow(formatEcosystem(ecosystem), formatNumericDisplay(count), {
        gap: 22,
        leftIndent: 18,
        leftWeight: 600,
        rightWeight: 700,
      });
    });
  }

  const height = currentY + padding + 12;
  const titleId = `${svgId}-title`;

  return `
    <svg id="${svgId}" class="nutrition-facts-svg" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.ceil(height)}" viewBox="0 0 ${width} ${Math.ceil(height)}" role="img" aria-labelledby="${titleId}" preserveAspectRatio="xMidYMin meet">
      <title id="${titleId}">Container facts for ${svgEscape(safeImage)}</title>
      <rect x="7.5" y="7.5" width="${width - 15}" height="${Math.ceil(height) - 15}" fill="#fff" stroke="#000" stroke-width="15" rx="8" />
      ${svgParts.join('')}
    </svg>
  `;
}

function formatNumericDisplay(value, options = {}) {
  const numberValue = getNumericValue(value);
  if (numberValue === null) {
    return value !== undefined && value !== null && value !== '' ? String(value) : '0';
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  }).format(numberValue);
}

function getNumericValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]+/g, '');
    const parsed = parseFloat(cleaned);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function svgEscape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

