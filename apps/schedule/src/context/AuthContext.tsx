import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type UserRole = 'admin' | 'user' | null;
type ProductionLine = 'pipeline' | 'welding' | 'sheetMetal';

interface AuthContextType {
    user: User | null;
    role: UserRole;
    adminLines: ProductionLine[];
    loading: boolean;
    signOut: () => Promise<void>;
    isAdminFor: (line: ProductionLine) => boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    adminLines: [],
    loading: true,
    signOut: async () => { },
    isAdminFor: () => false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [adminLines, setAdminLines] = useState<ProductionLine[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Fetch role from Firestore
                try {
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    console.log('[AuthContext] User UID:', currentUser.uid);
                    console.log('[AuthContext] User doc exists:', userDoc.exists());
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        console.log('[AuthContext] Firestore data:', data);
                        console.log('[AuthContext] role:', data.role);
                        console.log('[AuthContext] adminLines:', data.adminLines);
                        setRole(data.role as UserRole);
                        setAdminLines((data.adminLines as ProductionLine[]) || []);
                    } else {
                        // Default role if not found
                        console.log('[AuthContext] User doc not found, defaulting to user role');
                        setRole('user');
                        setAdminLines([]);
                    }
                } catch (error) {
                    console.error("[AuthContext] Error fetching user role:", error);
                    setRole('user');
                    setAdminLines([]);
                }
            } else {
                setRole(null);
                setAdminLines([]);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    // Helper function to check if user is admin for a specific line
    const isAdminFor = (line: ProductionLine): boolean => {
        // Global admin has access to everything
        if (role === 'admin') return true;

        // Ensure adminLines is an array before checking
        const lines = Array.isArray(adminLines) ? adminLines : [];
        // Check line-specific permissions with loose matching (trim and strip quotes)
        const result = lines.some(l => {
            const val = String(l).trim();
            // Remove surrounding quotes if present (e.g. '"sheetMetal"' -> 'sheetMetal')
            const cleanVal = val.replace(/^["']|["']$/g, '');
            return cleanVal === line;
        });

        console.log(`[AuthContext] isAdminFor('${line}'): role=${role}, lines=${JSON.stringify(lines)}, result=${result}`);
        return result;
    };

    return (
        <AuthContext.Provider value={{ user, role, adminLines, loading, signOut, isAdminFor }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
