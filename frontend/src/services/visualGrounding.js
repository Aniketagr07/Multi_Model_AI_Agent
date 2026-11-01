/**
 * OmniAI Visual Grounding & Pixel Analysis Engine
 *
 * Provides on-device pixel analysis, image structure detection, and response grounding validation.
 * Ensures vision outputs are strictly grounded in actual visual content and eliminates generic filler.
 */

export const GROUNDED_IMAGE_CATEGORIES = {
  DOCUMENT_TEXT: 'document_text',
  DOCUMENT_CV: 'document_text', // backwards-compatible alias
  BUSINESS_COMMUNICATION: 'business_communication',
  SCREENSHOT_UI: 'screenshot_ui',
  DIAGRAM_CIRCUIT: 'diagram_circuit',
  CHART_GRAPH: 'chart_graph',
  MATH_PROBLEM: 'math_problem',
  PROGRAMMING_CODE: 'programming_code',
  NATURAL_PHOTO: 'natural_photo',
  OBJECTS_SCENE: 'objects_scene',
  ANIMAL_PHOTO: 'animal_photo',
  ILLUSTRATION: 'illustration',
  UNKNOWN: 'unknown',
};

// Forbidden generic filler patterns that indicate an ungrounded or hallucinated response
export const FORBIDDEN_GENERIC_PATTERNS = [
  /balanced focal points/i,
  /subject-background separation/i,
  /spatial orientation and lighting emphasize/i,
  /demonstrates balanced focal points/i,
  /primary elements within the scene/i,
  /visual details:\s*spatial orientation/i,
  /scene composition:\s*the visual arrangement/i,
];

/**
 * Fast on-device pixel analyzer for RawImage or ImageData tensors.
 * Evaluates luminance distributions, text-line projection profiles, saturation, and contrast.
 */
export function analyzeRawImagePixels(rawImage) {
  if (!rawImage || !rawImage.data) {
    return {
      category: GROUNDED_IMAGE_CATEGORIES.UNKNOWN,
      whiteRatio: 0,
      darkRatio: 0,
      avgSat: 0,
      textLineCount: 0,
      hasLeftSidebar: false,
      dimensions: { width: 0, height: 0 },
    };
  }

  const { width: w, height: h, data: d, channels: ch = 3 } = rawImage;
  const step = 4; // Sub-sample step for <15ms execution time
  let samples = 0;
  let lightCount = 0;
  let darkCount = 0;
  let totalSat = 0;

  for (let i = 0; i < d.length; i += ch * step) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum > 220) lightCount++;
    if (lum < 40) darkCount++;
    const sat = max === 0 ? 0 : (max - min) / max;
    totalSat += sat;
    samples++;
  }

  const whiteRatio = samples > 0 ? lightCount / samples : 0;
  const darkRatio = samples > 0 ? darkCount / samples : 0;
  const avgSat = samples > 0 ? totalSat / samples : 0;

  // Horizontal projection profile to detect discrete text lines
  let textLineCount = 0;
  let inLine = false;
  for (let y = 0; y < h; y += 2) {
    let textPixelsInRow = 0;
    const rowOffset = y * w * ch;
    for (let x = 0; x < w; x += 4) {
      const idx = rowOffset + x * ch;
      const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
      // Text pixel in light document or dark UI
      if (whiteRatio > 0.6 ? lum < 160 : lum > 60 && lum < 220) {
        textPixelsInRow++;
      }
    }
    if (textPixelsInRow > (w / 4) * 0.015) {
      if (!inLine) {
        inLine = true;
        textLineCount++;
      }
    } else {
      inLine = false;
    }
  }

  // Detect left sidebar vs main body layout (common in modern professional CVs and two-column layouts)
  let leftDark = 0;
  let rightDark = 0;
  const midX = Math.floor(w * 0.35);
  for (let y = Math.floor(h * 0.15); y < Math.floor(h * 0.85); y += 4) {
    const rowOffset = y * w * ch;
    for (let x = 0; x < midX; x += 4) {
      const idx = rowOffset + x * ch;
      const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
      if (lum < 160) leftDark++;
    }
    for (let x = midX; x < w; x += 4) {
      const idx = rowOffset + x * ch;
      const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
      if (lum < 160) rightDark++;
    }
  }
  const hasLeftSidebar = leftDark > 0 && rightDark > 0 && leftDark / (rightDark + 1) > 0.2;

  // Classify visual document / media type based on pixel statistics
  let category = GROUNDED_IMAGE_CATEGORIES.NATURAL_PHOTO;
  if (whiteRatio > 0.65 && textLineCount >= 10) {
    category = GROUNDED_IMAGE_CATEGORIES.DOCUMENT_TEXT;
  } else if (darkRatio > 0.45 && textLineCount >= 6) {
    category = GROUNDED_IMAGE_CATEGORIES.SCREENSHOT_UI;
  } else if (whiteRatio > 0.55 && avgSat > 0.12 && textLineCount < 10) {
    category = GROUNDED_IMAGE_CATEGORIES.CHART_GRAPH;
  } else if (whiteRatio > 0.70 && textLineCount < 10 && avgSat < 0.1) {
    category = GROUNDED_IMAGE_CATEGORIES.MATH_PROBLEM;
  } else if (avgSat > 0.35 && darkRatio < 0.3) {
    category = GROUNDED_IMAGE_CATEGORIES.NATURAL_PHOTO;
  }

  return {
    category,
    whiteRatio,
    darkRatio,
    avgSat,
    textLineCount,
    hasLeftSidebar,
    dimensions: { width: w, height: h },
  };
}

/**
 * Validates that a generated vision response contains meaningful, grounded details
 * and does not contain generic boilerplate filler.
 */
export function validateGroundedVisionResponse(response) {
  if (!response || typeof response !== 'string' || response.trim().length === 0) {
    return {
      isValid: false,
      error: 'Vision model produced an empty response.',
    };
  }

  // Reject generic filler phrases
  for (const pattern of FORBIDDEN_GENERIC_PATTERNS) {
    if (pattern.test(response)) {
      return {
        isValid: false,
        error: 'Generic ungrounded filler detected in vision response.',
      };
    }
  }

  // Reject responses that claim to be unable to see images when an image was provided
  const blindPhrases = [
    /(?:cannot|unable to|can't)\s+(?:see|view|analyze|process|understand).{0,25}images/i,
    /cannot (see|view|analyze)/i,
    /as a text-based ai/i,
    /i don't have eyes/i,
    /unable to view images/i,
  ];
  for (const pattern of blindPhrases) {
    if (pattern.test(response)) {
      return {
        isValid: false,
        error: 'Model incorrectly claimed blindness to visual input.',
      };
    }
  }

  return { isValid: true };
}

/**
 * Commonly hallucinated CV/Resume skills that models tend to invent from training priors.
 * Used to verify grounding and strictly block fabricated additions.
 */
export const COMMONLY_HALLUCINATED_SKILLS = [
  'c/c++',
  'c++',
  'java',
  'sql',
  'mysql',
  'pl/sql',
  'git',
  'github',
  'vscode',
  'vs code',
  'excel',
  'data structures and algorithms',
  'data structures & algorithms',
  'dsa',
  'oops',
  'oop',
  'object-oriented programming',
  'computer networks',
  'leadership',
  'adaptability',
  'perseverance',
  'hotel management system',
];

/**
 * Dynamic Document Evidence Extractor
 * Parses visible text into structured sections and builds a verified token index.
 * ZERO hardcoded assumptions: only extracts what is directly present in rawText.
 */
export function extractEvidenceFromDocument(rawText = '') {
  if (!rawText || typeof rawText !== 'string') {
    return {
      candidateName: null,
      contact: {},
      skills: [],
      projects: [],
      education: [],
      certificates: [],
      rawTokens: new Set(),
    };
  }

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const normalizedTokens = new Set(
    rawText
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );

  // Extract contact details
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const mobileMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const githubMatch = rawText.match(/github\.com\/([a-zA-Z0-9_-]+)/i) || rawText.match(/github:\s*([a-zA-Z0-9_-]+)/i);
  const linkedinMatch = rawText.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);

  // Extract candidate name from topmost prominent non-header line
  let candidateName = null;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (
      !line.includes('@') &&
      !line.includes('http') &&
      !line.includes(':') &&
      !/curriculum|resume|page|contact|skills/i.test(line) &&
      line.split(/\s+/).length <= 4 &&
      line.length >= 3 &&
      line.length <= 40
    ) {
      candidateName = line;
      break;
    }
  }

  // Section parsing based on common CV headings
  const sections = {};
  let currentSection = 'header';
  sections[currentSection] = [];

  const sectionHeadings = [
    { key: 'skills', regex: /^(?:technical\s+)?skills(?:\s+&\s+competencies)?\b/i },
    { key: 'projects', regex: /^(?:technical\s+)?projects?\b/i },
    { key: 'education', regex: /^education(?:al\s+qualifications)?\b/i },
    { key: 'certificates', regex: /^(?:certifications?|certificates?)\b/i },
    { key: 'experience', regex: /^(?:work\s+)?experience\b/i },
    { key: 'co_curricular', regex: /^(?:co-curricular|extracurricular|activities)\b/i },
  ];

  for (const line of lines) {
    let matchedHeading = null;
    if (!line.includes(':') && line.length < 40) {
      for (const h of sectionHeadings) {
        if (h.regex.test(line)) {
          matchedHeading = h.key;
          break;
        }
      }
    }

    if (matchedHeading) {
      currentSection = matchedHeading;
      if (!sections[currentSection]) sections[currentSection] = [];
    } else {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    }
  }

  // Extract verified skills from skills section or matching lines
  const verifiedSkills = [];
  const skillLines = sections.skills || [];
  for (const sLine of skillLines) {
    // Look for comma, slash, or pipe-separated items
    const parts = sLine
      .replace(/^(?:technical\s+skills|programming\s+languages|languages|databases|tools|frameworks|technologies|skills)\s*[:\-]\s*/i, '')
      .split(/[,|•\t]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 2 && p.length < 35);

    for (const part of parts) {
      // Clean leading bullet chars
      const cleaned = part.replace(/^[-*•\s]+/, '').trim();
      if (cleaned && !verifiedSkills.some((s) => s.toLowerCase() === cleaned.toLowerCase())) {
        verifiedSkills.push(cleaned);
      }
    }
  }

  // Extract verified projects
  const verifiedProjects = [];
  const projectLines = sections.projects || [];
  let currentProject = null;

  for (const pLine of projectLines) {
    // Project title lines usually don't start with a bullet, or contain dates/parentheses
    const isBullet = /^[-*•]/.test(pLine);
    if (!isBullet && pLine.length < 120 && !pLine.toLowerCase().startsWith('tech:')) {
      if (currentProject) {
        verifiedProjects.push(currentProject);
      }
      currentProject = {
        title: pLine.replace(/\s*\([^)]*\)\s*$/, '').trim(),
        fullTitle: pLine,
        points: [],
        technologies: [],
      };
    } else if (currentProject) {
      if (pLine.toLowerCase().includes('tech') && pLine.includes(':')) {
        const techStr = pLine.split(':')[1] || '';
        currentProject.technologies = techStr
          .split(/[,|•]/)
          .map((t) => t.trim())
          .filter(Boolean);
      } else {
        currentProject.points.push(pLine.replace(/^[-*•\s]+/, '').trim());
      }
    }
  }
  if (currentProject) {
    verifiedProjects.push(currentProject);
  }

  return {
    candidateName,
    contact: {
      email: emailMatch ? emailMatch[0] : null,
      mobile: mobileMatch ? mobileMatch[0] : null,
      github: githubMatch ? githubMatch[1] : null,
      linkedin: linkedinMatch ? linkedinMatch[1] : null,
    },
    skills: verifiedSkills,
    projects: verifiedProjects,
    education: sections.education || [],
    certificates: sections.certificates || [],
    rawTokens: normalizedTokens,
  };
}

