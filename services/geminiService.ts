import { GoogleGenAI, Type } from "@google/genai";

export interface GenerationResult {
  code: string;
}

export interface FileBlob {
  data: string;
  mimeType: string;
}

export async function generateAppCode(
  prompt: string, 
  model: string, 
  existingCode?: string, 
  signal?: AbortSignal,
  file?: FileBlob
): Promise<GenerationResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const actualModel = model;

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
       ${existingCode}

       USER REQUEST:
       ${prompt}`
    : `You are an expert full-stack web developer. 
       Your task is to generate a COMPLETE, functional, and visually stunning single-file HTML application based on the user's prompt.
       
       REQUIREMENTS:
       - Use modern CSS (Tailwind CSS via CDN).
       - Ensure responsiveness.
       - Include all necessary logic in <script> tags.
       
       OUTPUT:
       Return ONLY the raw HTML code starting with <!DOCTYPE html>. Do not use markdown code blocks (\`\`\`html).`;

  let thinkingBudget = 8000;
  if (actualModel.includes('3.1')) {
    thinkingBudget = actualModel.includes('pro') ? 32768 : 16000;
  } else if (actualModel.includes('3')) {
    thinkingBudget = actualModel.includes('pro') ? 32768 : 16000;
  }

  const parts: any[] = [{ text: prompt }];
  if (file) {
    parts.unshift({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: actualModel,
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: existingCode ? 0.05 : 0.2, // Near-zero for refinements to ensure maximum stability
        thinkingConfig: { thinkingBudget: thinkingBudget },
      },
    });

    if (signal?.aborted) {
      throw new Error("AbortError");
    }

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("The model did not return any content.");
    }

    return {
      code: textOutput.replace(/```html/g, '').replace(/```/g, '').trim()
    };
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message === 'AbortError') {
      throw new Error("Generation cancelled by user.");
    }
    
    const errorMessage = error.message || "Unknown error";
    if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota") || errorMessage.toLowerCase().includes("rate limit")) {
      throw new Error("QUOTA_EXHAUSTED");
    }

    console.error("Gemini API Error:", error);
    throw new Error(`Generation failed: ${errorMessage}`);
  }
}
