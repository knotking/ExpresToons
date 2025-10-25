import { GoogleGenAI, Modality } from "@google/genai";
import { StyleType } from "./types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = 'gemini-2.5-flash-image';

const fileToGenerativePart = async (file: File): Promise<{
  inlineData: {
    data: string;
    mimeType: string;
  };
}> => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        resolve('');
      }
    };
    reader.readAsDataURL(file);
  });
  const base64EncodedData = await base64EncodedDataPromise;
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
};

const getCartoonPrompt = (
  description: string,
  styleType: StyleType,
  styleName: string,
  signature: string,
  hasCharacterImage: boolean,
  colorOption: 'color' | 'black_and_white'
) => {
  const signatureText = signature
    ? ` Subtly place the signature '${signature}' in one of the bottom corners of the image.`
    : '';
  const stylePrompt = styleType === 'magazine'
    ? `in the distinct artistic style of ${styleName} magazine`
    : `in the distinct artistic style of cartoonist ${styleName}`;
  
  const characterInstruction = hasCharacterImage 
    ? ' Feature the character from the provided image in the scene.' 
    : '';
  
  const colorInstruction = colorOption === 'black_and_white' 
    ? ' The cartoon should be in black and white.'
    : ' The cartoon should be in full color.';

  return `Generate a single-panel cartoon ${stylePrompt}. The scene is: ${description}.${characterInstruction}${colorInstruction} The cartoon should be humorous and thought-provoking, capturing the essence of the specified style.${signatureText}`;
};

export const generateCartoon = async (
  description: string,
  styleType: StyleType,
  styleName: string,
  signature: string,
  characterImage: File | null,
  colorOption: 'color' | 'black_and_white'
): Promise<string> => {
  const prompt = getCartoonPrompt(description, styleType, styleName, signature, !!characterImage, colorOption);
  
  const parts: any[] = [];
  if (characterImage) {
      const imagePart = await fileToGenerativePart(characterImage);
      parts.push(imagePart);
  }
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts,
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error('No image generated.');
};

export const editImage = async (
  imageFile: File,
  prompt: string
): Promise<string> => {
  const imagePart = await fileToGenerativePart(imageFile);
  const textPart = { text: prompt };

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [imagePart, textPart],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error('No image generated from edit.');
};