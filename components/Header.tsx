import React from 'react';
import { Tab } from '../types';
import TabButton from './TabButton';

interface HeaderProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between h-auto sm:h-20 py-4 sm:py-0">
          <div className="flex items-center mb-4 sm:mb-0">
            <svg className="w-8 h-8 mr-2 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.582,6.418H2.418A2.421,2.421,0,0,0,0,8.838V21.582A2.421,2.421,0,0,0,2.418,24H21.582A2.421,2.421,0,0,0,24,21.582V8.838A2.421,2.421,0,0,0,21.582,6.418ZM11,20.5,5.5,17.25v-6.5L11,14ZM18.5,17.25,13,20.5V14l5.5-3.25Z M12,0,5.5,3.75,12,7.5,18.5,3.75Z"/>
            </svg>
            <h1 className="text-2xl font-bold text-white">AutoYouTubeCreator</h1>
          </div>
          <nav className="flex flex-wrap justify-center sm:justify-end space-x-2">
            {Object.values(Tab).map((tab) => (
              <TabButton
                key={tab}
                onClick={() => setActiveTab(tab)}
                isActive={activeTab === tab}
              >
                {tab}
              </TabButton>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;