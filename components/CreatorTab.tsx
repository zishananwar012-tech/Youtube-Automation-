import React, { useState, useEffect } from 'react';
import { generateScript, generateImages, generateVoiceover, editImage } from '../services/geminiService';
import { Script, GeneratedImage } from '../types';
import Spinner from './Spinner';
import { useVeo } from '../hooks/useVeo';
import { decode, decodeAudioData } from '../utils/audioUtils';
import { fileToBase64, base64ToBlob } from '../utils/fileUtils';

const DRAFT_KEY = 'autoYouTubeCreatorDraft';

interface CreatorDraft {
    topic: string;
    useGrounding: boolean;
    script: Script | null;
    images: GeneratedImage[];
    voiceoverB64: string | null;
    aspectRatio: '16:9' | '9:16';
    veoImage: { base64: string; mimeType: string } | null;
    currentStep: number;
}

interface TextOverlayProps {
    text: string;
    fontStyle: string;
    fontSize: number;
    fontColor: string;
    animationStyle: string;
    videoKey: number; 
}

const TextOverlay: React.FC<TextOverlayProps> = ({ text, fontStyle, fontSize, fontColor, animationStyle, videoKey }) => {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (animationStyle === 'typewriter') {
            setDisplayedText(''); 
            if (text) {
                let i = 0;
                interval = setInterval(() => {
                    i++;
                    setDisplayedText(text.substring(0, i));
                    if (i >= text.length) {
                        clearInterval(interval);
                    }
                }, 80); 
            }
        } else {
            setDisplayedText(text);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [text, animationStyle, videoKey]);

    const style: React.CSSProperties = {
        fontFamily: fontStyle,
        fontSize: `${fontSize}px`,
        color: fontColor,
        textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
    };
    
    let animationClass = '';
    if (animationStyle === 'fadeIn') {
        animationClass = 'animate-fade-in-slow'; 
    }

    return (
        <div 
            key={`${animationStyle}-${videoKey}`}
            style={style}
            className={`absolute bottom-[15%] left-1/2 -translate-x-1/2 w-full px-4 text-center pointer-events-none ${animationClass}`}
        >
            <p className="break-words">{displayedText}</p>
        </div>
    );
};


