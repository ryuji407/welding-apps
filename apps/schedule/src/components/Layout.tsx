import React, { useState } from 'react';
import { Menu, X, Lock, Unlock } from 'lucide-react';
import { useAdminMode } from '../context/AdminModeContext';
import { useSidebar } from '../context/SidebarContext';
import { AdminLoginModal } from './AdminLoginModal';

interface LayoutProps {
    children: React.ReactNode;
    headerTitle?: string;
    onSignOut?: () => void;
}

export function Layout({ children, onSignOut }: LayoutProps) {
    const { isSidebarOpen, setIsSidebarOpen, isCollapsed, setIsCollapsed } = useSidebar();
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const { enableAdminMode, disableAdminMode, isAdmin } = useAdminMode();

    const isCurrentAdmin = isAdmin('welding');

    const handleAdminClick = () => {
        if (isCurrentAdmin) {
            disableAdminMode('welding');
        } else {
            setIsAdminModalOpen(true);
        }
    };

    const handleLogin = (password: string) => {
        const success = enableAdminMode('welding', password);
        if (success) {
            setIsCollapsed(true);
        }
        return success;
    };

    return (
        <div className="h-screen overflow-hidden bg-gray-50 flex text-gray-600 font-sans relative">
            {/* Global Desktop Menu Button - Floating and overlapping */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`
                    hidden md:flex fixed top-[48px] left-2 z-[60] 
                    h-8 px-3 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white 
                    rounded-lg transition-all duration-300 items-center gap-2 
                    border border-slate-600 shadow-lg active:scale-95 no-print
                `}
                title={isCollapsed ? "メニューを開く" : "メニューを閉じる"}
            >
                <Menu size={18} />
                <span className="text-sm font-bold">メニュー</span>
            </button>

            {/* Mobile/Tablet Header - Hidden on tablets and desktops */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 z-30 flex items-center px-3 shadow-md justify-between no-print print:invisible print:h-0 print:overflow-hidden">
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-white p-1">
                        <Menu size={22} />
                    </button>
                    <h1 className="text-base font-bold text-white tracking-tight truncate">溶接ライン工程管理</h1>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                w-56 bg-slate-900 border-r border-slate-800 flex-none text-slate-300 flex flex-col shadow-xl z-50
                fixed top-0 bottom-0 transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isCollapsed ? 'md:-translate-x-full md:fixed' : 'md:translate-x-0 md:static'}
                md:h-screen no-print print:hidden print:w-0
            `}>
                {/* Header */}
                <div className="pt-20 px-4 flex flex-col items-end">
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white mb-4">
                        <X size={24} />
                    </button>
                </div>
                <nav className="flex-1 pl-2 pr-4 space-y-2 overflow-y-auto">
                    <div className="space-y-1">
                        <div className="px-4 py-3 text-lg font-bold text-slate-500 relative top-2">
                            溶接ライン
                        </div>
                        <div className="space-y-2">
                            <div className="w-full px-4 py-2 rounded-lg border font-medium flex items-center gap-3 bg-indigo-600/10 text-indigo-400 border-indigo-600/20">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                                溶接ライン工程
                            </div>
                        </div>
                    </div>
                </nav>
                <div className="mt-auto p-4 border-t border-slate-800 flex-none space-y-4">
                    {/* Admin Mode Toggle */}
                    <button
                        onClick={handleAdminClick}
                        className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center gap-3 text-sm ${isCurrentAdmin
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        {isCurrentAdmin ? <Unlock size={18} /> : <Lock size={18} />}
                        {isCurrentAdmin ? '管理者モード中' : '管理者モード'}
                    </button>

                    {/* User Info & Sign Out */}
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={onSignOut}
                            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <span className="truncate">ログアウト</span>
                        </button>
                        <div className="text-xs text-slate-500 text-center">
                            v2.0.0
                        </div>
                    </div>
                </div>
            </aside>

            <AdminLoginModal
                isOpen={isAdminModalOpen}
                onClose={() => setIsAdminModalOpen(false)}
                onLogin={handleLogin}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-hidden pt-14 md:pt-0 w-full max-w-full">
                <div className="h-full w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
