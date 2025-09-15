import React from 'react';
import { FileText, Settings, HelpCircle, Cpu, Brain, Zap } from 'lucide-react';
import { useOCRStore } from '@/store/ocrStore';
import { motion } from 'framer-motion';

export const Header: React.FC = () => {
  const { toggleSettings, toggleHelp, projects, currentProjectId, selectProject, createProject, settings, updateSettings } = useOCRStore();

  React.useEffect(() => {
    if (projects.length === 0) return;
    const exists = currentProjectId ? projects.some(p => p.id === currentProjectId) : false;
    if (currentProjectId && !exists) {
      // Previously selected project is gone; reset to All Projects
      selectProject(null);
      return;
    }
    if (!currentProjectId && exists === false) {
      // No selection yet; default to most recently created project
      const last = [...projects].sort((a, b) => a.createdAt - b.createdAt)[projects.length - 1];
      if (last) selectProject(last.id);
    }
  }, [projects, currentProjectId, selectProject]);

  const cycleOCREngine = () => {
    const current = settings.ocrEngine || 'auto';
    const next = current === 'auto' ? 'tesseract' : current === 'tesseract' ? 'gemini' : 'auto';
    updateSettings({ ocrEngine: next });
  };

  const getEngineInfo = () => {
    const engine = settings.ocrEngine || 'auto';
    if (engine === 'tesseract') {
      return { icon: Cpu, name: 'Tesseract', color: 'text-green-300' };
    } else if (engine === 'gemini') {
      return { icon: Brain, name: 'Gemini', color: 'text-purple-300' };
    } else {
      return { icon: Zap, name: 'Auto', color: 'text-yellow-300' };
    }
  };

  const engineInfo = getEngineInfo();
  const EngineIcon = engineInfo.icon;

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-10 h-10 bg-white rounded-lg flex items-center justify-center"
            >
              <FileText className="w-6 h-6 text-blue-600" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold">OCR Pro</h1>
              <p className="text-blue-100 text-sm">Powered by Gemini AI & Tesseract</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* OCR Engine Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={cycleOCREngine}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur hover:bg-white/20 transition-all ${engineInfo.color}`}
              title={`OCR Engine: ${engineInfo.name} (click to change)`}
            >
              <EngineIcon className="w-5 h-5" />
              <span className="text-sm font-medium">{engineInfo.name}</span>
            </motion.button>

            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2 py-1">
              <select
                value={currentProjectId ?? ''}
                onChange={(e) => selectProject(e.target.value || null)}
                className="bg-transparent text-white text-sm outline-none"
              >
                <option value="" className="text-black">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id} className="text-black">{p.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const name = prompt('Project name');
                  if (name && name.trim()) {
                    createProject(name.trim());
                  }
                }}
                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
              >
                New
              </button>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleSettings}
              className="p-2 rounded-lg bg-white/10 backdrop-blur hover:bg-white/20 transition-all"
            >
              <Settings className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleHelp}
              className="p-2 rounded-lg bg-white/10 backdrop-blur hover:bg-white/20 transition-all"
            >
              <HelpCircle className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.header>
  );
};