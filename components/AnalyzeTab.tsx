import React, { useState } from 'react';
import { analyzeImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import Spinner from './Spinner';

const AnalyzeTab: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('Describe this image in detail.');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            setResult('');
            setError('');
        }
    };

    const handleAnalyze = async () => {
        if (!file || !prompt) {
            setError('Please upload a file and provide a prompt.');
            return;
        }
        setLoading(true);
        setError('');
        setResult('');

        try {
            const base64Data = await fileToBase64(file);
            const analysis = await analyzeImage(base64Data, file.type, prompt);
            setResult(analysis);
        } catch (err) {
            console.error(err);
            setError('Failed to analyze the content. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-800 rounded-lg shadow-2xl">
            <h1 className="text-2xl font-bold mb-4 text-purple-300">Content Analyzer</h1>
            <p className="text-gray-400 mb-6">Upload an image to have the AI analyze it based on your prompt.</p>
            
            <div className="space-y-6">
                <div className="p-6 border-2 border-dashed border-gray-600 rounded-lg text-center">
                    <input type="file" id="file-upload" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <label htmlFor="file-upload" className="cursor-pointer bg-purple-600 text-white font-bold py-2 px-4 rounded hover:bg-purple-700 transition">
                        {file ? 'Change Image' : 'Select Image'}
                    </label>
                    {file && <p className="text-gray-400 mt-2 text-sm">{file.name}</p>}
                </div>

                {preview && (
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-shrink-0 md:w-1/3">
                            <img src={preview} alt="Upload preview" className="rounded-lg w-full" />
                        </div>
                        <div className="flex-grow space-y-4">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Enter your analysis prompt"
                                className="w-full h-24 bg-gray-700 text-white placeholder-gray-400 rounded-md p-3 border-2 border-transparent focus:border-purple-500 focus:ring-0 outline-none"
                            />
                            <button
                                onClick={handleAnalyze}
                                disabled={loading || !prompt || !file}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md transition duration-300 flex items-center justify-center"
                            >
                                {loading ? <Spinner size="6" /> : 'Analyze Content'}
                            </button>
                        </div>
                    </div>
                )}

                {error && <p className="text-red-400 text-center">{error}</p>}

                {result && (
                    <div className="bg-gray-900/50 p-4 rounded-lg animate-fade-in">
                        <h3 className="text-lg font-semibold mb-2 text-purple-300">Analysis Result</h3>
                        <p className="text-gray-300 whitespace-pre-wrap">{result}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyzeTab;