import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface FSSAIData {
  entityName: string;
  address: string;
  state: string;
  city: string;
  fssaiLicenseNo: string;
  category100: "Yes" | "No";
  validUpto: string;
}

export const extractFSSAIData = async (fileBase64: string, mimeType: string): Promise<FSSAIData> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Extract specific information from this FSSAI License document.
    
    1. Entity Name: Locate the section "Name & Registered Office address of Licensee" and extract only the name.
    2. Address: Extract the complete address from "Address of Authorized Premises." Do not omit any details (Building, Street, Area, etc.).
    3. State & City: Identify the City and State specifically from the "Address of Authorized Premises."
    4. FSSAI License No: Extract the 14-digit number found next to "License Number:".
    5. Valid Upto: Extract the date found next to "Valid Upto:".
    6. 100 Category (Yes/No): Look at the "Food Category" section. If you find the exact phrase "100 - Standardised Food Product excluding those covered under category 1-14", mark this as "Yes". Otherwise, mark it as "No".
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: fileBase64.split(",")[1] || fileBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            entityName: { type: Type.STRING, description: "Extracted entity name" },
            address: { type: Type.STRING, description: "Complete address of authorized premises" },
            state: { type: Type.STRING, description: "State identified from address" },
            city: { type: Type.STRING, description: "City identified from address" },
            fssaiLicenseNo: { type: Type.STRING, description: "14-digit license number" },
            category100: { 
              type: Type.STRING, 
              enum: ["Yes", "No"],
              description: "Yes if '100 - Standardised Food Product...' is present" 
            },
            validUpto: { type: Type.STRING, description: "Expiration date" },
          },
          required: ["entityName", "address", "state", "city", "fssaiLicenseNo", "category100", "validUpto"],
        },
      },
    });

    if (!response.text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(response.text) as FSSAIData;
  } catch (error) {
    console.error("Extraction error:", error);
    throw error;
  }
};
