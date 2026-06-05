import { useState, useCallback } from 'react';
import { doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type UndoOperation =
    | { type: 'ADD'; path: string; docId: string }
    | { type: 'UPDATE'; path: string; docId: string; prevData: any }
    | { type: 'DELETE'; path: string; docId: string; prevData: any };

export function useUndo() {
    const [history, setHistory] = useState<UndoOperation[]>([]);

    // Add an operation to the undo stack
    const addToHistory = useCallback((op: UndoOperation) => {
        setHistory(prev => [...prev.slice(-19), op]); // Keep last 20 actions
    }, []);

    // Perform the undo action
    const undo = useCallback(async () => {
        setHistory(prev => {
            if (prev.length === 0) return prev;

            const newHistory = [...prev];
            const op = newHistory.pop();

            if (!op) return prev;

            // Perform inverse operation
            const performUndo = async () => {
                try {
                    console.log('Undoing operation:', op);
                    const docRef = doc(db, op.path, op.docId);

                    switch (op.type) {
                        case 'ADD':
                            // Inverse: Delete the added document
                            await deleteDoc(docRef);
                            break;
                        case 'UPDATE':
                            // Inverse: Restore previous data
                            // Only update fields that were in prevData (partial update) or set? 
                            // Usually for UPDATE we expect prevData to be the full object or partial changes?
                            // For safety, let's assume updateDoc with prevData
                            await updateDoc(docRef, op.prevData);
                            break;
                        case 'DELETE':
                            // Inverse: Create the document again with previous data
                            await setDoc(docRef, op.prevData);
                            break;
                    }
                } catch (error) {
                    console.error('Undo failed:', error);
                    // If undo fails, we might want to push it back? For now, just log.
                    alert('操作の取り消しに失敗しました。');
                }
            };

            performUndo();
            return newHistory;
        });
    }, []);

    return {
        addToHistory,
        undo,
        canUndo: history.length > 0
    };
}
