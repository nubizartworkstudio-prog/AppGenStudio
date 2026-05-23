import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Let's parse JSON payloads
  app.use(express.json({ limit: "50mb" }));

  // API Route - Proxies Gemini API calls safely on the server-side
  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, model, existingCode, file, customApiKey } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // Obtain API Key from client or server environment
      const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "No Gemini API key is configured. Please provide your Gemini API Key in the Studio Settings panel." 
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = existingCode 
        ? `You are a precision surgical code editor. You are modifying an existing single-file HTML application.
           
           STRICT SURGICAL RULES:
           1. ONLY modify the specific lines, elements, or logic requested by the user.
           2. ABSOLUTELY DO NOT refactor, "clean up", or change any other part of the application.
           3. DO NOT rewrite sections of the code that are already functional and unrelated to the request.
           4. PRESERVE all existing comments, structures, script inclusions, and meta tags exactly as they are.
           5. If the request is a simple style change (e.g., color), ONLY change that specific CSS property.
           6. YOUR GOAL IS THE MINIMUM POSSIBLE DIFF. You act as a patcher, not a re-writer.
           7. Output the ENTIRE updated file starting with <!DOCTYPE html>.
           
           CRITICAL: YOUR RESPONSE MUST ONLY CONTAIN THE RAW HTML CODE. NO EXPLANATIONS. NO MARKDOWN BLOCKS.

           CURRENT CODE:
           \n${existingCode}\n

           USER REQUEST:
           \n${prompt}\n`
        : `You are an expert full-stack web developer. 
           Your task is to generate a COMPLETE, functional, and visually stunning single-file HTML application based on the user's prompt.
           
           REQUIREMENTS:
           - Use modern CSS (Tailwind CSS via CDN).
           - Ensure responsiveness.
           - Include all necessary logic in <script> tags.
           
           OUTPUT:
           Return ONLY the raw HTML code starting with <!DOCTYPE html>. Do not use markdown code blocks (\`\`\`html).`;

      let thinkingBudget = 8000;
      const actualModel = model || 'gemini-3.5-flash';
      if (actualModel.includes('3.1')) {
        thinkingBudget = actualModel.includes('pro') ? 32768 : 16000;
      } else if (actualModel.includes('3')) {
        thinkingBudget = actualModel.includes('pro') ? 32768 : 16000;
      }

      const parts: any[] = [{ text: prompt }];
      if (file && file.data && file.mimeType) {
        parts.unshift({
          inlineData: {
            data: file.data,
            mimeType: file.mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: actualModel,
        contents: { parts },
        config: {
          systemInstruction: systemInstruction,
          temperature: existingCode ? 0.05 : 0.2, // Near-zero for refinements to ensure maximum stability
          thinkingConfig: { thinkingBudget: thinkingBudget },
        },
      });

      const textOutput = response.text;
      if (!textOutput) {
        throw new Error("The model did not return any content.");
      }

      const cleanedCode = textOutput.replace(/```html/g, '').replace(/```/g, '').trim();
      res.json({ code: cleanedCode });
    } catch (error: any) {
      console.error("Gemini server-side API error:", error);
      res.status(500).json({ error: error.message || "Failed to generate application code" });
    }
  });

  // Vite dev middleware vs production static router
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