const CreatorTab: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [useGrounding, setUseGrounding] = useState(false);
    const [script, setScript] = useState<Script | null>(null);
    const [editableScript, setEditableScript] = useState('');
    const [isScriptEditing, setIsScriptEditing] = useState(false);
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [voiceoverB64, setVoiceoverB64] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [veoImage, setVeoImage] = useState<{base64: string; mimeType: string} | null>(null);
    const [veoImagePreview, setVeoImagePreview] = useState<string | null>(null);

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState<'script' | 'images' | 'voice' | 'edit' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState('');
    
    const { videoUrl, isLoading: isVeoLoading, error: veoError, progress: veoProgress, apiKeySelected, checkAndSetApiKey, selectApiKey, generateVideo } = useVeo();

    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editPrompt, setEditPrompt] = useState('');
    const [isVeoEditing, setIsVeoEditing] = useState(false);
    const [veoEditPrompt, setVeoEditPrompt] = useState('');
    
    // State for text overlay
    const [overlayText, setOverlayText] = useState('Your Title Here');
    const [fontStyle, setFontStyle] = useState(`'Arial', sans-serif`);
    const [fontSize, setFontSize] = useState(48);
    const [fontColor, setFontColor] = useState('#FFFFFF');
    const [animationStyle, setAnimationStyle] = useState('none');
    const [videoKey, setVideoKey] = useState(0);
    const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');

    useEffect(() => {
        if(videoUrl) {
            setVideoKey(prev => prev + 1);
        }
    }, [videoUrl]);
    
    useEffect(() => {
        checkAndSetApiKey();
    }, [checkAndSetApiKey]);

    const showStatusMessage = (message: string, duration = 3000) => {
        setStatusMessage(message);
        setTimeout(() => setStatusMessage(''), duration);
    };

    const handleSaveDraft = () => {
        const draft: CreatorDraft = {
            topic,
            useGrounding,
            script,
            images,
            voiceoverB64,
            aspectRatio,
            veoImage,
            currentStep,
        };
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            showStatusMessage('Draft saved successfully!');
        } catch (e) {
            console.error("Failed to save draft", e);
            showStatusMessage('Error saving draft.');
        }
    };

    const handleLoadDraft = () => {
        try {
            const savedDraft = localStorage.getItem(DRAFT_KEY);
            if (savedDraft) {
                const draft: CreatorDraft = JSON.parse(savedDraft);
                setTopic(draft.topic || '');
                setUseGrounding(draft.useGrounding || false);
                setScript(draft.script || null);
                setEditableScript(draft.script ? JSON.stringify(draft.script, null, 2) : '');
                setImages(draft.images || []);
                setVoiceoverB64(draft.voiceoverB64 || null);
                setAspectRatio(draft.aspectRatio || '16:9');
                setVeoImage(draft.veoImage || null);
                setCurrentStep(draft.currentStep || 1);
                
                if (veoImagePreview) URL.revokeObjectURL(veoImagePreview);
                if (draft.veoImage) {
                    const blob = base64ToBlob(draft.veoImage.base64, draft.veoImage.mimeType);
                    setVeoImagePreview(URL.createObjectURL(blob));
                } else {
                    setVeoImagePreview(null);
                }
                showStatusMessage('Draft loaded successfully!');
            } else {
                showStatusMessage('No saved draft found.');
            }
        } catch (e) {
            console.error("Failed to load draft", e);
            showStatusMessage('Could not load draft. It might be corrupted.');
        }
    };

    const handleGenerateScript = async () => {
        if (!topic) {
            setError('Please enter a topic.');
            return;
        }
        setLoading('script');
        setError(null);
        setScript(null);
        setImages([]);
        setVoiceoverB64(null);
        setCurrentStep(1);
        try {
            const result = await generateScript(topic, useGrounding);
            setScript(result);
            setEditableScript(JSON.stringify(result, null, 2));
            setCurrentStep(2);
        } catch (e: any) {
            setError(e.message || 'Failed to generate script. Please try again.');
            console.error(e);
        } finally {
            setLoading(null);
        }
    };

    const handleSaveScriptEdit = () => {
        try {
            const updatedScript = JSON.parse(editableScript);
            setScript(updatedScript);
            setIsScriptEditing(false);
        } catch (e) {
            setError("Invalid JSON format in script. Please correct it.");
        }
    };

    const handleGenerateVisuals = async () => {
        if (!script) return;
        setLoading('images');
        setError(null);
        try {
            const prompts = script.scenes.map(s => s.imagePrompt);
            const base64Images = await generateImages(prompts, aspectRatio);
            setImages(base64Images.map((base64, i) => ({ prompt: prompts[i], base64 })));
            setCurrentStep(3);
        } catch (e) {
            setError('Failed to generate images. Please try again.');
            console.error(e);
        } finally {
            setLoading(null);
        }
    };

    const handleVeoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (veoImagePreview) {
            URL.revokeObjectURL(veoImagePreview);
        }
        const file = e.target.files?.[0];
        if (file) {
            try {
                setVeoImagePreview(URL.createObjectURL(file));
                const base64 = await fileToBase64(file);
                setVeoImage({ base64, mimeType: file.type });
            } catch (err) {
                setError("Failed to read image file.");
                setVeoImagePreview(null);
                setVeoImage(null);
                console.error(err);
            }
        }
    };

    const handleGenerateVoiceover = async () => {
        if (!script) return;
        setLoading('voice');
        setError(null);
        try {
            const fullScriptText = script.scenes.map(s => s.description).join('\n');
            const audioB64 = await generateVoiceover(fullScriptText);
            setVoiceoverB64(audioB64);
        } catch (e) {
            setError('Failed to generate voiceover. Please try again.');
            console.error(e);
        } finally {
            setLoading(null);
        }
    };

    const handlePlayVoiceover = async () => {
        if (!voiceoverB64) return;
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const decodedBytes = decode(voiceoverB64);
            const audioBuffer = await decodeAudioData(decodedBytes, audioContext, 24000, 1);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
        } catch (e) {
            setError('Could not play audio.');
            console.error(e);
        }
    };

    const handleGenerateVideo = () => {
        if (!script) {
            setError("Please generate a script first.");
            return;
        }
        if (images.length === 0 && !veoImage) {
            setError("Please generate or upload at least one image.");
            return;
        }
        
        const fullPrompt = `${script.title}. ${script.scenes.map(s => s.description).join(' ')}`;
        const imageToUse = veoImage ? veoImage : { base64: images[0].base64, mimeType: 'image/jpeg' };
        generateVideo(fullPrompt, aspectRatio, resolution, imageToUse);
    };

    const handleDownloadVideo = () => {
        if (!videoUrl || !script) return;
        const a = document.createElement('a');
        a.href = videoUrl;
        const fileName = `${script.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const startEditing = (index: number) => {
        setEditingIndex(index);
        setEditPrompt(''); // Clear previous prompt
    };

    const cancelEditing = () => {
        setEditingIndex(null);
        setEditPrompt('');
    };

    const handleApplyEdit = async () => {
        if (!editPrompt || editingIndex === null) return;
        setLoading('edit');
        setError(null);
        try {
            const originalImage = images[editingIndex];
            const editedBase64 = await editImage(originalImage.base64, 'image/jpeg', editPrompt);
            const newImages = [...images];
            newImages[editingIndex] = { ...originalImage, base64: editedBase64 };
            setImages(newImages);
            cancelEditing(); // Reset UI
        } catch(e) {
            setError('Failed to edit image.');
            console.error(e);
        } finally {
            setLoading(null);
        }
    }

    const handleApplyVeoEdit = async () => {
        if (!veoEditPrompt || !veoImage || !veoImagePreview) return;
        setLoading('edit');
        setError(null);
        try {
            const editedBase64 = await editImage(veoImage.base64, veoImage.mimeType, veoEditPrompt);
            const updatedVeoImage = { ...veoImage, base64: editedBase64 };
            setVeoImage(updatedVeoImage);

            // Update preview
            const blob = base64ToBlob(editedBase64, veoImage.mimeType);
            URL.revokeObjectURL(veoImagePreview); 
            setVeoImagePreview(URL.createObjectURL(blob));

            setIsVeoEditing(false);
            setVeoEditPrompt('');
        } catch(e) {
            setError('Failed to edit uploaded image.');
            console.error(e);
        } finally {
            setLoading(null);
        }
    }

    const renderStep1 = () => (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-purple-300">Step 1: Choose Your Topic</h2>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., The History of Ancient Rome"
                    className="flex-grow bg-gray-700 text-white placeholder-gray-400 rounded-md p-3 border-2 border-transparent focus:border-purple-500 focus:ring-0 outline-none"
                />
            </div>
            <div className="flex items-center space-x-2 mb-4">
                 <input type="checkbox" id="grounding-checkbox" checked={useGrounding} onChange={(e) => setUseGrounding(e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                 <label htmlFor="grounding-checkbox" className="text-sm text-gray-300">Use Google Search for up-to-date info</label>
            </div>
            <button
                onClick={handleGenerateScript}
                disabled={loading === 'script'}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md transition duration-300 flex items-center justify-center w-full sm:w-auto"
            >
                {loading === 'script' ? <Spinner size="6" /> : 'Generate Script'}
            </button>
        </div>
    );

    const renderStep2 = () => (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-6 animate-fade-in">
            <h2 className="text-2xl font-bold mb-4 text-purple-300">Step 2: Review & Edit Script</h2>
            { isScriptEditing ? (
                 <div>
                    <textarea 
                        value={editableScript}
                        onChange={(e) => setEditableScript(e.target.value)}
                        className="w-full h-64 bg-gray-900 text-gray-200 font-mono text-sm p-2 rounded-md border border-gray-600"
                    />
                    <div className="flex gap-2 mt-2">
                        <button onClick={handleSaveScriptEdit} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md">Save</button>
                        <button onClick={() => { setIsScriptEditing(false); setEditableScript(JSON.stringify(script, null, 2)); }} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md">Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-700 p-4 rounded-md mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xl font-semibold">{script?.title}</h3>
                        <button onClick={() => setIsScriptEditing(true)} className="text-sm text-purple-400 hover:underline">Edit Script</button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {script?.scenes.map((scene, i) => <p key={i} className="text-sm text-gray-300">{i + 1}. {scene.description}</p>)}
                    </div>
                </div>
            )}
            <button
                onClick={handleGenerateVisuals}
                disabled={loading === 'images' || isScriptEditing}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md transition duration-300 w-full flex items-center justify-center"
            >
                {loading === 'images' ? <Spinner size="6" /> : 'Confirm Script & Generate Visuals'}
            </button>
        </div>
    );

    const renderStep3 = () => (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-6 animate-fade-in">
            <h2 className="text-2xl font-bold mb-4 text-purple-300">Step 3: Review Visuals</h2>
             <div className="flex items-center gap-4 mb-4">
                 <label className="font-semibold">Aspect Ratio:</label>
                 <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as '16:9' | '9:16')} className="bg-gray-700 rounded-md p-2 border-2 border-transparent focus:border-purple-500 focus:ring-0 outline-none">
                     <option value="16:9">16:9 (Landscape)</option>
                     <option value="9:16">9:16 (Portrait)</option>
                 </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                {images.map((image, i) => (
                    <div key={i} className="relative group aspect-video">
                        <img src={`data:image/jpeg;base64,${image.base64}`} alt={image.prompt} className="rounded-lg w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => startEditing(i)} className="bg-purple-600 text-white px-3 py-1 rounded-md text-sm">Edit</button>
                         </div>
                    </div>
                ))}
            </div>
            {editingIndex !== null && (
                 <div className="bg-gray-700 p-4 rounded-lg mb-4">
                     <h3 className="font-semibold mb-2">Editing Image {editingIndex+1}</h3>
                     <div className="flex gap-2">
                         <input type="text" value={editPrompt} onChange={e => setEditPrompt(e.target.value)} placeholder="e.g., add a retro filter" className="flex-grow bg-gray-600 rounded-md p-2"/>
                         <button onClick={handleApplyEdit} disabled={loading === 'edit'} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:bg-gray-500">{loading === 'edit' ? <Spinner size="4"/> : 'Apply'}</button>
                         <button onClick={cancelEditing} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md">Cancel</button>
                     </div>
                 </div>
            )}
            <div className="bg-gray-700 p-4 rounded-lg mb-4">
                <h3 className="font-semibold mb-2">Upload Image for Video (Optional)</h3>
                <input type="file" accept="image/*" onChange={handleVeoFileChange} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"/>
                {veoImagePreview && (
                    <div className="mt-4 text-center">
                        <div className="relative inline-block group">
                            <img src={veoImagePreview} className="rounded-lg max-w-xs mx-auto" alt="VEO upload preview" />
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setIsVeoEditing(true)} disabled={isVeoEditing} className="bg-purple-600 text-white px-3 py-1 rounded-md text-sm disabled:bg-gray-500">Edit</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {isVeoEditing && (
                <div className="bg-gray-700 p-4 rounded-lg mb-4 animate-fade-in">
                    <h3 className="font-semibold mb-2">Editing Uploaded Image</h3>
                    <div className="flex gap-2">
                        <input type="text" value={veoEditPrompt} onChange={e => setVeoEditPrompt(e.target.value)} placeholder="e.g., make it look like a painting" className="flex-grow bg-gray-600 rounded-md p-2"/>
                        <button onClick={handleApplyVeoEdit} disabled={loading === 'edit'} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:bg-gray-500">{loading === 'edit' ? <Spinner size="4"/> : 'Apply'}</button>
                        <button onClick={() => setIsVeoEditing(false)} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md">Cancel</button>
                    </div>
                </div>
            )}
            <button
                onClick={() => setCurrentStep(4)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-md transition duration-300 w-full flex items-center justify-center"
            >
                Confirm Visuals & Proceed to Finalization
            </button>
        </div>
    );
    
    const renderStep4 = () => (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-6 animate-fade-in">
             <h2 className="text-2xl font-bold mb-4 text-purple-300">Step 4: Generate Final Assets</h2>
             <div className="bg-gray-700/50 p-4 rounded-lg mb-6">
                <h3 className="text-lg font-semibold mb-2">Video Settings</h3>
                <div>
                    <label htmlFor="resolution-select" className="block text-sm font-medium text-gray-300 mb-1">Resolution</label>
                    <select 
                        id="resolution-select"
                        value={resolution} 
                        onChange={e => setResolution(e.target.value as '720p' | '1080p')}
                        className="w-full max-w-xs bg-gray-600 rounded-md p-2 border-2 border-transparent focus:border-purple-500 focus:ring-0 outline-none"
                    >
                        <option value="720p">720p (Fast)</option>
                        <option value="1080p">1080p (HD)</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Higher resolution may increase generation time.</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <button
                    onClick={handleGenerateVoiceover}
                    disabled={loading === 'voice'}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md transition duration-300 w-full flex items-center justify-center"
                >
                    {loading === 'voice' ? <Spinner size="6" /> : '1. Generate Voiceover (TTS)'}
                </button>
                <button
                    onClick={handleGenerateVideo}
                    disabled={isVeoLoading || !apiKeySelected}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md transition duration-300 w-full flex items-center justify-center"
                >
                    {isVeoLoading ? <Spinner size="6"/> : '2. Generate Video (Veo)'}
                </button>
            </div>
             {!apiKeySelected && (
                 <div className="mt-4 text-center p-4 bg-yellow-900/50 rounded-lg border border-yellow-700">
                     <p className="mb-2 text-yellow-200">Video generation requires an API key.</p>
                     <button onClick={selectApiKey} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md">Select API Key</button>
                     <p className="text-xs text-yellow-400 mt-2">This is a mandatory step for using Veo. For more details, see the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">billing documentation</a>.</p>
                 </div>
            )}

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {voiceoverB64 && (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Voiceover Output</h3>
                        <button onClick={handlePlayVoiceover} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md">Play Audio</button>
                    </div>
                )}
                <div>
                     <h3 className="text-lg font-semibold mb-2">Video Output</h3>
                     {isVeoLoading && <Spinner text={veoProgress || "Generating video..."} />}
                     {veoError && <p className="text-red-400">{veoError}</p>}
                     {videoUrl && (
                        <div className="relative">
                            <video key={videoKey} src={videoUrl} controls className="w-full rounded-lg"></video>
                            <TextOverlay 
                                text={overlayText}
                                fontStyle={fontStyle}
                                fontSize={fontSize}
                                fontColor={fontColor}
                                animationStyle={animationStyle}
                                videoKey={videoKey}
                            />
                        </div>
                     )}
                </div>
             </div>
             {videoUrl && (
                <>
                <div className="mt-6 bg-gray-700/50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Text Overlay Customization</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label htmlFor="overlay-text" className="block text-sm font-medium text-gray-300 mb-1">Overlay Text</label>
                            <input
                                id="overlay-text"
                                type="text"
                                value={overlayText}
                                onChange={(e) => setOverlayText(e.target.value)}
                                className="w-full bg-gray-600 rounded-md p-2 border-2 border-transparent focus:border-purple-500 focus:ring-0 outline-none"
                            />
                        </div>
                        <div>
                            <label htmlFor="font-style" className="block text-sm font-medium text-gray-300 mb-1">Font Style</label>
                            <select id="font-style" value={fontStyle} onChange={e => setFontStyle(e.target.value)} className="w-full bg-gray-600 rounded-md p-2 border-2 border-transparent focus:border-purple-500 focus:ring-0 outline-none">
                                <option value="'Arial', sans-serif">Arial</option>
                                <option value="'Georgia', serif">Georgia</option>
                                <option value="'Courier New', monospace">Courier New</option>
                                <option value="'Brush Script MT', cursive">Brush Script</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="font-size" className="block text-sm font-medium text-gray-300 mb-1">Font Size (px)</label>
                            <input
                                id="font-size"
                                type="number"
                                value={fontSize}
                                onChange={(e) => setFontSize(parseInt(e.target.value, 10) || 0)}
                                className="w-full bg-gray-600 rounded-md p-2 border-2 border-transparent focus:border-purple-500 focus:ring-0 outline-none"
                            />
                        </div>
                        <div>
                            <label htmlFor="font-color" className="block text-sm font-medium text-gray-300 mb-1">Font Color</label>
                            <input
                                id="font-color"
                                type="color"
                                value={fontColor}
                                onChange={(e) => setFontColor(e.target.value)}
                                className="w-full h-10 bg-gray-600 rounded-md p-1 cursor-pointer"
                            />
                        </div>
                        <div>
                            <label htmlFor="animation-style" className="block text-sm font-medium text-gray-300 mb-1">Animation</label>
                            <select id="animation-style" value={animationStyle} onChange={e => setAnimationStyle(e.target.value)} className="w-full bg-gray-600 rounded-md p-2 border-2 border-transparent focus:border-purple-500 focus:ring-0 outline-none">
                                <option value="none">None</option>
                                <option value="fadeIn">Fade In</option>
                                <option value="typewriter">Typewriter</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="mt-6 bg-gray-700/50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Export Options</h3>
                    <p className="text-sm text-gray-400 mb-4">Download your generated video. Only MP4 format is available. 4K resolution and other formats like MOV are not supported by the current model.</p>
                    <button onClick={handleDownloadVideo} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2">
                        Download Video (MP4)
                    </button>
                </div>
                </>
            )}
        </div>
    );

    return (
        <div className="space-y-8">
            <h1 className="text-4xl font-extrabold text-center tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                Automated YouTube Video Creation
            </h1>
            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg text-center" role="alert">{error}</div>}
            
             <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
                <div className="text-sm text-gray-400">
                    Don't lose your progress. Save your work and continue later.
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSaveDraft} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md text-sm">Save Draft</button>
                    <button onClick={handleLoadDraft} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md text-sm">Load Draft</button>
                </div>
            </div>
            {statusMessage && (
                <div className="text-center p-2 bg-green-900/50 rounded-md text-green-300 transition-opacity duration-300 animate-fade-in" role="status">
                    {statusMessage}
                </div>
            )}

            {renderStep1()}
            {currentStep >= 2 && script && renderStep2()}
            {currentStep >= 3 && images.length > 0 && renderStep3()}
            {currentStep >= 4 && renderStep4()}
        </div>
    );
};

export default CreatorTab;