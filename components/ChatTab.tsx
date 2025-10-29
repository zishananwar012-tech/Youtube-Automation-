import React, { useState, useRef, useEffect } from 'react';
import { Chat } from '@google/genai';
import { ChatMessage } from '../types';
import { createChat } from '../services/geminiService';
import SendIcon from './icons/SendIcon';
import Spinner from './Spinner';

const ChatTab: React.FC = () => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setChat(createChat());
    }, []);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleSend = async () => {
        if (!input.trim() || !chat) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: input }] };
        setHistory(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const result = await chat.sendMessageStream({ message: input });
            
            let modelResponseText = '';
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: '' }] }]);

            for await (const chunk of result) {
                modelResponseText += chunk.text;
                 setHistory(prev => {
                    const newHistory = [...prev];
                    newHistory[newHistory.length - 1] = { role: 'model', parts: [{ text: modelResponseText }] };
                    return newHistory;
                });
            }
        } catch (error) {
            console.error(error);
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: "Sorry, I encountered an error." }] }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl">
            <h1 className="text-2xl font-bold p-4 border-b border-gray-700 text-purple-300">AI Assistant Chat</h1>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {history.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-lg px-4 py-2 rounded-xl ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                            <p className="whitespace-pre-wrap">{msg.parts[0].text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                         <div className="max-w-lg px-4 py-2 rounded-xl bg-gray-700 text-gray-200">
                             <Spinner size="5"/>
                         </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-gray-700">
                <div className="flex items-center bg-gray-700 rounded-lg p-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                        placeholder="Ask me anything..."
                        className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="p-2 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed transition-colors"
                    >
                        <SendIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatTab;