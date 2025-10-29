import React, { useState } from 'react';
import { GenerateContentResponse } from '@google/genai';
import { groundedSearch, groundedMapsSearch, getQuickResponse } from '../services/geminiService';
import { GroundingChunk } from '../types';
import Spinner from './Spinner';

const GroundingTab: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [mapsQuery, setMapsQuery] = useState('What good restaurants are nearby?');
    const [quickQuery, setQuickQuery] = useState('What is the speed of light?');
    
    const [searchResult, setSearchResult] = useState<string | null>(null);
    const [searchChunks, setSearchChunks] = useState<GroundingChunk[]>([]);
    const [mapsResult, setMapsResult] = useState<string | null>(null);
    const [mapsChunks, setMapsChunks] = useState<GroundingChunk[]>([]);
    const [quickResult, setQuickResult] = useState<string | null>(null);
    
    const [loading, setLoading] = useState<'search' | 'maps' | 'quick' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!searchQuery) return;
        setLoading('search');
        setError(null);
        try {
            const response: GenerateContentResponse = await groundedSearch(searchQuery);
            setSearchResult(response.text);
            setSearchChunks(response.candidates?.[0]?.groundingMetadata?.groundingChunks || []);
        } catch (e) {
            setError('Failed to perform grounded search.');
            console.error(e);
        } finally {
            setLoading(null);
        }
    };
    
    const handleMapsSearch = () => {
        if (!mapsQuery) return;
        setLoading('maps');
        setError(null);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const response: GenerateContentResponse = await groundedMapsSearch(mapsQuery, latitude, longitude);
                    setMapsResult(response.text);
                    setMapsChunks(response.candidates?.[0]?.groundingMetadata?.groundingChunks || []);
                } catch(e) {
                    setError('Failed to perform Maps search.');
                    console.error(e);
                } finally {
                    setLoading(null);
                }
            },
            (err) => {
                setError('Could not get location. Please allow location access.');
                console.error(err);
                setLoading(null);
            }
        );
    };

    const handleQuickQuery = async () => {
        if (!quickQuery) return;
        setLoading('quick');
        setError(null);
        try {
            const response = await getQuickResponse(quickQuery);
            setQuickResult(response);
        } catch (e) {
            setError('Failed to get quick response.');
            console.error(e);
        } finally {
            setLoading(null);
        }
    }
    
    const renderChunks = (chunks: GroundingChunk[]) => (
        <div className="mt-4 space-y-2">
            <h4 className="font-semibold text-gray-400">Sources:</h4>
            <ul className="list-disc list-inside text-sm">
                {chunks.map((chunk, index) => {
                    const web = chunk.web;
                    const maps = chunk.maps;
                    if (web) return <li key={`web-${index}`}><a href={web.uri} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">{web.title}</a></li>
                    if (maps) return <li key={`maps-${index}`}><a href={maps.uri} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">{maps.title}</a></li>
                    return null;
                })}
            </ul>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-800 rounded-lg shadow-2xl space-y-8">
            <h1 className="text-2xl font-bold text-purple-300">Explore Grounding & Low-Latency</h1>
            {error && <p className="text-red-400 text-center">{error}</p>}
            
            {/* Google Search Grounding */}
            <div className="space-y-4 bg-gray-900/50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-teal-300">Google Search Grounding</h2>
                <p className="text-gray-400 text-sm">Get up-to-date information from Google Search directly in the model's response.</p>
                <div className="flex gap-2">
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="e.g., latest news on AI" className="flex-grow bg-gray-700 rounded-md p-2"/>
                    <button onClick={handleSearch} disabled={loading === 'search'} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md disabled:bg-gray-500">{loading === 'search' ? <Spinner size="5"/> : 'Search'}</button>
                </div>
                {searchResult && (
                    <div className="mt-4 p-4 bg-gray-700 rounded-md animate-fade-in">
                        <p className="whitespace-pre-wrap">{searchResult}</p>
                        {renderChunks(searchChunks)}
                    </div>
                )}
            </div>

             {/* Google Maps Grounding */}
            <div className="space-y-4 bg-gray-900/50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-blue-300">Google Maps Grounding</h2>
                <p className="text-gray-400 text-sm">Find location-based information using your current location.</p>
                 <div className="flex gap-2">
                    <input type="text" value={mapsQuery} onChange={e => setMapsQuery(e.target.value)} className="flex-grow bg-gray-700 rounded-md p-2"/>
                    <button onClick={handleMapsSearch} disabled={loading === 'maps'} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:bg-gray-500">{loading === 'maps' ? <Spinner size="5"/> : 'Find Nearby'}</button>
                </div>
                {mapsResult && (
                     <div className="mt-4 p-4 bg-gray-700 rounded-md animate-fade-in">
                        <p className="whitespace-pre-wrap">{mapsResult}</p>
                        {renderChunks(mapsChunks)}
                    </div>
                )}
            </div>

            {/* Flash Lite */}
             <div className="space-y-4 bg-gray-900/50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-pink-300">Low-Latency Responses</h2>
                <p className="text-gray-400 text-sm">Use Gemini Flash Lite for quick, simple queries that need a fast answer.</p>
                 <div className="flex gap-2">
                    <input type="text" value={quickQuery} onChange={e => setQuickQuery(e.target.value)} className="flex-grow bg-gray-700 rounded-md p-2"/>
                    <button onClick={handleQuickQuery} disabled={loading === 'quick'} className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-md disabled:bg-gray-500">{loading === 'quick' ? <Spinner size="5"/> : 'Ask'}</button>
                </div>
                {quickResult && (
                     <div className="mt-4 p-4 bg-gray-700 rounded-md animate-fade-in">
                        <p className="whitespace-pre-wrap">{quickResult}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroundingTab;