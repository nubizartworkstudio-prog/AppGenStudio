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
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model,
        existingCode,
        file
      }),
      signal
    });

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
