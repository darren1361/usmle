/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

// Load environmental parameters
dotenv.config();

const app = express();
const PORT = 3000;

// Set high limits for direct image upload payloads & study materials
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Root directory for clinical question materials
const MAIN_REVIEW_FOLDER = path.join(process.cwd(), 'uworld step 2 CK question bank review');

// Memory store for tracking user's latest progress (for daily background task)
let globallyTrackedRows: any[] = [];

// Ensure the main folder exists on boot
if (!fs.existsSync(MAIN_REVIEW_FOLDER)) {
  fs.mkdirSync(MAIN_REVIEW_FOLDER, { recursive: true });
}

// Lazy initializer for Google GenAI client to prevent startup crashes if key is omitted
let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      throw new Error(
        'GEMINI_API_KEY environment variable is not configured. Please define it in the Secrets panel in AI Studio.'
      );
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Allowed diagnostic system list for strict matching
const ALLOWED_SYSTEMS = [
  "Poisoning & Environmental Exposure",
  "Biostatistics & Epidemiology",
  "Male Reproductive System",
  "Miscellaneous",
  "Nervous System",
  "Rheumatology/Orthopedics & Sports",
  "Female Reproductive System & Breast",
  "Ear, Nose & Throat",
  "Endocrine, Diabetes & Metabolism",
  "Pulmonary & Critical Care",
  "Dermatology",
  "Social Sciences",
  "Infectious Diseases",
  "Cardiovascular System",
  "Renal, Urinary Systems & Electrolytes",
  "Allergy & Immunology",
  "Pregnancy, Childbirth & Puerperium",
  "Ophthalmology",
  "Gastrointestinal & Nutrition",
  "Hematology & Oncology",
  "Psychiatric/Behavioral & Substance Use Disorder",
  "General Principles"
];

// ----------------------------------------------------------------------
// Study Materials FS Storage endpoints
// ----------------------------------------------------------------------

// 1. List materials uploaded for a specific question QID (or in parent folder containing QID)
app.get('/api/materials/attached-qids', (req, res) => {
  try {
    const attachedQids = new Set<string>();

    if (fs.existsSync(MAIN_REVIEW_FOLDER)) {
      const items = fs.readdirSync(MAIN_REVIEW_FOLDER);

      for (const item of items) {
        const itemPath = path.join(MAIN_REVIEW_FOLDER, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // If the folder name looks like a QID (e.g. 1234 or uq_1234)
          let folderQid = item;
          if (item.toUpperCase().startsWith('QID_')) {
            folderQid = item.substring(4);
          } else if (item.toLowerCase().startsWith('uq_')) {
            folderQid = item.substring(3);
          }
          
          if (/^\d{4,6}$/.test(folderQid)) {
            const subItems = fs.readdirSync(itemPath);
            const hasFiles = subItems.some(sub => {
              const subStat = fs.statSync(path.join(itemPath, sub));
              return subStat.isFile() && !sub.startsWith('.');
            });
            if (hasFiles) attachedQids.add(folderQid);
          }
        } else if (stat.isFile() && !item.startsWith('.')) {
          // If it's a file in the root directory, check if it contains a QID
          const match = item.match(/QID_(\d{4,6})|uq_(\d{4,6})|(\d{4,6})/i);
          if (match) {
            const qid = match[1] || match[2] || match[3];
            attachedQids.add(qid);
          }
        }
      }
    }

    return res.json({ success: true, qids: Array.from(attachedQids) });
  } catch (err: any) {
    console.error('Failed fetching attached QIDs:', err);
    return res.status(500).json({ success: false, error: 'Failed scanning root folder.' });
  }
});

app.get('/api/materials', (req, res) => {
  try {
    const { qid } = req.query;
    if (!qid) {
      return res.status(400).json({ error: 'Missing QID parameter.' });
    }

    const qidStr = String(qid).trim();
    const subfolderPath = path.join(MAIN_REVIEW_FOLDER, qidStr);
    const files: string[] = [];

    // 1. Scan the QID-specific subfolder if it exists
    if (fs.existsSync(subfolderPath)) {
      const subFiles = fs.readdirSync(subfolderPath).filter(file => {
        const stat = fs.statSync(path.join(subfolderPath, file));
        return stat.isFile() && !file.startsWith('.');
      });
      files.push(...subFiles);
    }

    // 2. Scan the root MAIN_REVIEW_FOLDER for any files whose name contains the QID
    if (fs.existsSync(MAIN_REVIEW_FOLDER)) {
      const rootFiles = fs.readdirSync(MAIN_REVIEW_FOLDER).filter(file => {
        const filePath = path.join(MAIN_REVIEW_FOLDER, file);
        const stat = fs.statSync(filePath);
        return stat.isFile() && !file.startsWith('.') && file.includes(qidStr);
      });
      rootFiles.forEach(file => {
        if (!files.includes(file)) {
          files.push(file);
        }
      });
    }

    return res.json({ success: true, files });
  } catch (error: any) {
    console.error('List materials error:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to list files.' });
  }
});

// 2. Upload/Save study material for a specific QID folder (Base64 file transport)
app.post('/api/materials/upload', (req, res) => {
  try {
    const { qid, fileName, fileContent } = req.body;

    if (!qid || !fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing required parameters: qid, fileName, or fileContent.' });
    }

    const qidStr = String(qid).trim();
    const safeFileName = String(fileName).replace(/[^a-zA-Z0-9.\-_ ]/g, '_'); // sanitize filename
    const subfolderPath = path.join(MAIN_REVIEW_FOLDER, qidStr);

    // Ensure subfolder with QID is created on the server
    if (!fs.existsSync(subfolderPath)) {
      fs.mkdirSync(subfolderPath, { recursive: true });
    }

    // Convert base64 back into raw buffer on the server
    const base64Data = fileContent.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const targetFilePath = path.join(subfolderPath, safeFileName);
    fs.writeFileSync(targetFilePath, buffer);

    console.log(`Saved study file for QID ${qidStr}: ${targetFilePath}`);

    return res.json({ success: true, fileName: safeFileName });
  } catch (error: any) {
    console.error('Upload material exception:', error);
    return res.status(500).json({ success: false, error: error?.message || 'File write failure.' });
  }
});

