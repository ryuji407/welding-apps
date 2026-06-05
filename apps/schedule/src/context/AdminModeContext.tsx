import React, { createContext, useContext, useState, type ReactNode } from 'react';

export type LineType = 'pipeline' | 'welding' | 'sheetMetal';

interface AdminModeContextType {
    adminStates: Record<LineType, boolean>;
    enableAdminMode: (line: LineType, password: string) => boolean;
    disableAdminMode: (line: LineType) => void;
    isAdmin: (line: LineType) => boolean;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

const ADMIN_PASSWORDS: Record<LineType, string> = {
    pipeline: '123',
    welding: '456',
    sheetMetal: '789'
};

export const AdminModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [adminStates, setAdminStates] = useState<Record<LineType, boolean>>({
        pipeline: false,
        welding: false,
        sheetMetal: false
    });

    const enableAdminMode = (line: LineType, password: string): boolean => {
        if (password === ADMIN_PASSWORDS[line]) {
            setAdminStates(prev => ({ ...prev, [line]: true }));
            return true;
        }
        return false;
    };

    const disableAdminMode = (line: LineType) => {
        setAdminStates(prev => ({ ...prev, [line]: false }));
    };

    const isAdmin = (line: LineType) => adminStates[line];

    return (
        <AdminModeContext.Provider value={{ adminStates, enableAdminMode, disableAdminMode, isAdmin }}>
            {children}
        </AdminModeContext.Provider>
    );
};

export const useAdminMode = () => {
    const context = useContext(AdminModeContext);
    if (context === undefined) {
        throw new Error('useAdminMode must be used within an AdminModeProvider');
    }
    return context;
};
