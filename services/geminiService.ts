export interface GenerationResult {
  code: string;
}

export interface FileBlob {
  data: string;
  mimeType: string;
}

async function generateDirectFromBrowser(
  prompt: string,
  model: string,
  existingCode?: string,
  signal?: AbortSignal,
  file?: FileBlob,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) {
    throw new Error(
      "Tiada Gemini API Key dijumpai. Memandangkan platform ini dihoskan sebagai aplikasi statik (cth. Vercel), anda perlu memasukkan Gemini API Key anda sendiri dalam menu 'Studio Settings' untuk menjana aplikasi."
    );
  }

  // Model name adjustment
  const cleanModel = model.startsWith("models/") ? model : `models/${model}`;

  const systemPrompt = existingCode 
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

  const parts: any[] = [];
  if (file && file.data && file.mimeType) {
    parts.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType
      }
    });
  }
  parts.push({ text: prompt });

  const url = `https://generativelanguage.googleapis.com/v1beta/${cleanModel}:generateContent?key=${apiKey}`;

  const requestBody: any = {
    contents: [
      { parts }
    ],
    systemInstruction: {
      parts: [
        { text: systemPrompt }
      ]
    },
    generationConfig: {
      temperature: existingCode ? 0.05 : 0.2
    }
  };

  // Add thinking budget if supported by model
  let thinkingBudget = 8000;
  if (cleanModel.includes('3.1') || cleanModel.includes('3')) {
    thinkingBudget = cleanModel.includes('pro') ? 32768 : 16000;
    requestBody.generationConfig.thinkingConfig = { thinkingBudget };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Gemini API responded with status ${response.status}`;
    if (message.includes("429") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit")) {
      throw new Error("QUOTA_EXHAUSTED");
    }
    throw new Error(message);
  }

  const data = await response.json();
  const candidates = data.candidates || [];
  if (!candidates.length || !candidates[0].content?.parts?.length) {
    throw new Error("The model did not return any content candidates.");
  }

  const textOutput = candidates[0].content.parts[0].text;
  const cleanedCode = textOutput.replace(/```html/g, '').replace(/```/g, '').trim();

  return { code: cleanedCode };
}

export async function generateAppCode(
  prompt: string, 
  model: string, 
  existingCode?: string, 
  signal?: AbortSignal,
  file?: FileBlob
): Promise<GenerationResult> {
  const customApiKey = localStorage.getItem('ai_studio_api_key') || '';

  try {
    let response;
    try {
      response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model,
          existingCode,
          file,
          customApiKey
        }),
        signal
      });
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError' || fetchError.message === 'AbortError') {
        throw fetchError;
      }
      
      // Connection failure: Fallback to direct call from browser
      if (customApiKey) {
        return await generateDirectFromBrowser(prompt, model, existingCode, signal, file, customApiKey);
      }
      throw fetchError;
    }

    if (response.status === 404) {
      // 404 Not Found fallback (Vercel static deploy, etc)
      return await generateDirectFromBrowser(prompt, model, existingCode, signal, file, customApiKey);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error || `Server responded with status ${response.status}`;
      
      if (message.includes("429") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit")) {
        throw new Error("QUOTA_EXHAUSTED");
      }
      throw new Error(message);
    }

    const data = await response.json();
    return {
      code: data.code
    };
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message === 'AbortError') {
      throw new Error("Generation cancelled by user.");
    }
    
    throw error;
  }
}