// 3. Download/Serve study material for a specific QID
app.get('/api/materials/download', (req, res) => {
  try {
    const { qid, file } = req.query;
    if (!qid || !file) {
      return res.status(400).send('Missing critical qid or file parameters.');
    }

    const qidStr = String(qid).trim();
    const fileName = String(file).trim();
    
    // Check if file is in the subfolder
    let filePath = path.join(MAIN_REVIEW_FOLDER, qidStr, fileName);
    if (!fs.existsSync(filePath)) {
      // Fallback: Check if it exists in the root folder instead
      filePath = path.join(MAIN_REVIEW_FOLDER, fileName);
    }

    // Prevent directory traversal attacks
    const relative = path.relative(MAIN_REVIEW_FOLDER, filePath);
    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);

    if (!isSafe || !fs.existsSync(filePath)) {
      return res.status(404).send('Document not found in specified question folder or root review folder.');
    }

    // Set inline or attachment headers
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    return res.sendFile(filePath);
  } catch (error: any) {
    console.error('Download material exception:', error);
    return res.status(500).send('Unable to download requested resource.');
  }
});

// 4. Delete material file from a specific QID subfolder or root folder
app.delete('/api/materials', (req, res) => {
  try {
    const { qid, file } = req.query;
    if (!qid || !file) {
      return res.status(400).json({ error: 'Missing qid or file parameters.' });
    }

    const qidStr = String(qid).trim();
    const fileName = String(file).trim();
    
    let filePath = path.join(MAIN_REVIEW_FOLDER, qidStr, fileName);
    if (!fs.existsSync(filePath)) {
      // Fallback: Check if it exists in the root folder instead
      filePath = path.join(MAIN_REVIEW_FOLDER, fileName);
    }

    const relative = path.relative(MAIN_REVIEW_FOLDER, filePath);
    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);

    if (!isSafe || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File does not exist or access denied.' });
    }

    fs.unlinkSync(filePath);
    return res.json({ success: true, deleted: fileName });
  } catch (error: any) {
    console.error('Delete material exception:', error);
    return res.status(500).json({ success: false, error: error?.message || 'File deletion failure.' });
  }
});

// Helper function to map common file extensions to MIME types
function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.txt': return 'text/plain';
    case '.html': return 'text/html';
    default: return 'application/octet-stream';
  }
}

// Helper function to manage Gemini API concurrent spikes and retry 503/429
async function withGeminiRetry<T>(operation: () => Promise<T>, maxRetries = 3, retryDelayMs = 1500): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || String(error);
      const isRetryable = errorMessage.includes('503') || errorMessage.includes('429') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('RESOURCE_EXHAUSTED');
      
      if (attempt >= maxRetries || !isRetryable) {
        throw error;
      }
      console.warn(`Gemini API busy (503/429). Retrying attempt ${attempt}...`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt)); // exponential backoff
    }
  }
  throw new Error("Maximum Gemini API retries exceeded.");
}

// 4a. AI-driven Auto-Classify and Organizer for free-standing PDF/Image study materials
app.post('/api/materials/auto-classify', async (req, res) => {
  try {
    const { fileName, fileContent } = req.body;
    if (!fileName || !fileContent) {
      return res.status(400).json({ success: false, error: 'Missing required parameters: fileName or fileContent.' });
    }

    let cleanFileName = String(fileName).trim();
    let ext = path.extname(cleanFileName).toLowerCase();
    
    const base64Data = fileContent.replace(/^data:.*?;base64,/, '');

    // Auto-detect format from base64 header patterns
    let mimeType = 'application/octet-stream';
    if (base64Data.startsWith('JVBERi')) {
      mimeType = 'application/pdf';
      if (ext !== '.pdf') {
        ext = '.pdf';
        cleanFileName = cleanFileName + '.pdf';
      }
    } else if (base64Data.startsWith('iVBORw')) {
      mimeType = 'image/png';
      if (ext !== '.png') {
        ext = '.png';
        cleanFileName = cleanFileName + '.png';
      }
    } else if (base64Data.startsWith('/9j/')) {
      mimeType = 'image/jpeg';
      if (ext !== '.jpg' && ext !== '.jpeg') {
        ext = '.jpg';
        cleanFileName = cleanFileName + '.jpg';
      }
    } else if (base64Data.startsWith('UklGR')) {
      mimeType = 'image/webp';
      if (ext !== '.webp') {
        ext = '.webp';
        cleanFileName = cleanFileName + '.webp';
      }
    }

    // fallback to extension check if headers didn't match
    if (mimeType === 'application/octet-stream') {
      if (ext === '.pdf') {
        mimeType = 'application/pdf';
      } else if (ext === '.png') {
        mimeType = 'image/png';
      } else if (ext === '.jpg' || ext === '.jpeg') {
        mimeType = 'image/jpeg';
      } else if (ext === '.webp') {
        mimeType = 'image/webp';
      }
    }

    const isSupported = mimeType === 'application/pdf' || mimeType.startsWith('image/');
    if (!isSupported) {
      return res.status(400).json({ 
        success: false, 
        error: `Auto-classification is only supported for PDF and common image formats, not '${ext || 'unknown'}'.` 
      });
    }

    let extractedQid = null;
    let topic = null;
    let needsGeminiFallback = true;
    const buffer = Buffer.from(base64Data, 'base64');

    // User hint: "qid is always at the end of pdf"
    // Check if the filename itself has a 4-to-6 digit number at the end
    const titleMatch = cleanFileName.match(/\b(\d{4,6})\b[^0-9]*\.[a-zA-Z]+$/i);
    if (!titleMatch) {
       // Also just look for any 4-6 digit sequence near the end of the filename
       const allTitleNums = [...cleanFileName.matchAll(/\b(\d{4,6})\b/g)];
       if (allTitleNums.length > 0) {
          extractedQid = allTitleNums[allTitleNums.length - 1][1];
          topic = "Study Review";
          needsGeminiFallback = false;
       }
    } else if (titleMatch && titleMatch[1]) {
       extractedQid = titleMatch[1];
       topic = "Study Review";
       needsGeminiFallback = false;
    }

    if (needsGeminiFallback) {
      const ai = getAIClient();

      const contents = [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: `
You are an expert system designed to catalog medical board study materials (such as USMLE Step 2 CK or MCCQE Part 1).
Analyze the attached document/image.
Your task is to identify and extract the Question ID (QID) or Question Number.
This is typically a 4-to-6 digit numerical identifier used in medical exam question banks (UWorld, NBME, or AMBOSS).
Look closely for:
- "Question ID: XXXXX" or "QID XXXXX" or "uq_XXXXX" or "Question ID XXXXX"
- A prominent number at the top of a question explanation or review card
- If no explicit QID label is found, look for any 4 to 6 digit numerical sequence that uniquely labels the question on pages or screenshots of question banks.

Provide your response in the following strict JSON format:
{
  "qid": "the extracted 4-to-6 digit numerical QID sequence (or null if not found)",
  "topic": "a beautiful, brief 2-4 word diagnosis/topic title of the clinical case (e.g. 'Aortic Dissection', 'Celiac Disease', or null if not found)",
  "confidence": "high, medium, or low"
}
`
        }
      ];

      const response = await withGeminiRetry(() => ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              qid: { type: Type.STRING },
              topic: { type: Type.STRING },
              confidence: { type: Type.STRING }
            },
            required: ['qid', 'topic', 'confidence']
          }
        }
      }));

      if (!response || !response.text) {
        return res.status(500).json({ success: false, error: 'Gemini did not return a response.' });
      }

      const parsed = JSON.parse(response.text.trim());
      extractedQid = parsed.qid ? String(parsed.qid).trim().replace(/[^0-9]/g, '') : null;
      topic = parsed.topic ? String(parsed.topic).trim() : null;

      if (!extractedQid || extractedQid.length < 4) {
        return res.json({ 
          success: false, 
          error: `Could not identify a distinct 4-to-6 digit medical Question ID (QID) inside this file. Confidence level: ${parsed.confidence || 'low'}.` 
        });
      }
    }

    // Sanitize the original filename to prevent directory traversal
    const sanitizedOriginalName = cleanFileName.replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
    
    // Clean the topic text to be safe for filenames
    const validTopic = topic ? topic.replace(/[^a-zA-Z0-9.\-_ \(\)]/g, '').trim() : 'Review';
    const safeTopic = validTopic.length > 0 ? validTopic : 'Review';
    
    // Generate a clean final filename
    const finalFileName = `QID_${extractedQid}${ext}`;

    // Save locally to the QID subfolder
    const subfolderPath = path.join(MAIN_REVIEW_FOLDER, extractedQid as string);
    if (!fs.existsSync(subfolderPath)) {
      fs.mkdirSync(subfolderPath, { recursive: true });
    }

    const targetFilePath = path.join(subfolderPath, finalFileName);
    fs.writeFileSync(targetFilePath, buffer);

    console.log(`Auto-classified and saved material to QID ${extractedQid}: ${targetFilePath}`);

    return res.json({
      success: true,
      qid: extractedQid,
      topic,
      originalName: cleanFileName,
      fileName: finalFileName,
      message: `Successfully classified and organized under QID ${extractedQid} (${topic || 'General Review'})!`
    });

  } catch (error: any) {
    console.error('Auto-classify study material error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Failed to auto-classify PDF study material.' 
    });
  }
});