/**
 * Filters out hallucinated skills by verifying that every skill is grounded in document tokens.
 */
export function filterHallucinatedSkills(claimedSkills = [], verifiedTokens = new Set()) {
  return claimedSkills.filter((skill) => {
    const normalized = skill.toLowerCase().replace(/[^a-z0-9+#.]/g, ' ').trim();
    const words = normalized.split(/\s+/).filter(Boolean);
    // If every significant word in the skill name exists in verified tokens, it is grounded
    return words.every((w) => verifiedTokens.has(w));
  });
}

/**
 * Validates that an extracted/generated document analysis contains NO ungrounded fabricated skills.
 * If hallucinated skills are detected in the candidate's reported qualifications, returns an error.
 */
export function detectDocumentHallucinations(generatedContent, verifiedTokens = new Set()) {
  const issues = [];
  const lowerContent = (generatedContent || '').toLowerCase();

  // Extract the "Extracted Information" or "Qualifications" portion (before recommendations)
  const recommendationIdx = lowerContent.indexOf('recommendation');
  const factsSection = recommendationIdx !== -1 ? lowerContent.slice(0, recommendationIdx) : lowerContent;

  for (const fabricatedSkill of COMMONLY_HALLUCINATED_SKILLS) {
    const skillWords = fabricatedSkill.replace(/[^a-z0-9+#.]/g, ' ').split(/\s+/).filter(Boolean);
    const isPresentInDoc = skillWords.every((w) => verifiedTokens.has(w));

    if (!isPresentInDoc) {
      // Check if it appears in the facts section
      const regex = new RegExp(`\\b${fabricatedSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(factsSection)) {
        issues.push(`Fabricated skill "${fabricatedSkill}" claimed in qualifications without document evidence.`);
      }
    }
  }

  return {
    hasHallucinations: issues.length > 0,
    issues,
  };
}

/**
 * Generates an honest, grounded failure notice if vision understanding cannot complete.
 * NEVER outputs invented or fabricated visual content.
 */
export function formatVisionFailureMessage(errorReason = 'Visual feature extraction could not be verified.') {
  return `⚠️ **Image Understanding Notice**\n\n` +
    `OmniAI's on-device vision model could not extract sufficient grounded visual features from the uploaded image.\n\n` +
    `- **Reason**: ${errorReason}\n` +
    `- **Recommendation**: Please ensure the image is high-resolution, correctly oriented, and has adequate lighting or contrast. Avoid using blurry, truncated, or low-contrast captures.`;
}
