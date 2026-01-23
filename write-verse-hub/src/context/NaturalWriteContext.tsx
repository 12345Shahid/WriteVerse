import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NaturalWriteContextType {
    enabled: boolean;
    setEnabled: (enabled: boolean) => void;
    toggle: () => void;
}

const NaturalWriteContext = createContext<NaturalWriteContextType>({
    enabled: false,
    setEnabled: () => {},
    toggle: () => {}
});

export function NaturalWriteProvider({ children }: { children: ReactNode }) {
    const [enabled, setEnabled] = useState(() => {
        // Persist preference in localStorage
        const saved = localStorage.getItem('naturalWriteEnabled');
        return saved === 'true';
    });

    const handleSetEnabled = (value: boolean) => {
        setEnabled(value);
        localStorage.setItem('naturalWriteEnabled', String(value));
        console.log('[NaturalWrite] Mode:', value ? 'Natural' : 'AI');
    };

    const toggle = () => handleSetEnabled(!enabled);

    return (
        <NaturalWriteContext.Provider value={{ enabled, setEnabled: handleSetEnabled, toggle }}>
            {children}
        </NaturalWriteContext.Provider>
    );
}

export function useNaturalWrite() {
    return useContext(NaturalWriteContext);
}