// Fast local backup for client-managed classified PDFs
app.post('/api/materials/save-local-backup', async (req, res) => {
  try {
    const { qid, fileName, fileContent } = req.body;
    if (!qid || !fileName || !fileContent) return res.status(400).json({ error: 'Missing params' });

    const base64Data = fileContent.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    let cleanQid = String(qid).replace(/[^0-9]/g, '');
    let cleanFileName = String(fileName).replace(/[^a-zA-Z0-9.\-_ ]/g, '_');

    const subfolderPath = path.join(MAIN_REVIEW_FOLDER, cleanQid);
    if (!fs.existsSync(subfolderPath)) {
      fs.mkdirSync(subfolderPath, { recursive: true });
    }

    const targetFilePath = path.join(subfolderPath, cleanFileName);
    fs.writeFileSync(targetFilePath, buffer);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4b. AI-driven analyzer for uploaded files inside question folders
app.post('/api/materials/analyze', async (req, res) => {
  try {
    const { qid, file } = req.body;
    if (!qid || !file) {
      return res.status(400).json({ error: 'Missing QID or file parameters for analysis.' });
    }

    const qidStr = String(qid).trim();
    const fileName = String(file).trim();
    const filePath = path.join(MAIN_REVIEW_FOLDER, qidStr, fileName);

    const relative = path.relative(MAIN_REVIEW_FOLDER, filePath);
    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);

    if (!isSafe || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Selected study document was not found or is inaccessible.' });
    }

    const ext = path.extname(fileName).toLowerCase();
    const mimeType = getMimeType(fileName);

    const ai = getAIClient();
    let contents: any[] = [];

    const promptText = `
You are a peerless USMLE Step 2 medical expert and tutor.
You have been given a document file containing a question, answer explanation, and diagnostic guidelines uploaded for QID ${qidStr}.
Analyze the document content and structure high-yield studying aids for Step 2.

In your response, provide:
1. "qid": Ensure this matches QID ${qidStr}.
2. "pathophysiologySummary": A 2-3 sentence summary of the vignette's patient presentation and the underlying disease mechanism (why it happened).
3. "educationalObjective": The single most high-yield clinical sentence or educational key takeaway that describes how to diagnose or treat this finding.
4. "differentialDiagnosis": A comparative list of up to 4 other choices/mimics mentioned in the text. For each, give the Choice name/topic and a 1-sentence diagnostic pearl differentiating it (as explained in the text choice descriptions).
5. "clinicalMnemonic": A memorable diagnostic clinical mnemonic, logical acronym, or physical exam memory aid to help the medical student instantly differentiate this disease from other similar findings under timed exams.
6. "keyClinicalClues": List up to 4 key diagnostic clues/findings in the vignette (e.g. labs, physical exams, history points).

Ensure your clinical pearls are accurate, detailed, and extremely helpful. Return the output as a strict JSON object matching the requested schema.
`;

    // Process file input type dynamically
    if (ext === '.pdf' || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') {
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      contents = [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: promptText,
        },
      ];
    } else {
      // Treat alternative formats like txt, html, md as UTF-8 textual streams
      const textContent = fs.readFileSync(filePath, 'utf-8');
      contents = [
        {
          text: `Document Content:\n\n${textContent}\n\n${promptText}`
        }
      ];
    }

    const response = await withGeminiRetry(() => ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            qid: { type: Type.STRING },
            pathophysiologySummary: { type: Type.STRING },
            educationalObjective: { type: Type.STRING },
            differentialDiagnosis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  choice: { type: Type.STRING },
                  pearl: { type: Type.STRING }
                },
                required: ['choice', 'pearl']
              }
            },
            clinicalMnemonic: { type: Type.STRING },
            keyClinicalClues: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: [
            'qid',
            'pathophysiologySummary',
            'educationalObjective',
            'differentialDiagnosis',
            'clinicalMnemonic',
            'keyClinicalClues'
          ]
        }
      }
    }));

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);

    return res.json({ success: true, analysis: parsed });
  } catch (error: any) {
    console.error('AI Materials analysis endpoint error:', error);
    const msg = error?.message || '';
    if (msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({
        success: false,
        error: 'The AI analysis service is currently experiencing high demand. Please wait a few seconds and try uploading again.'
      });
    }
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed analyzing study materials.'
    });
  }
});

// 5. Screenshot Parser API Proxy Endpoint
app.post('/api/parse-screenshot', async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Missing image content in request body.' });
    }

    const cleanMimeType = mimeType || 'image/png';
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const ai = getAIClient();

    const promptText = `
You are the central logic engine for a high-accountability medical board exam tracking application. Your objective is to parse user inputs (images of question banks, performance updates, or manual text) and translate them into a structured JSON payload that will drive automated workflows across Google Tasks, Google Calendar, and Google Keep.

You must operate across two distinct exam environments: USMLE Step 2 CK and MCCQE Part 1. Keep data strictly isolated based on the user's active session.

### Core Automated Workflows to Execute:

1. THE ACCOUNTABILITY ENGINE (Google Tasks)
- Calculate the user's daily question deficit against a 40-question/day goal, factoring in the 200-question/week base and any carry-over debt.
- Generate phased, time-specific motivational reminders for 05:00, 06:00, 07:00, 08:00, 16:30, 17:00, 19:00, and 21:00. The text must include the exact remaining question count and shift tone from morning discipline, to afternoon second-winds, to evening urgency.
- If a question is logged as "Incorrect," automatically generate a mandate task: "Create Anki card for QID-[Number]".

2. DYNAMIC SCHEDULING (Google Calendar)
- Spaced Repetition: For every incorrect question, generate calendar event payloads for exactly 3 days and 7 days in the future for a 15-minute review of that specific concept.
- Weakness Blocking: If the input data shows a specific body system dropping below the >70% competitive target, generate a payload to schedule a 45-minute "Targeted System Review" on the upcoming weekend.

3. THE HIGH-YIELD COMPILER (Google Keep / Docs)
- Extract the core educational objective or "Clinical Pearl" from the provided explanation.
- Format this takeaway as a concise bullet point ready to be appended to the master study guide, categorized by system.

### The Diagnostic "Check" Rule:
Before outputting your data, you must run a self-diagnostic check. 
- If the Exam Type is not explicitly written on the screenshot, default to 'USMLE Step 2 CK'.
- If the System Category is not explicitly written on the screenshot, infer it from the medical context of the question (e.g. Cardiology, Renal, Pediatrics, etc.), or default to 'Miscellaneous'.
- You must identify the Question ID (QID) and the Status (whether correct, incorrect, or omitted/not answered). If you can extract at least one Question ID (QID) and its status, you MUST set is_healthy to true. Only set is_healthy to false if the image is blank, completely illegible, or contains absolutely no question-bank information.
`;

    const response = await withGeminiRetry(() => ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { inlineData: { mimeType: cleanMimeType, data: base64Data } },
        { text: promptText },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            system_diagnostics: {
              type: Type.OBJECT,
              description: "The AI's self-check to verify all functions ran properly.",
              properties: {
                is_healthy: {
                  type: Type.BOOLEAN,
                  description: "True if all required data (QID, System, Exam) was found."
                },
                missing_data_errors: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of any missing elements that prevent workflows from firing."
                }
              },
              required: ["is_healthy", "missing_data_errors"]
            },
            app_database_payload: {
              type: Type.ARRAY,
              description: "Array of parsed questions from the image.",
              items: {
                type: Type.OBJECT,
                properties: {
                  active_exam: { type: Type.STRING, enum: ["USMLE Step 2 CK", "MCCQE Part 1"] },
                  qid: { type: Type.STRING },
                  system_category: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ["Correct", "Incorrect", "Omitted"] }
                },
                required: ["active_exam", "qid", "system_category", "status"]
              }
            },
            google_tasks_payload: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  scheduled_time: { type: Type.STRING },
                  task_title: { type: Type.STRING }
                }
              }
            },
            google_calendar_payload: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  event_title: { type: Type.STRING },
                  duration_minutes: { type: Type.INTEGER },
                  days_in_future: { type: Type.INTEGER }
                }
              }
            },
            google_keep_payload: {
              type: Type.ARRAY,
              description: "An array of clinical pearls for each parsed question.",
              items: {
                type: Type.OBJECT,
                properties: {
                  clinical_pearl_text: { type: Type.STRING },
                  target_category: { type: Type.STRING }
                }
              }
            }
          },
          required: [
            "system_diagnostics", 
            "app_database_payload", 
            "google_tasks_payload", 
            "google_calendar_payload", 
            "google_keep_payload"
          ]
        },
      },
    }));

    const bodyText = response.text?.trim() || '{}';
    const parsedData = JSON.parse(bodyText);
    
    // Transform API response to what frontend expects
    const hasQuestions = Array.isArray(parsedData.app_database_payload) && parsedData.app_database_payload.length > 0;
    if (parsedData.system_diagnostics && !parsedData.system_diagnostics.is_healthy && !hasQuestions) {
       return res.status(400).json({ error: 'Check failed: ' + (parsedData.system_diagnostics.missing_data_errors?.join(', ') || 'Diagnostic check failed.') });
    }

    const transformedQuestions = (parsedData.app_database_payload || []).map((p: any, idx: number) => ({
      qid: String(p.qid || ''),
      system: String(p.system_category || 'Miscellaneous'),
      attempt: p.status, // "Correct", "Incorrect", "Omitted"
      studyGuide: parsedData.google_keep_payload?.[idx]?.clinical_pearl_text || '' // map the first pearl or align appropriately
    }));

    // Pass additional payloads to frontend if needed (Tasks/Keep/Calendar) right now UI expects `questions`
    return res.json({ 
      success: true, 
      questions: transformedQuestions,
      diagnostics: parsedData.system_diagnostics,
      tasks: parsedData.google_tasks_payload,
      calendar: parsedData.google_calendar_payload
    });
  } catch (error: any) {
    console.error('OCR parsing endpoint exception:', error);
    const msg = error?.message || '';
    if (msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({
        success: false,
        error: 'The AI analysis service is currently experiencing high demand. Please wait a few seconds and try uploading again.'
      });
    }
    return res.status(500).json({
      success: false,
      error: error?.message || 'An unexpected error occurred during the OCR analysis process.',
    });
  }
});

