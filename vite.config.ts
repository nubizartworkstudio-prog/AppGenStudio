import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { GoogleGenAI } from '@google/genai';

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        {
          name: 'api-generate-middleware',
          configureServer(server) {
            server.middlewares.use(async (req: any, res: any, next: any) => {
              if (req.url === '/api/generate' && req.method === 'POST') {
                try {
                  const body = await parseJsonBody(req);
                  const { prompt, model, existingCode, file, customApiKey } = body;

                  if (!prompt) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: "Prompt is required" }));
                    return;
                  }

                  const apiKey = customApiKey || env.GEMINI_API_KEY || env.API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
                  if (!apiKey) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ 
                      error: "No Gemini API key is configured. Please provide your Gemini API Key in the Studio Settings panel." 
                    }));
                    return;
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
                      temperature: existingCode ? 0.05 : 0.2,
                      thinkingConfig: { thinkingBudget: thinkingBudget },
                    },
                  });

                  const textOutput = response.text;
                  if (!textOutput) {
                    throw new Error("The model did not return any content.");
                  }

                  const cleanedCode = textOutput.replace(/```html/g, '').replace(/```/g, '').trim();
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ code: cleanedCode }));
                } catch (error: any) {
                  console.error("Gemini server-side API error in Vite dev middleware:", error);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: error.message || "Failed to generate application code" }));
                }
              } else {
                next();
              }
            });
          }
        }
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // Fix: __dirname is not available in ESM, using path.resolve() instead to point to project root
          '@': path.resolve('.'),
        }
      }
    };
});