import { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';

// Fix: Removed global declaration for window.aistudio to avoid conflicts
// with other declarations in the project. The type is expected to be
// available globally from another file.

export const useVeo = () => {
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');
    const [apiKeySelected, setApiKeySelected] = useState(false);

    const checkAndSetApiKey = useCallback(async () => {
        try {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
            return hasKey;
        } catch (e) {
            console.error('Error checking API key:', e);
            setApiKeySelected(false);
            return false;
        }
    }, []);

    const selectApiKey = async () => {
        try {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true);
        } catch (e) {
            console.error('Error opening API key selection:', e);
            setError('Failed to open API key selection. Please try again.');
        }
    };
    
    const generateVideo = useCallback(async (
        prompt: string, 
        aspectRatio: '16:9' | '9:16',
        resolution: '720p' | '1080p',
        image?: { base64: string; mimeType: string }
    ) => {
        setIsLoading(true);
        setError(null);
        setVideoUrl(null);
        setProgress('Initializing video generation...');

        try {
             // Create a new instance right before the call to ensure the latest key is used.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const requestPayload: any = {
                model: 'veo-3.1-fast-generate-preview',
                prompt,
                config: {
                    numberOfVideos: 1,
                    resolution: resolution,
                    aspectRatio: aspectRatio
                }
            };

            if (image) {
                requestPayload.image = {
                    imageBytes: image.base64,
                    mimeType: image.mimeType
                };
            }

            let operation = await ai.models.generateVideos(requestPayload);
            setProgress('Video generation started. This may take a few minutes...');

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({ operation: operation });
                setProgress('Still processing... Your video is being created.');
            }

            if(operation.error) {
                throw new Error(operation.error.message);
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                 setProgress('Fetching final video...');
                 const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                 const blob = await response.blob();
                 setVideoUrl(URL.createObjectURL(blob));
            } else {
                throw new Error("Video generation completed but no download link was found.");
            }
        } catch (err: any) {
            console.error(err);
            let errorMessage = err.message || 'An unknown error occurred.';
             if (errorMessage.includes("Requested entity was not found.") || errorMessage.includes("API key not valid")) {
                errorMessage = "Your API key is invalid or not found. Please select a valid key.";
                setApiKeySelected(false); // Reset key state
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    }, []);

    return { videoUrl, isLoading, error, progress, apiKeySelected, checkAndSetApiKey, selectApiKey, generateVideo };
};