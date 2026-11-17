import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WardrobeProvider } from './context/WardrobeContext';
import { AuthPage } from './components/AuthPage';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { OverviewPage } from './components/OverviewPage';
import { WardrobePage } from './components/WardrobePage';
import { FitBuilderPage } from './components/FitBuilderPage';
import { LookbookPage } from './components/LookbookPage';
import { WishlistPage } from './components/WishlistPage';
import { PlannerPage } from './components/PlannerPage';
import { SwoooshAIPage } from './components/SwoooshAIPage';
import { SettingsPage } from './components/SettingsPage';
import { NavSection, Outfit } from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const MainShell: React.FC = () => {
  const { userProfile, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openAddClothing, setOpenAddClothing] = useState(false);
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da] flex flex-col items-center justify-center p-6">
        <span className="font-display text-3xl font-extrabold tracking-tight uppercase">
          SWOOOSH
        </span>
        <span className="text-xs tracking-[0.2em] uppercase text-[#5c5a54] dark:text-[#b0b0b0] mt-2">
          PLAN. ORGANIZE. WEAR.
        </span>
      </div>
    );
  }

  if (!userProfile) {
    return <AuthPage />;
  }

  const handleQuickAddClothing = () => {
    setOpenAddClothing(true);
    setActiveSection('wardrobe');
  };

  const handleEditInBuilder = (outfit: Outfit) => {
    setEditingOutfit(outfit);
    setActiveSection('builder');
  };

  return (
    <div className="min-h-screen bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da] flex">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <HeaderBar
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-7 max-w-[1400px] w-full mx-auto">
          {activeSection === 'overview' && (
            <OverviewPage
              onNavigate={setActiveSection}
              onQuickAddClothing={handleQuickAddClothing}
            />
          )}

          {activeSection === 'wardrobe' && (
            <WardrobePage
              openAddModalOnMount={openAddClothing}
              onConsumedOpenAdd={() => setOpenAddClothing(false)}
              onToast={showToast}
            />
          )}

          {activeSection === 'builder' && (
            <FitBuilderPage
              editingOutfit={editingOutfit}
              onClearEditingOutfit={() => setEditingOutfit(null)}
              onNavigate={setActiveSection}
              onToast={showToast}
            />
          )}

          {activeSection === 'lookbook' && (
            <LookbookPage
              onNavigate={setActiveSection}
              onEditInBuilder={handleEditInBuilder}
              onToast={showToast}
            />
          )}

          {activeSection === 'wishlist' && <WishlistPage onToast={showToast} />}

          {activeSection === 'planner' && (
            <PlannerPage onNavigate={setActiveSection} onToast={showToast} />
          )}

          {activeSection === 'ai' && (
            <SwoooshAIPage onNavigate={setActiveSection} onToast={showToast} />
          )}

          {activeSection === 'settings' && <SettingsPage onToast={showToast} />}
        </main>
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 border text-xs font-medium flex items-center gap-2.5 shadow-lg ${
            toast.type === 'error'
              ? 'bg-red-950 text-red-100 border-red-700'
              : 'bg-[#171717] text-[#e5e1da] dark:bg-[#e5e1da] dark:text-[#171717] border-[#404040]'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WardrobeProvider>
          <MainShell />
        </WardrobeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