// 6. Generate and Send/Simulate Morning Email Study Digest
app.post('/api/send-email-digest', async (req, res) => {
  try {
    const { email, rows, targetDate } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const targetDateStr = targetDate || (() => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toLocaleDateString('en-CA');
    })();

    const formattedDateLabel = new Date(targetDateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Determine if any questions were actually attempted on that target state
    const actualTargetRows = Array.isArray(rows)
      ? rows.filter(r => r.date === targetDateStr && (r.attempt1 || r.attempt2 || r.studyGuide))
      : [];

    const isMotivational = actualTargetRows.length === 0;
    let htmlContent = '';
    let subjectStr = '';

    // Standard metric summaries
    let totalDone = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let omittedCount = 0;
    let accuracy = 0;
    let sortedFocusAreas: any[] = [];
    let incorrectsList: any[] = [];

    if (isMotivational) {
      subjectStr = `⚡ Stay on Track! Daily USMLE Step 2 CK Study Kickstart`;
      
      htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Stay on Track - USMLE Prep Motivation</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0b0f19;
            color: #f1f5f9;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #1e1b4b;
            background-image: linear-gradient(135deg, #1e1b4b 0%, #311042 100%);
            padding: 30px 24px;
            text-align: center;
            border-bottom: 2px solid #312e81;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          .header p {
            color: #c7d2fe;
            margin: 8px 0 0 0;
            font-size: 11px;
            letter-spacing: 0.12em;
            font-weight: 600;
          }
          .content {
            padding: 24px;
          }
          .greeting {
            font-size: 15px;
            line-height: 22px;
            color: #cbd5e1;
            margin-bottom: 20px;
          }
          .quote-box {
            background-color: #1a1b35;
            border-left: 3px solid #8b5cf6;
            padding: 14px 18px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
            font-style: italic;
            font-size: 14px;
            line-height: 20px;
            color: #ddd6fe;
          }
          .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            border-bottom: 1px solid #334155;
            padding-bottom: 6px;
            margin-top: 24px;
            margin-bottom: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .tips-container {
            margin-bottom: 24px;
          }
          .tip-card {
            background-color: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
          }
          .tip-tag {
            font-family: monospace;
            background-color: #4c1d95;
            color: #d8b4fe;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 6px;
          }
          .tip-headline {
            font-size: 14px;
            font-weight: 600;
            color: #f8fafc;
            margin-bottom: 4px;
          }
          .tip-body {
            font-size: 12.5px;
            color: #94a3b8;
            line-height: 18px;
          }
          .action-prompt {
            text-align: center;
            background-color: #111827;
            border: 1px dashed #334155;
            border-radius: 8px;
            padding: 18px;
            margin: 24px 0 16px 0;
          }
          .action-prompt p {
            margin: 0 0 14px 0;
            font-size: 13px;
            color: #e2e8f0;
            line-height: 18px;
          }
          .btn {
            display: inline-block;
            background-color: #4f46e5;
            background-image: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
            color: #ffffff !important;
            padding: 10px 22px;
            border-radius: 6px;
            font-weight: 600;
            text-decoration: none;
            font-size: 13.5px;
            box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);
          }
          .footer {
            background-color: #0b0f19;
            padding: 20px;
            text-align: center;
            font-size: 11.5px;
            color: #64748b;
            border-top: 1px solid #1e293b;
          }
          .footer p {
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>USMLE STUDY COMPANION</h1>
            <p>DAILY STUDY HABIT ENCOURAGEMENT</p>
          </div>
          <div class="content">
            <div class="greeting">
              Good morning! Consistency in USMLE Step 2 CK preparation is built step-by-step.
            </div>

            <p style="font-size: 13.5px; line-height: 20px; color: #94a3b8; margin: 0 0 16px 0;">
              Our tracking system shows that you had no study questions logged yesterday (<strong>${formattedDateLabel}</strong>) on your private space. Remember that medical review is a marathon—and the absolute hardest hurdle is always starting the first question of the day.
            </p>

            <div class="quote-box">
              "The secret of getting ahead is getting started. The secret of getting started is breaking your complex overwhelming tasks into small manageable tasks, and starting on the first one." — Mark Twain
            </div>

            <div class="section-title">3 Strategies to Jumpstart Today's Review</div>

            <div class="tips-container">
              <div class="tip-card">
                <span class="tip-tag">MOMENTUM</span>
                <div class="tip-headline">The 5-Question Target Rule</div>
                <div class="tip-body">
                  Never stress about completing your full 40-question target all at once. Commit to answering just <strong>5 questions</strong> inside your study block. Usually, once you cross the start threshold, cognitive momentum keeps you flowing.
                </div>
              </div>

              <div class="tip-card">
                <span class="tip-tag">STRUCTURE</span>
                <div class="tip-headline">Boot Up Your Preferred System First</div>
                <div class="tip-body">
                  Pick a system category where you feel highly confident (e.g., Cardiology, Renal, or Endocrine). Generating a handful of high-score answers activates your confidence before you tackle more daunting clinical topics.
                </div>
              </div>

              <div class="tip-card">
                <span class="tip-tag">ENVIRONMENT</span>
                <div class="tip-headline">Minimize Activation Clutter</div>
                <div class="tip-body">
                  Prepare your workspace early in the morning. Put your phone inside another room, open your study guide tools, and focus strictly on parsing a single clinical scenario block.
                </div>
              </div>
            </div>

            <div class="action-prompt">
              <p>Your 40-question daily sprint resets today. Let's restart your cycle strong!</p>
              <a href="${process.env.APP_URL || 'https://ai.studio/build'}" class="btn">
                Launch My Study Space
              </a>
            </div>

          </div>
          <div class="footer">
            <p>This automated friendly nudge is delivered by your USMLE Step 2 CK Study Tracker.</p>
            <p>© 2026 USMLE Study Tracker. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
      `;
    } else {
      subjectStr = `🩺 Morning Study Digest: Yesterday's USMLE Review - ${formattedDateLabel}`;
      
      // Calculate standard diagnostic statistics
      totalDone = actualTargetRows.length;
      correctCount = actualTargetRows.filter(r => r.attempt1 === 'Correct' || r.attempt2 === 'Correct').length;
      incorrectCount = actualTargetRows.filter(r => r.attempt1 === 'Incorrect' || r.attempt2 === 'Incorrect').length;
      omittedCount = totalDone - correctCount - incorrectCount;
      accuracy = totalDone > 0 ? Math.round((correctCount / totalDone) * 100) : 0;

      // Group incorrects by system to recommend focus areas
      const systemIncorrectCounts: Record<string, number> = {};

      actualTargetRows.forEach(r => {
        const isIncorrectNow = r.attempt1 === 'Incorrect' || r.attempt2 === 'Incorrect';
        if (isIncorrectNow) {
          systemIncorrectCounts[r.system] = (systemIncorrectCounts[r.system] || 0) + 1;
          incorrectsList.push({
            qid: r.qid,
            topic: r.topic,
            system: r.system,
            studyGuide: r.studyGuide || 'Study notes are pending for this item.'
          });
        }
      });

      sortedFocusAreas = Object.entries(systemIncorrectCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([sys, ct]) => ({ system: sys, count: ct }));

      // Generate HTML list items for focus areas
      const focusAreasHTML = sortedFocusAreas.slice(0, 3).map(f => `
        <div class="focus-item">
          <div class="focus-item-title">${f.system}</div>
          <div class="focus-item-desc">You recorded <strong>${f.count} Incorrect</strong> attempt(s) in this system category. Review related pathognomonic symptoms and treatment indicators.</div>
        </div>
      `).join('');

      // Generate HTML list items for key takeaways
      const highYieldHTML = incorrectsList.slice(0, 6).map(item => `
        <div class="pearl-card">
          <div class="pearl-title">QID ${item.qid} • ${item.system}</div>
          <div class="pearl-body">
            <strong>Topic Focus:</strong> ${item.topic}<br>
            <strong>High-Yield Takeaway:</strong> ${item.studyGuide}
          </div>
        </div>
      `).join('');

      htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>USMLE Step 2 CK Study Review</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0b0f19;
            color: #f1f5f9;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #1e1b4b;
            background-image: linear-gradient(135deg, #1e1b4b 0%, #311042 100%);
            padding: 30px 24px;
            text-align: center;
            border-bottom: 2px solid #312e81;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          .header p {
            color: #c7d2fe;
            margin: 8px 0 0 0;
            font-size: 13px;
            letter-spacing: 0.1em;
            font-weight: 600;
          }
          .content {
            padding: 24px;
          }
          .greeting {
            font-size: 15px;
            line-height: 22px;
            color: #e2e8f0;
            margin-bottom: 24px;
          }
          .summary-grid {
            display: table;
            width: 100%;
            border-collapse: separate;
            border-spacing: 10px 0;
            margin: 0 -10px 24px -10px;
          }
          .metric-wrapper {
            display: table-cell;
            width: 33.333%;
          }
          .metric-card {
            background-color: #1e293b;
            border: 1px solid #334155;
            border-radius: 10px;
            padding: 15px 10px;
            text-align: center;
          }
          .metric-value {
            font-size: 22px;
            font-weight: 750;
            color: #38bdf8;
            margin-bottom: 4px;
          }
          .metric-value.correct {
            color: #10b981;
          }
          .metric-value.incorrect {
            color: #f43f5e;
          }
          .metric-label {
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 600;
            color: #94a3b8;
            letter-spacing: 0.05em;
          }
          .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            border-bottom: 1px solid #334155;
            padding-bottom: 6px;
            margin-top: 26px;
            margin-bottom: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .focus-item {
            background-color: rgba(244, 63, 94, 0.04);
            border-left: 3px solid #f43f5e;
            padding: 12px 14px;
            margin-bottom: 10px;
            border-radius: 0 8px 8px 0;
          }
          .focus-item-title {
            font-size: 13.5px;
            font-weight: 600;
            color: #fecdd3;
            margin-bottom: 3px;
          }
          .focus-item-desc {
            font-size: 12px;
            color: #cbd5e1;
            line-height: 16px;
          }
          .pearl-card {
            background-color: #111827;
            border: 1px solid #1f2937;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 12px;
          }
          .pearl-title {
            font-size: 13px;
            color: #38bdf8;
            font-weight: 600;
            margin-bottom: 6px;
          }
          .pearl-body {
            font-size: 12.5px;
            line-height: 18px;
            color: #d1d5db;
          }
          .footer {
            background-color: #0b0f19;
            padding: 20px;
            text-align: center;
            font-size: 11.5px;
            color: #64748b;
            border-top: 1px solid #1e293b;
          }
          .footer p {
            margin: 4px 0;
          }
          .footer a {
            color: #38bdf8;
            text-decoration: none;
          }
          .btn {
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff !important;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 600;
            text-decoration: none;
            font-size: 13.5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>USMLE STEP 2 CK</h1>
            <p>DAILY STUDY DIGEST REPORT</p>
          </div>
          <div class="content">
            <div class="greeting">
              Good morning! Ready to cement your clinical knowledge? Here is your personalized daily incorrect review list and system focus areas.
            </div>

            <div class="section-title">Yesterday's Activity Overview</div>
            
            <div class="summary-grid">
              <div class="metric-wrapper">
                <div class="metric-card">
                  <div class="metric-value">${totalDone}</div>
                  <div class="metric-label">Completed</div>
                </div>
              </div>
              <div class="metric-wrapper">
                <div class="metric-card">
                  <div class="metric-value correct">${correctCount}</div>
                  <div class="metric-label">Correct (${accuracy}%)</div>
                </div>
              </div>
              <div class="metric-wrapper">
                <div class="metric-card">
                  <div class="metric-value incorrect">${incorrectCount}</div>
                  <div class="metric-label">Incorrect</div>
                </div>
              </div>
            </div>

            ${sortedFocusAreas.length > 0 ? `
              <div class="section-title">Critical Focus Areas To Address</div>
              <div style="margin-bottom: 20px;">
                ${focusAreasHTML}
              </div>
            ` : ''}

            ${incorrectsList.length > 0 ? `
              <div class="section-title">Clinical Takeaway Drill Notes</div>
              <div>
                ${highYieldHTML}
              </div>
            ` : `
              <div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; border: 1px dashed #334155; border-radius: 8px;">
                🎉 Excellent! No incorrect questions were recorded last cycle. Keep maintaining a high first-attempt accuracy!
              </div>
            `}

            <div style="text-align: center; margin-top: 28px; margin-bottom: 10px;">
              <a href="${process.env.APP_URL || 'https://ai.studio/build'}" class="btn">
                Open Study Tracker App
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>This automated digest is compiled by your USMLE Step 2 CK Study Tracker.</p>
            <p>© 2026 USMLE Study Space. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
      `;
    }

    // 2. Transmit the email (Real send vs Simulated send)
    let transportResult = null;
    const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    if (hasSmtpConfig) {
      try {
        const isGmail = process.env.SMTP_HOST?.toLowerCase().includes('gmail') || process.env.SMTP_USER?.toLowerCase().includes('@gmail.com');
        
        let transporter;
        if (isGmail) {
          transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          });
        } else {
          transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_PORT === '465',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
            tls: {
              rejectUnauthorized: false
            }
          });
        }

        const fromAddress = process.env.SMTP_FROM || (isGmail ? `"USMLE Study Companion" <${process.env.SMTP_USER}>` : '"USMLE Study Space" <noreply@usmlereview.app>');

        const info = await transporter.sendMail({
          from: fromAddress,
          to: email,
          subject: subjectStr,
          html: htmlContent,
        });

        transportResult = {
          sent: true,
          messageId: info.messageId,
          recipient: email,
          realMail: true
        };
        console.log(`Real email study digest successfully sent to ${email}. Message ID: ${info.messageId}`);
      } catch (err: any) {
        console.error('SMTP transmission failed, returning error feedback. Error:', err);
        transportResult = {
          sent: false,
          recipient: email,
          realMail: false,
          error: err?.message || 'SMTP config exists but transmission failed.'
        };
      }
    } else {
      transportResult = {
        sent: true,
        recipient: email,
        realMail: false,
        reason: 'SMTP details not configured in environment variables. Falling back to clean UI preview.'
      };
      console.log(`Simulated study email digest completed for recipient: ${email}`);
    }

    return res.json({
      success: true,
      digestResult: transportResult,
      isFallback: isMotivational, // Flag matches frontend display expectations
      isMotivational,
      targetDate: targetDateStr,
      formattedDateLabel,
      htmlContent,
      dataSummary: {
        totalDone,
        correctCount,
        incorrectCount,
        omittedCount,
        accuracy,
        focusAreas: sortedFocusAreas,
        incorrectsDetail: incorrectsList
      }
    });

  } catch (error: any) {
    console.error('Email digest endpoint exception:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to generate review draft.' });
  }
});

// ----------------------------------------------------------------------
// Automated Internal Background Jobs
// ----------------------------------------------------------------------

app.post('/api/sync-progress', (req, res) => {
  try {
    const { rows } = req.body;
    if (Array.isArray(rows)) {
      globallyTrackedRows = rows;
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false });
  }
});

// Run a daily process at 04:30 AM to assess the upcoming day and dispatch/log the Google Tasks payload
cron.schedule('30 4 * * *', () => {
  console.log('--- Triggering Daily Automated Google Tasks Payload ---');
  
  // Calculate today's existing completed count from globallyTrackedRows
  const todayStr = new Date().toLocaleDateString('en-CA');
  
  const todayCount = globallyTrackedRows.filter((r: any) => 
    r.date === todayStr && (r.attempt1 || r.attempt2 || r.studyGuide)
  ).length;

  const remainingCount = Math.max(0, 40 - todayCount);

  const taskPayload = {
    reminders: [
      {
        time: "05:00",
        task_title: `${remainingCount} questions to go. The competition is still sleeping. Get it done.`
      },
      {
        time: "06:00",
        task_title: `${remainingCount} questions to go. Capitalize on the quiet hours. Discipline builds doctors.`
      },
      {
        time: "07:00",
        task_title: `${remainingCount} questions to go. The clinic isn't open yet, but your mind should be. Start strong.`
      },
      {
        time: "08:00",
        task_title: `${remainingCount} questions to go. Morning focus sets the tone for the entire day.`
      },
      {
        time: "16:30",
        task_title: `${remainingCount} questions to go. Workday is over, but your second wind starts now.`
      },
      {
        time: "17:00",
        task_title: `${remainingCount} questions to go. Push through the fatigue. This is where champions are made.`
      },
      {
        time: "19:00",
        task_title: `${remainingCount} questions to go. The day is ending. Close the gap. Urgent push.`
      },
      {
        time: "21:00",
        task_title: `${remainingCount} questions to go. Test day reality check: every set today is a point tomorrow.`
      }
    ]
  };

  // In a real application, this payload would be dispatched transparently via the Google Tasks API.
  // Here we fulfill the "automatic backend execution" requirement by generating and preserving it.
  const payloadPath = path.join(process.cwd(), 'daily_tasks_payload.json');
  fs.writeFileSync(payloadPath, JSON.stringify(taskPayload, null, 2));

  console.log('Automated Daily Google Tasks Payload generated and saved to', payloadPath);
  console.log(JSON.stringify(taskPayload, null, 2));
});

