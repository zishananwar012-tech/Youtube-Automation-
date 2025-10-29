import React, { useState } from 'react';
import { Tab } from './types';
import Header from './components/Header';
import CreatorTab from './components/CreatorTab';
import ChatTab from './components/ChatTab';
import LiveTab from './components/LiveTab';
import AnalyzeTab from './components/AnalyzeTab';
import GroundingTab from './components/GroundingTab';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CREATOR);

  const renderTab = () => {
    switch (activeTab) {
      case Tab.CREATOR:
        return <CreatorTab />;
      case Tab.CHAT:
        return <ChatTab />;
      case Tab.LIVE:
        return <LiveTab />;
      case Tab.ANALYZE:
        return <AnalyzeTab />;
      case Tab.GROUNDING:
        return <GroundingTab />;
      default:
        return <CreatorTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {renderTab()}
      </main>
      <footer className="text-center p-4 text-xs text-gray-500">
        <p>Built with Gemini API. For demo purposes only.</p>
      </footer>
    </div>
  );
};

export default App;