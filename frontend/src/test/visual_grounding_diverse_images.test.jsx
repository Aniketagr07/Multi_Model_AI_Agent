import { describe, it, expect, beforeEach } from 'vitest';
import LocalModelProvider from '../services/localInference';
import {
  analyzeRawImagePixels,
  validateGroundedVisionResponse,
  formatVisionFailureMessage,
  GROUNDED_IMAGE_CATEGORIES,
  FORBIDDEN_GENERIC_PATTERNS,
  extractEvidenceFromDocument,
  filterHallucinatedSkills,
  detectDocumentHallucinations,
} from '../services/visualGrounding';
import { detectImageIntent, solveVisualTask, VISUAL_TASK_CATEGORIES } from '../services/visualIntelligence';

describe('Advanced Visual Grounding & Diverse Image Testing Suite', () => {
  beforeEach(() => {
    LocalModelProvider.setMockMode(true);
    LocalModelProvider.visionModel.clearImageContext();
  });

  // --------------------------------------------------------------------------
  // TEST 1: User's Uploaded CV (Aniket Agarwal)
  // --------------------------------------------------------------------------
  it('Image 1 - User CV: independently identifies candidate, sections, projects, and skills without generic filler', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'Describe and analyze what is visible in this image.' }],
      image: 'fixtures/aniket_agarwal_cv.png',
      modelId: 'qwen2.5-vl-3b',
    });

    const content = result.content;

    // A. Verify ABSOLUTE ZERO generic filler phrases
    for (const pattern of FORBIDDEN_GENERIC_PATTERNS) {
      expect(pattern.test(content)).toBe(false);
    }
    expect(content).not.toContain('balanced focal points');
    expect(content).not.toContain('subject-background separation');
    expect(content).not.toContain('Spatial orientation and lighting emphasize');

    // B. Verify Image-Grounded Validation succeeds
    const validation = validateGroundedVisionResponse(content);
    expect(validation.isValid).toBe(true);

    // C. Verify genuine document grounding for Aniket Agarwal's CV
    expect(content).toContain('Aniket Agarwal');
    expect(content).toContain('Lovely Professional University');
    expect(content).toContain('Voice-Controlled Appliance Controller');
    expect(content).not.toContain('Hotel Management System'); // Phantom project MUST NOT be present
    expect(content).toMatch(/Python/i);
    expect(content).toMatch(/DBMS/i);
    expect(content).not.toContain('C/C++'); // Hallucinated skills MUST NOT be present
    expect(content).not.toContain('MySQL');
    expect(content).toMatch(/8\.4/); // CGPA
    expect(content).toContain('Stage A: Extracted Information (Identified Section Breakdown)');
    expect(content).toContain('Stage B: Intelligent Analysis');
    expect(content).toContain('Stage C: Actionable Recommendations');
    expect(content).not.toContain('Candidate Identified in Document');
    expect(content).not.toContain('page background cleanliness');
  });

  // --------------------------------------------------------------------------
  // TEST 1.1 - 1.7: Specific User Verification Questions on Uploaded CV
  // --------------------------------------------------------------------------
  it('Image 1.1 - User CV: Q1: What is the candidate\'s name? -> answers directly', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: "What is the candidate's name?" }],
      image: 'fixtures/aniket_agarwal_cv.png',
      modelId: 'qwen2.5-vl-3b',
    });
    expect(result.content).toContain('Aniket Agarwal');
    expect(result.content).toContain('Lovely Professional University');
    expect(result.content).not.toContain('Stage A: Extracted Information'); // Direct conversational answer!
  });

  it('Image 1.2 - User CV: Q2: Which programming languages and technical skills are listed? -> answers directly with verified skills only', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'Which programming languages and technical skills are listed?' }],
      image: 'fixtures/aniket_agarwal_cv.png',
      modelId: 'qwen2.5-vl-3b',
    });
    // Authentic skills visible on the CV
    expect(result.content).toContain('Python');
    expect(result.content).toContain('HTML');
    expect(result.content).toContain('CSS');
    expect(result.content).toContain('JavaScript');
    expect(result.content).toContain('DBMS');

    // Fabricated skills MUST NOT be reported
    expect(result.content).not.toContain('C/C++');
    expect(result.content).not.toMatch(/\bJava\b(?!Script)/i);
    expect(result.content).not.toContain('MySQL');
    expect(result.content).not.toContain('PL/SQL');
    expect(result.content).not.toContain('VSCode');
    expect(result.content).not.toContain('Excel');
  });

  it('Image 1.3 - User CV: Q3: What project has the candidate completed? -> answers directly with verified projects only', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'What project has the candidate completed?' }],
      image: 'fixtures/aniket_agarwal_cv.png',
      modelId: 'qwen2.5-vl-3b',
    });
    expect(result.content).toContain('Voice-Controlled Appliance Controller');
    expect(result.content).not.toContain('Hotel Management System');
    expect(result.content).toContain('Dec 2025');
  });

  it('Image 1.4 - User CV: Q4: Which technologies were used in that project? -> answers directly', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'Which technologies were used in that project?' }],
      image: 'fixtures/aniket_agarwal_cv.png',
      modelId: 'qwen2.5-vl-3b',
    });
    expect(result.content).toContain('ESP32');
    expect(result.content).toContain('MQTT');
    expect(result.content).toContain('IFTTT');
    expect(result.content).toContain('Google Assistant API');
    expect(result.content).toContain('Alexa Skills');
    expect(result.content).toContain('Relay Modules');
    expect(result.content).toContain('IoT Security');
  });

  it('Image 1.5 - User CV: Q5: What are the strongest aspects of this CV? -> answers directly', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'What are the strongest aspects of this CV?' }],
      image: 'fixtures/aniket_agarwal_cv.png',
      modelId: 'qwen2.5-vl-3b',
    });
    expect(result.content).toContain('Key Strengths of this CV');
    expect(result.content).toContain('ESP32');
    expect(result.content).toContain('8.4 CGPA');
    expect(result.content).toContain('Developer vs Hacker Hackathon');
    expect(result.content).not.toContain('Hotel Management');
  });

  it('Image 1.6 - User CV: Q6: What specific improvements would help this candidate apply for an AI/ML internship? -> answers directly', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'What specific improvements would help this candidate apply for an AI/ML internship?' }],
      image: 'fixtures/aniket_agarwal_cv.png',
      modelId: 'qwen2.5-vl-3b',
    });
    expect(result.content).toContain('Targeted Recommendations for AI/ML Internships');
    expect(result.content).toContain('Applied Machine Learning Project');
    expect(result.content).toContain('NumPy, Pandas, Scikit-Learn');
    expect(result.content).toContain('Quantify the ESP32 IoT Project');
  });

  // --------------------------------------------------------------------------
  // TEST 1.7: Exact User Prompt: "Analyze my CV. What are my strongest technical skills, what project have I completed, and what improvements would you recommend for an AI/ML internship?"
  // --------------------------------------------------------------------------
  it('Image 1.7 - User CV: Exact User Prompt verifies ONLY actual skills, project, and separate recommendations', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{
        role: 'user',
        content: 'Analyze my CV. What are my strongest technical skills, what project have I completed, and what improvements would you recommend for an AI/ML internship?'
      }],
      image: 'fixtures/aniket_agarwal_cv.png',
      modelId: 'qwen2.5-vl-3b',
    });

    const content = result.content;

    // 1. Verify authentic visible skills are present
    expect(content).toContain('Python');
    expect(content).toContain('HTML');
    expect(content).toContain('CSS');
    expect(content).toContain('JavaScript');
    expect(content).toContain('DBMS');

    // 2. Verify fabricated skills are ABSOLUTELY ABSENT from qualifications
    expect(content).not.toContain('C/C++');
    expect(content).not.toMatch(/\bJava\b(?!Script)/i);
    expect(content).not.toContain('MySQL');
    expect(content).not.toContain('PL/SQL');
    expect(content).not.toContain('VS Code');
    expect(content).not.toContain('VSCode');
    expect(content).not.toContain('Excel');
    expect(content).not.toContain('Data Structures and Algorithms');
    expect(content).not.toContain('Data Structures & Algorithms');
    expect(content).not.toContain('Computer Networks');
    expect(content).not.toContain('Leadership');
    expect(content).not.toContain('Adaptability');
    expect(content).not.toContain('Perseverance');
    expect(content).not.toContain('Hotel Management System');

    // 3. Verify project details match the document
    expect(content).toContain('Voice-Controlled Appliance Controller');
    expect(content).toContain('ESP32');
    expect(content).toContain('MQTT');
    expect(content).toContain('IFTTT');
    expect(content).toContain('Google Assistant API');
    expect(content).toContain('Alexa Skills');
    expect(content).toContain('Relay Modules');
    expect(content).toContain('Embedded C');
    expect(content).toContain('IoT Security');

    // 4. Verify recommendations are distinctly separated
    expect(content).toContain('Actionable Recommendations for an AI/ML Internship');
    expect(content).toMatch(/PyTorch|TensorFlow/i);
  });

  // --------------------------------------------------------------------------
  // TEST 1.8: Context Isolation - Unrelated Image does NOT leak CV details
  // --------------------------------------------------------------------------
  it('Image 1.8 - Context Isolation: new unrelated image cleans previous CV context', async () => {
    // Submit math query with a different image
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'Solve for x: 3x - 9 = 0' }],
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      modelId: 'qwen2.5-vl-3b',
    });

    expect(result.content).not.toContain('Aniket Agarwal');
    expect(result.content).not.toContain('Lovely Professional University');
    expect(result.content).not.toContain('ESP32');
  });

  // --------------------------------------------------------------------------
  // TEST 1.9: Business Communication Screenshot - Zoom Product Demo Follow-up Email
  // --------------------------------------------------------------------------
  it('Image 1.9 - Business Communication Task: drafts professional email answering user prompt without CV contamination', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'Tell me the answer to the question.' }],
      image: {
        name: 'zoom_meeting_email_task_screenshot.png',
        dataUrl: 'data:image/png;base64,zoom_task_demo_screenshot_dummy_data',
      },
      modelId: 'qwen2.5-vl-3b',
    });

    const content = result.content;

    // 1. Verify it drafts the professional business email
    expect(content).toContain('Professional Business Follow-Up Email');
    expect(content).toContain('Subject');
    expect(content).toContain('Zoom');
    expect(content).toContain('product demonstration');
    expect(content).toContain('feedback');
    expect(content).toContain('quotation tomorrow');
    expect(content).toContain('Task Fulfillment & Breakdown');

    // 2. CRITICAL ISOLATION CHECK: ZERO CV DETAILS MUST BE PRESENT
    expect(content).not.toContain('Aniket Agarwal');
    expect(content).not.toContain('Lovely Professional University');
    expect(content).not.toContain('Voice-Controlled Appliance Controller');
    expect(content).not.toContain('ESP32');
    expect(content).not.toContain('8.4 CGPA');
    expect(content).not.toContain('Python, HTML, CSS, JavaScript, DBMS');
    expect(content).not.toContain('Comprehensive CV & Resume Evaluation');
    expect(content).not.toContain('Stage A: Extracted Information');
  });

  // --------------------------------------------------------------------------
  // TEST 1.10: Consecutive Multi-Image Conversation (Zero Cross-Image Contamination)
  // --------------------------------------------------------------------------
  it('Image 1.10 - Consecutive Multi-Image Session: CV -> Email Task -> Concise Follow-up -> Math -> Circuit', async () => {
    // TURN 1: Upload CV
    const turn1Result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'Analyze my CV.' }],
      image: 'fixtures/aniket_agarwal_cv.png',
      modelId: 'qwen2.5-vl-3b',
    });
    expect(turn1Result.content).toContain('Aniket Agarwal');
    expect(turn1Result.content).toContain('Voice-Controlled Appliance Controller');

    // TURN 2: In the SAME session, upload Zoom Meeting Email Task with generic user prompt
    const turn2Result = await LocalModelProvider.streamResponse({
      messages: [
        { role: 'user', content: 'Analyze my CV.' },
        { role: 'assistant', content: turn1Result.content },
        { role: 'user', content: 'Tell me the answer to the question.' },
      ],
      image: {
        name: 'client_zoom_meeting_demo.png',
        dataUrl: 'data:image/png;base64,zoom_meeting_screenshot',
      },
      modelId: 'qwen2.5-vl-3b',
    });

    // Verify Turn 2 strictly answers the email task and contains ZERO CV details
    expect(turn2Result.content).toContain('Professional Business Follow-Up Email');
    expect(turn2Result.content).toContain('Zoom');
    expect(turn2Result.content).toContain('quotation tomorrow');
    expect(turn2Result.content).not.toContain('Aniket Agarwal');
    expect(turn2Result.content).not.toContain('ESP32');
    expect(turn2Result.content).not.toContain('Lovely Professional University');

    // TURN 3: Follow-up question on Turn 2 without uploading an image
    const turn3Result = await LocalModelProvider.streamResponse({
      messages: [
        { role: 'user', content: 'Tell me the answer to the question.' },
        { role: 'assistant', content: turn2Result.content },
        { role: 'user', content: 'Make it more concise.' },
      ],
      image: null, // Legitimate follow-up referencing active image context!
      modelId: 'qwen2.5-vl-3b',
    });

    // Verify Turn 3 refines the email, still ZERO CV details
    expect(turn3Result.content).toContain('concise, executive-ready version');
    expect(turn3Result.content).toContain('Zoom');
    expect(turn3Result.content).not.toContain('Aniket Agarwal');
    expect(turn3Result.content).not.toContain('ESP32');

    // TURN 4: Upload Math Equation
    const turn4Result = await LocalModelProvider.streamResponse({
      messages: [
        { role: 'user', content: 'Solve this equation.' },
      ],
      image: {
        name: 'math_equation_solve_x.png',
        dataUrl: 'data:image/png;base64,math_equation_data',
      },
      modelId: 'qwen2.5-vl-3b',
    });
    expect(turn4Result.content).toContain('Mathematics Problem Solving');
    expect(turn4Result.content).not.toContain('Zoom');
    expect(turn4Result.content).not.toContain('Aniket Agarwal');

    // TURN 5: Upload Circuit Diagram
    const turn5Result = await LocalModelProvider.streamResponse({
      messages: [
        { role: 'user', content: 'Explain this circuit schematic.' },
      ],
      image: {
        name: 'opamp_circuit_schematic.png',
        dataUrl: 'data:image/png;base64,circuit_diagram_data',
      },
      modelId: 'qwen2.5-vl-3b',
    });
    expect(turn5Result.content).toContain('Technical Architecture & Diagram Analysis');
    expect(turn5Result.content).toContain('LM741');
    expect(turn5Result.content).not.toContain('Zoom');
    expect(turn5Result.content).not.toContain('Aniket Agarwal');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Natural Photograph
  // --------------------------------------------------------------------------
  it('Image 2 - Natural Photograph: describes environmental scene, lighting, and objects without filler', async () => {
    const mockPhotoContext = {
      dimensions: { width: 1920, height: 1080 },
      detailedCaption: 'A scenic landscape photograph of snow-capped mountain peaks bathed in golden sunset light with an alpine pine forest in the foreground.',
      extractedText: '',
      metrics: {
        category: GROUNDED_IMAGE_CATEGORIES.NATURAL_PHOTO,
        whiteRatio: 0.15,
        darkRatio: 0.20,
        avgSat: 0.45,
        textLineCount: 0,
        hasLeftSidebar: false,
      },
    };

    const taskResult = solveVisualTask({
      intent: VISUAL_TASK_CATEGORIES.IMAGE_INSIGHTS,
      userPrompt: 'What scenery and natural elements are shown here?',
      ocrText: mockPhotoContext.extractedText,
      visualCaption: mockPhotoContext.detailedCaption,
      dimensions: mockPhotoContext.dimensions,
      metrics: mockPhotoContext.metrics,
    });

    // Zero generic filler
    for (const pattern of FORBIDDEN_GENERIC_PATTERNS) {
      expect(pattern.test(taskResult)).toBe(false);
    }
    expect(taskResult).toContain('mountain peaks bathed in golden sunset light');
    expect(taskResult).toContain('1920 × 1080 px');
    expect(validateGroundedVisionResponse(taskResult).isValid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Image Containing Several Objects
  // --------------------------------------------------------------------------
  it('Image 3 - Multi-Object Scene: identifies distinct items and spatial relationships', async () => {
    const multiObjectCaption = 'A modern desk workspace containing a silver laptop, ceramic coffee mug, wireless mouse, leather notebook, and a potted succulent plant.';
    const taskResult = solveVisualTask({
      intent: VISUAL_TASK_CATEGORIES.IMAGE_INSIGHTS,
      userPrompt: 'List all items present on the desk.',
      ocrText: '',
      visualCaption: multiObjectCaption,
      dimensions: { width: 1200, height: 800 },
      metrics: {
        category: GROUNDED_IMAGE_CATEGORIES.OBJECTS_SCENE,
        whiteRatio: 0.25,
        darkRatio: 0.25,
        avgSat: 0.30,
        textLineCount: 0,
      },
    });

    expect(taskResult).toContain('silver laptop, ceramic coffee mug, wireless mouse');
    expect(taskResult).not.toContain('balanced focal points');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Circuit Diagram
  // --------------------------------------------------------------------------
  it('Image 4 - Circuit Diagram: explains schematic components, interconnects, and circuit logic', async () => {
    const circuitCaption = 'An electronic circuit diagram featuring an operational amplifier (LM741), 10k feedback resistor, 5V DC power rail, and output load.';
    const circuitOcr = 'V_in = 2V\nR1 = 1k Ohm\nRf = 10k Ohm\nV_out = -Rf/R1 * V_in\nLM741';

    const intent = detectImageIntent('Analyze this circuit diagram and explain the operational amplifier setup.', circuitOcr, circuitCaption);
    expect(intent).toBe(VISUAL_TASK_CATEGORIES.DIAGRAM_CS);

    const taskResult = solveVisualTask({
      intent,
      userPrompt: 'Analyze this circuit diagram and explain the operational amplifier setup.',
      ocrText: circuitOcr,
      visualCaption: circuitCaption,
      dimensions: { width: 900, height: 600 },
    });

    expect(taskResult).toContain('Technical Architecture & Diagram Analysis');
    expect(taskResult).toContain('LM741');
    expect(taskResult).toContain('Core Entities');
    expect(taskResult).not.toContain('balanced focal points');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Mathematical Question
  // --------------------------------------------------------------------------
  it('Image 5 - Mathematical Question: solves equation step-by-step with formulas and final answer', async () => {
    const mathOcr = 'Solve for x:\n2x + 7 = 19';
    const intent = detectImageIntent('Solve this math question step by step.', mathOcr, 'Math equation');
    expect(intent).toBe(VISUAL_TASK_CATEGORIES.MATHEMATICS);

    const taskResult = solveVisualTask({
      intent,
      userPrompt: 'Solve this math question step by step.',
      ocrText: mathOcr,
      visualCaption: 'Algebraic linear equation',
      dimensions: { width: 800, height: 400 },
    });

    expect(taskResult).toContain('Mathematics Problem Solving');
    expect(taskResult).toContain('### Solution & Step-by-Step Reasoning');
    expect(taskResult).toContain('### Final Answer');
    expect(taskResult).not.toContain('balanced focal points');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Programming Problem
  // --------------------------------------------------------------------------
  it('Image 6 - Programming Problem: writes algorithm, code solution, and time/space complexity', async () => {
    const codeOcr = 'def two_sum(nums, target):\n    # Find indices of two numbers that add up to target\n    seen = {}\n    for i, num in enumerate(nums):';
    const intent = detectImageIntent('Write code to solve this leetcode problem.', codeOcr, 'Code editor screenshot');
    expect(intent).toBe(VISUAL_TASK_CATEGORIES.PROGRAMMING);

    const taskResult = solveVisualTask({
      intent,
      userPrompt: 'Write code to solve this leetcode problem.',
      ocrText: codeOcr,
      visualCaption: 'Python programming function',
      dimensions: { width: 1024, height: 600 },
    });

    expect(taskResult).toContain('Programming Problem Solution');
    expect(taskResult).toContain('def solution(');
    expect(taskResult).toContain('Time Complexity');
    expect(taskResult).toContain('Space Complexity');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Graph / Chart
  // --------------------------------------------------------------------------
  it('Image 7 - Graph: analyzes axes, trends, percentage variance, and peak values', async () => {
    const chartCaption = 'A quarterly revenue bar chart comparing Q1 to Q4 sales across North America, Europe, and Asia.';
    const chartOcr = 'Q1: $12M | Q2: $18M | Q3: $25M | Q4: $32M\nGrowth: +166%';

    const intent = detectImageIntent('What is the trend shown in this chart?', chartOcr, chartCaption);
    expect(intent).toBe(VISUAL_TASK_CATEGORIES.CHART_GRAPH);

    const taskResult = solveVisualTask({
      intent,
      userPrompt: 'What is the trend shown in this chart?',
      ocrText: chartOcr,
      visualCaption: chartCaption,
      dimensions: { width: 1100, height: 700 },
    });

    expect(taskResult).toContain('Chart & Graph Analytical Interpretation');
    expect(taskResult).toContain('Key Observations & Trends');
    expect(taskResult).toContain('Quantitative Insights');
    expect(taskResult).not.toContain('balanced focal points');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Software Screenshot / Error
  // --------------------------------------------------------------------------
  it('Image 8 - Software Screenshot: diagnoses error code, stack trace, and resolution steps', async () => {
    const errorOcr = 'TypeError: Cannot read properties of undefined (reading Symbol.iterator)\n  at ImageProcessor.preprocess (transformers.node.cjs:21377:35)';
    const intent = detectImageIntent('How can I fix this runtime error?', errorOcr, 'Console traceback');
    expect(intent).toBe(VISUAL_TASK_CATEGORIES.SCREENSHOT_ERROR);

    const taskResult = solveVisualTask({
      intent,
      userPrompt: 'How can I fix this runtime error?',
      ocrText: errorOcr,
      visualCaption: 'Terminal error screen',
      dimensions: { width: 1200, height: 600 },
    });

    expect(taskResult).toContain('Screenshot & Error Diagnostic Report');
    expect(taskResult).toContain('Root Cause Analysis');
    expect(taskResult).toContain('Step-by-Step Resolution');
  });

  // --------------------------------------------------------------------------
  // TEST 9: Animal Photograph
  // --------------------------------------------------------------------------
  it('Image 9 - Animal Photograph: accurately notes biological traits and scene without filler', async () => {
    const animalCaption = 'A high-resolution wildlife photograph of a Bengal tiger resting near a forest waterhole with dense tropical foliage.';
    const taskResult = solveVisualTask({
      intent: VISUAL_TASK_CATEGORIES.IMAGE_INSIGHTS,
      userPrompt: 'Describe the animal in this photo and its environment.',
      ocrText: '',
      visualCaption: animalCaption,
      dimensions: { width: 1600, height: 1000 },
      metrics: {
        category: GROUNDED_IMAGE_CATEGORIES.ANIMAL_PHOTO,
        whiteRatio: 0.05,
        darkRatio: 0.30,
        avgSat: 0.55,
        textLineCount: 0,
      },
    });

    expect(taskResult).toContain('Bengal tiger resting near a forest waterhole');
    expect(taskResult).not.toContain('balanced focal points');
    expect(validateGroundedVisionResponse(taskResult).isValid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 10: Illustration
  // --------------------------------------------------------------------------
  it('Image 10 - Illustration: identifies artistic medium, vector composition, and color palette', async () => {
    const illustrationCaption = 'A vibrant flat-vector illustration of an astronaut floating among celestial planets, stars, and cosmic nebulae in deep purple hues.';
    const taskResult = solveVisualTask({
      intent: VISUAL_TASK_CATEGORIES.IMAGE_INSIGHTS,
      userPrompt: 'What artistic style and subject are depicted in this illustration?',
      ocrText: '',
      visualCaption: illustrationCaption,
      dimensions: { width: 1000, height: 1000 },
      metrics: {
        category: GROUNDED_IMAGE_CATEGORIES.ILLUSTRATION,
        whiteRatio: 0.10,
        darkRatio: 0.60,
        avgSat: 0.50,
        textLineCount: 0,
      },
    });

    expect(taskResult).toContain('astronaut floating among celestial planets');
    expect(taskResult).not.toContain('balanced focal points');
    expect(validateGroundedVisionResponse(taskResult).isValid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Response Grounding Validator Unit Tests
  // --------------------------------------------------------------------------
  it('Validator: catches and rejects all forbidden generic phrases', () => {
    const genericResponse1 = 'Scene Composition: The visual arrangement demonstrates balanced focal points and clear subject-background separation.\nVisual Details: Spatial orientation and lighting emphasize the primary elements within the scene.';
    expect(validateGroundedVisionResponse(genericResponse1).isValid).toBe(false);
    expect(validateGroundedVisionResponse(genericResponse1).error).toContain('Generic ungrounded filler');

    const blindResponse = "I am a text-based AI and cannot see or analyze images.";
    expect(validateGroundedVisionResponse(blindResponse).isValid).toBe(false);
    expect(validateGroundedVisionResponse(blindResponse).error).toContain('claimed blindness');

    const validResponse = "This image is a Curriculum Vitae for Aniket Agarwal, an undergraduate student at Lovely Professional University.";
    expect(validateGroundedVisionResponse(validResponse).isValid).toBe(true);
  });

  it('Pixel Analyzer: reliably distinguishes between document, screenshot, and photo', () => {
    // 1. Synthetic white document with text lines
    const docImage = {
      width: 100,
      height: 100,
      channels: 3,
      data: new Uint8Array(100 * 100 * 3).fill(250), // All white
    };
    // Draw 20 dark lines (text lines, each 2px thick as in real documents)
    for (let y = 6; y < 85; y += 4) {
      for (let dy = 0; dy < 2; dy++) {
        for (let x = 10; x < 90; x++) {
          const idx = ((y + dy) * 100 + x) * 3;
          docImage.data[idx] = 20;
          docImage.data[idx + 1] = 20;
          docImage.data[idx + 2] = 20;
        }
      }
    }
    const docMetrics = analyzeRawImagePixels(docImage);
    expect(docMetrics.category).toBe(GROUNDED_IMAGE_CATEGORIES.DOCUMENT_CV);
    expect(docMetrics.textLineCount).toBeGreaterThanOrEqual(10);

    // 2. Synthetic dark UI screenshot
    const darkImage = {
      width: 100,
      height: 100,
      channels: 3,
      data: new Uint8Array(100 * 100 * 3).fill(15), // All dark
    };
    for (let y = 10; y < 70; y += 5) {
      for (let x = 15; x < 85; x++) {
        const idx = (y * 100 + x) * 3;
        darkImage.data[idx] = 180;
        darkImage.data[idx + 1] = 180;
        darkImage.data[idx + 2] = 180;
      }
    }
    const darkMetrics = analyzeRawImagePixels(darkImage);
    expect(darkMetrics.category).toBe(GROUNDED_IMAGE_CATEGORIES.SCREENSHOT_UI);
  });

  // --------------------------------------------------------------------------
  // Document Evidence Grounding & Hallucination Prevention Unit Tests
  // --------------------------------------------------------------------------
  it('Evidence Extractor: dynamically parses sections and builds verified token set', () => {
    const rawCvText = `Aniket Agarwal\nUndergraduate\nEmail: aniket.agr2007@gmail.com\n\nSKILLS\nTechnical Skills: Python, HTML, CSS, JavaScript, DBMS\n\nPROJECTS\nVoice-Controlled Appliance Controller using Google Assistant (Dec 2025)\n- Developed IoT system with ESP32.\n- Tech: ESP32, Arduino Framework, MQTT, IFTTT, Embedded C, IoT Security\n\nEDUCATION\nLovely Professional University | CGPA: 8.4`;
    const evidence = extractEvidenceFromDocument(rawCvText);

    expect(evidence.candidateName).toBe('Aniket Agarwal');
    expect(evidence.contact.email).toBe('aniket.agr2007@gmail.com');
    expect(evidence.skills).toContain('Python');
    expect(evidence.skills).toContain('HTML');
    expect(evidence.skills).toContain('CSS');
    expect(evidence.skills).toContain('JavaScript');
    expect(evidence.skills).toContain('DBMS');
    expect(evidence.skills).not.toContain('C/C++');
    expect(evidence.skills).not.toContain('Java');
    expect(evidence.skills).not.toContain('MySQL');
    expect(evidence.projects[0].title).toContain('Voice-Controlled Appliance Controller');
    expect(evidence.projects[0].technologies).toContain('ESP32');
    expect(evidence.projects[0].technologies).toContain('IoT Security');
  });

  it('Hallucination Filter: eliminates ungrounded skills from candidate claims', () => {
    const verifiedTokens = new Set(['python', 'html', 'css', 'javascript', 'dbms']);
    const claimedSkills = ['Python', 'C/C++', 'Java', 'HTML', 'MySQL', 'DBMS'];

    const filtered = filterHallucinatedSkills(claimedSkills, verifiedTokens);
    expect(filtered).toEqual(['Python', 'HTML', 'DBMS']);
    expect(filtered).not.toContain('C/C++');
    expect(filtered).not.toContain('Java');
    expect(filtered).not.toContain('MySQL');
  });

  it('Hallucination Detector: detects unverified skills claimed in qualifications', () => {
    const verifiedTokens = new Set(['python', 'html', 'css', 'javascript', 'dbms']);

    const validText = `### Extracted Information\n- Verified Skills: Python, HTML, CSS, JavaScript, DBMS\n### Recommendations\n1. Learn PyTorch and C++ for AI/ML.`;
    const detectionValid = detectDocumentHallucinations(validText, verifiedTokens);
    expect(detectionValid.hasHallucinations).toBe(false);

    const hallucinatedText = `### Extracted Information\n- Candidate knows C/C++, Java, and MySQL.\n### Recommendations\n1. Strengthen project portfolio.`;
    const detectionInvalid = detectDocumentHallucinations(hallucinatedText, verifiedTokens);
    expect(detectionInvalid.hasHallucinations).toBe(true);
    expect(detectionInvalid.issues.length).toBeGreaterThan(0);
  });
});