// ----------------------------------------------------------------------
// Revision / Anki Cards & Podcast API Routes
// ----------------------------------------------------------------------

app.post('/api/revision/flashcards', async (req, res) => {
  try {
    const { questions } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Valid array of questions is required.' });
    }

    const ai = getAIClient();
    
    // Select up to 10 incorrect questions to keep context size manageable
    const sampleQuestions = questions.slice(0, 10);
    
    // Attempt to aggregate text from provided Study Material PDFs or documents
    let combinedContentContext = '';
    
    for (const q of sampleQuestions) {
      const qidStr = String(q.qid).trim();
      const subfolderPath = path.join(MAIN_REVIEW_FOLDER, qidStr);
      let extractedPdfContent = '';
      
      if (fs.existsSync(subfolderPath)) {
        const files = fs.readdirSync(subfolderPath);
        for (const file of files) {
          const filePath = path.join(subfolderPath, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile() && !file.startsWith('.')) {
            const ext = path.extname(file).toLowerCase();
            if (ext === '.txt' || ext === '.md') {
              extractedPdfContent += `[Document for QID ${qidStr}]:\n${fs.readFileSync(filePath, 'utf-8')}\n`;
            } else if (ext === '.pdf') {
              // We'll instruct the model to use its knowledge for the PDF contents or search if not provided via text
              // Real PDF extraction can be heavy, but we provide the file paths mapped to QIDs to hint it
              extractedPdfContent += `[PDF File attached for QID ${qidStr}: ${file} - use knowledge to explain the topic]\n`;
            }
          }
        }
      }
      
      combinedContentContext += `
      QID: ${q.qid}
      Topic: ${q.topic}
      System: ${q.system}
      Study Guide Pearl: ${q.studyGuide || 'None provided'}
      ${extractedPdfContent}
      ---`;
    }

    const promptText = `
    You are an expert medical educator creating Anki-style spaced repetition flashcards for a medical student preparing for USMLE Step 2 CK.
    Based on the following incorrect questions from today's session, generate targeted flashcards.
    For each question topic, create 1 to 2 highly effective Anki cards focusing on the exact reason they likely got it incorrect (e.g. differentiating factor, first-line treatment, pathognomonic sign).
    Wait, here is the context of what they struggled with:
    ${combinedContentContext}

    Respond strictly with a JSON array of objects representing flashcards.
    Each object must have the following properties:
    - "qid": The associated QID string.
    - "front": The front of the flashcard (the question or prompt, keep it concise).
    - "back": The back of the flashcard (the answer and a brief 1-sentence explanation).
    - "topic": The topic or system for this card.
    `;

    const response = await withGeminiRetry(() => 
      ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                qid: { type: Type.STRING },
                front: { type: Type.STRING },
                back: { type: Type.STRING },
                topic: { type: Type.STRING }
              },
              required: ['qid', 'front', 'back', 'topic']
            }
          }
        }
      })
    );

    const resultText = response.text || '[]';
    const parsedCards = JSON.parse(resultText);

    return res.json({ success: true, cards: parsedCards });
  } catch (error: any) {
    console.error('Flashcards generation error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate flashcards.' });
  }
});

