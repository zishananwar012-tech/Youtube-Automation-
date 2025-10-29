import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, LiveSession } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../utils/audioUtils';
import MicIcon from './icons/MicIcon';
import StopIcon from './icons/StopIcon';

const LiveTab: React.FC = () => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcription, setTranscription] = useState<{ user: string, model: string }[]>([]);
    // Fix: Use state for display and ref for the source of truth to avoid stale closures.
    const [currentTurn, setCurrentTurn] = useState({ user: '', model: '' });
    const currentTurnRef = useRef({ user: '', model: '' });

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const stopSession = useCallback(() => {
        // Fix: Disconnect processor first to prevent race conditions.
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }

        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => {
                session.close();
            }).catch(console.error);
            sessionPromiseRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        // Fix: Added cleanup for output audio context and ensure refs are nulled.
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }

        setIsActive(false);
        setIsConnecting(false);
    }, []);
    
    const startSession = async () => {
        if (isActive || isConnecting) return;

        setIsConnecting(true);
        setError(null);
        setTranscription([]);
        setCurrentTurn({ user: '', model: '' });
        currentTurnRef.current = { user: '', model: '' };

        try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = 0;
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
                        const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            // Fix: Removed conditional check to strictly follow API guidelines.
                            // The stopSession logic is updated to prevent this from being called on a null ref.
                            sessionPromiseRef.current!.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(audioContextRef.current!.destination);
                        setIsConnecting(false);
                        setIsActive(true);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        let turnUpdated = false;
                        // Fix: Use ref to update transcription data to avoid stale closures.
                        if (message.serverContent?.inputTranscription) {
                            currentTurnRef.current.user += message.serverContent.inputTranscription.text;
                            turnUpdated = true;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentTurnRef.current.model += message.serverContent.outputTranscription.text;
                            turnUpdated = true;
                        }
                        if (turnUpdated) {
                            setCurrentTurn({ ...currentTurnRef.current });
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const outCtx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                            const source = outCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outCtx.destination);
                            source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        
                        if (message.serverContent?.interrupted) {
                             for (const source of audioSourcesRef.current.values()) {
                                source.stop();
                                audioSourcesRef.current.delete(source);
                            }
                            nextStartTimeRef.current = 0;
                        }

                        if(message.serverContent?.turnComplete) {
                            const finalTurn = currentTurnRef.current;
                            setTranscription(prev => [...prev, finalTurn]);
                            currentTurnRef.current = {user: '', model: ''};
                            setCurrentTurn({user: '', model: ''});
                        }
                    },
                    onerror: (e) => {
                        console.error('Live session error:', e);
                        setError('An error occurred during the live session.');
                        stopSession();
                    },
                    onclose: () => {
                        stopSession();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
                }
            });
        } catch (err) {
            console.error(err);
            setError('Failed to start session. Please check microphone permissions.');
            setIsConnecting(false);
        }
    };

     useEffect(() => {
        return () => {
            stopSession();
        };
    }, [stopSession]);
    
    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-800 rounded-lg shadow-2xl">
            <h1 className="text-2xl font-bold mb-4 text-purple-300">Live AI Assistant</h1>
            <p className="text-gray-400 mb-6">Talk to the AI in real-time. Your conversation will be transcribed below.</p>
            <div className="flex justify-center mb-6">
                {!isActive ? (
                    <button onClick={startSession} disabled={isConnecting} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-900 text-white font-bold py-3 px-6 rounded-full transition-transform transform hover:scale-105">
                        <MicIcon /> {isConnecting ? 'Connecting...' : 'Start Conversation'}
                    </button>
                ) : (
                    <button onClick={stopSession} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full transition-transform transform hover:scale-105">
                        <StopIcon /> Stop Conversation
                    </button>
                )}
            </div>
            {error && <p className="text-red-400 text-center mb-4">{error}</p>}
            <div className="bg-gray-900/50 p-4 rounded-lg min-h-[200px] space-y-4">
                 {transcription.map((turn, i) => (
                    <div key={i} className="space-y-2">
                        <p><strong className="text-purple-400">You:</strong> {turn.user}</p>
                        <p><strong className="text-teal-400">AI:</strong> {turn.model}</p>
                    </div>
                ))}
                {isActive && (
                    <div className="space-y-2 opacity-70">
                         <p><strong className="text-purple-400">You:</strong> {currentTurn.user}</p>
                         <p><strong className="text-teal-400">AI:</strong> {currentTurn.model}</p>
                    </div>
                )}
                {!isActive && transcription.length === 0 && <p className="text-gray-500">Conversation transcript will appear here...</p>}
            </div>
        </div>
    );
};

export default LiveTab;