import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BrandVoiceContextType {
  selectedVoiceId: string | undefined;
  setSelectedVoiceId: (id: string | undefined) => void;
}

const BrandVoiceContext = createContext<BrandVoiceContextType | undefined>(undefined);

export const BrandVoiceProvider = ({ children }: { children: ReactNode }) => {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>(undefined);

  return (
    <BrandVoiceContext.Provider value={{ selectedVoiceId, setSelectedVoiceId }}>
      {children}
    </BrandVoiceContext.Provider>
  );
};

export const useBrandVoice = () => {
  const context = useContext(BrandVoiceContext);
  if (context === undefined) {
    throw new Error('useBrandVoice must be used within a BrandVoiceProvider');
  }
  return context;
};