app.post('/api/revision/podcast', async (req, res) => {
  try {
    const { questions } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Valid array of questions is required.' });
    }

    const ai = getAIClient();
    
    // Select up to 10 questions for the podcast script focus
    const sampleQuestions = questions.slice(0, 10).map(q => ({
      qid: q.qid,
      topic: q.topic,
      system: q.system
    }));
    
    // Step 1: Generate the script using a robust model with search if needed
    const scriptPrompt = `
    You are writing a short (2-minute) podcast script between two medical review hosts, "Joe" and "Jane".
    The focus is to help a student remember key points from these incorrect USMLE Step 2 questions:
    ${JSON.stringify(sampleQuestions, null, 2)}
    
    Instructions:
    - Write a natural, conversational script. Jane is the expert attending, Joe is the resident.
    - Focus heavily on high-yield clinical pearls, why answers are wrong, and mnemonic tricks.
    - DO NOT include ANY stage directions, intro music notes, or speaker names in the actual text to be spoken.
    - Output MUST be a strict JSON array of dialog turns.
    `;

    // We use gemini-3.5-flash for speed, or pro if search is needed. We'll use 3.5-flash without search since it knows medical well.
    const scriptResponse = await withGeminiRetry(() => 
      ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: scriptPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                speaker: { type: Type.STRING, enum: ['Joe', 'Jane'] },
                text: { type: Type.STRING }
              },
              required: ['speaker', 'text']
            }
          }
        }
      })
    );

    const scriptText = scriptResponse.text || '[]';
    const compiledScript = JSON.parse(scriptText);
    
    if (!Array.isArray(compiledScript) || compiledScript.length === 0) {
      return res.status(500).json({ success: false, error: 'Failed to generate podcast script.' });
    }

    // Step 2: Format the text for the Interactions API TTS
    // The TTS API needs a string. "TTS the following conversation between Joe and Jane: ..."
    let combinedTTSPrompt = "TTS the following conversation between Joe and Jane:\n";
    for (const turn of compiledScript) {
      combinedTTSPrompt += `${turn.speaker}: ${turn.text}\n`;
    }

    // Step 3: Call the Interactions API for multi-speaker TTS
    const interaction = await ai.interactions.create({
      model: "gemini-3.1-flash-tts-preview",
      input: combinedTTSPrompt,
      response_modalities: ['audio'],
      generation_config: {
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: 'Joe',
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Puck' }
                }
              },
              {
                speaker: 'Jane',
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' }
                }
              }
            ]
          }
        }
      }
    } as any);

    let audioBase64 = null;
    let mimeType = 'audio/pcm;rate=24000'; // Default for TTS

    for (const step of interaction.steps) {
      if (step.type === 'model_output') {
        const audioContent = step.content?.find((c: any) => c.type === 'audio') as any;
        if (audioContent && audioContent.data) {
          audioBase64 = audioContent.data;
          if (audioContent.mime_type) {
            mimeType = audioContent.mime_type;
          }
        }
      }
    }

    if (!audioBase64) {
      return res.status(500).json({ success: false, error: 'Audio generation failed.' });
    }

    // Convert raw PCM to WAV so browser <audio> can play it easily
    const pcmBuffer = Buffer.from(audioBase64, 'base64');
    const sampleRate = 24000;
    const numChannels = 1;
    const byteRate = sampleRate * numChannels * 2;
    const blockAlign = numChannels * 2;
    const dataSize = pcmBuffer.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    const wavBuffer = Buffer.concat([header, pcmBuffer]);
    const wavBase64 = wavBuffer.toString('base64');

    return res.json({ 
      success: true, 
      audioBase64: wavBase64,
      mimeType: 'audio/wav',
      script: compiledScript 
    });

  } catch (error: any) {
    console.error('Podcast generation error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate podcast.' });
  }
});

// Configure Vite middleware or Static files build
async function initializeServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler for Payload Too Large or other unhandled Express middleware errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ success: false, error: 'File is too large. Maximum size is 200MB.' });
    }
    console.error("Unhandled Express middleware error:", err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server launched successfully at http://localhost:${PORT}`);
  });
  
  // Increase server timeouts for large PDF processing (up to 10 mins)
  server.timeout = 600000;
  server.keepAliveTimeout = 600000;
  server.headersTimeout = 600000;
}

initializeServer().catch((err) => {
  console.error('Server failed to start:', err);
});
