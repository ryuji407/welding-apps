import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    toggleCollapsed: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        localStorage.setItem('mfg_sidebarCollapsed', String(isCollapsed));
    }, [isCollapsed]);

    const toggleCollapsed = () => setIsCollapsed(!isCollapsed);

    return (
        <SidebarContext.Provider value={{
            isSidebarOpen,
            setIsSidebarOpen,
            isCollapsed,
            setIsCollapsed,
            toggleCollapsed
        }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
};
