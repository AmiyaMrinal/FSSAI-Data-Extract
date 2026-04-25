/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  Download, 
  Trash2, 
  AlertCircle, 
  Loader2,
  Table as TableIcon
} from 'lucide-react';
import { extractFSSAIData, FSSAIData } from './services/gemini';

export default function App() {
  const [files, setFiles] = useState<{ file: File; id: string; status: 'pending' | 'loading' | 'done' | 'error'; data?: FSSAIData; error?: string }[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const onFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).slice(0, 50).map(file => ({
        file,
        id: Math.random().toString(36).substring(7),
        status: 'pending' as const
      }));
      setFiles(prev => [...prev, ...newFiles]);
      if (!activeFileId && newFiles.length > 0) {
        setActiveFileId(newFiles[0].id);
      }
    }
  };

  const processFile = async (id: string) => {
    const fileEntry = files.find(f => f.id === id);
    if (!fileEntry || fileEntry.status === 'done') return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'loading' } : f));

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(fileEntry.file);
      const base64 = await base64Promise;

      const data = await extractFSSAIData(base64, fileEntry.file.type);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'done', data } : f));
    } catch (err) {
      console.error(err);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: 'Failed to extract data' } : f));
    }
  };

  const handleUploadAll = async () => {
    setIsProcessingAll(true);
    const pendingFiles = files.filter(f => f.status === 'pending');
    for (const f of pendingFiles) {
      await processFile(f.id);
    }
    setIsProcessingAll(false);
  };

  const handleFieldChange = (field: keyof FSSAIData, value: string) => {
    if (activeFileId) {
      setFiles(prev => prev.map(f => {
        if (f.id === activeFileId && f.data) {
          return { ...f, data: { ...f.data, [field]: value } };
        }
        return f;
      }));
    }
  };

  const downloadCSV = () => {
    const completedFiles = files.filter(f => f.status === 'done' && f.data);
    if (completedFiles.length === 0) return;

    const headers = ['Entity Name', 'Address', 'State', 'City', 'FSSAI License No', '100 Category (Yes/No)', 'Valid Upto'];
    const rows = completedFiles.map(f => {
      const d = f.data!;
      return [
        `"${d.entityName.replace(/"/g, '""')}"`,
        `"${d.address.replace(/"/g, '""')}"`,
        `"${d.state.replace(/"/g, '""')}"`,
        `"${d.city.replace(/"/g, '""')}"`,
        d.fssaiLicenseNo,
        d.category100,
        d.validUpto
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `fssai_bulk_export_${Date.now()}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    if (activeFileId === id) {
      const remaining = files.filter(f => f.id !== id);
      setActiveFileId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const reset = () => {
    setFiles([]);
    setActiveFileId(null);
  };

  const activeEntry = files.find(f => f.id === activeFileId);

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden text-slate-800">
      {/* Header Navigation */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white">
            <FileText size={18} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">FSSAI <span className="text-indigo-600">ExtractAI</span></h1>
        </div>
        <div className="flex items-center space-x-6">
          <nav className="hidden md:flex space-x-4 text-sm font-medium text-slate-500">
            <div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-widest">
              {files.length} {files.length === 1 ? 'Doc' : 'Docs'} Loaded
            </div>
          </nav>
          <div className="flex items-center gap-3">
            {files.length > 0 && (
              <button 
                onClick={downloadCSV}
                disabled={!files.some(f => f.status === 'done')}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-indigo-700 shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Download size={14} />
                Bulk Export
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row p-6 gap-6 min-h-0 bg-slate-50">
        
        {/* Left: File List & Source Panel */}
        <section className="w-full md:w-5/12 flex flex-col gap-4 min-h-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Batch Queue</h2>
            <div className="flex gap-2">
              <label className="cursor-pointer group">
                <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={onFilesChange} />
                <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600 rounded-md hover:bg-slate-50 transition-colors shadow-sm">
                  <Upload size={14} />
                  Add Files
                </span>
              </label>
              {files.some(f => f.status === 'pending') && (
                <button 
                  onClick={handleUploadAll}
                  disabled={isProcessingAll}
                  className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-md hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Loader2 size={14} className={isProcessingAll ? "animate-spin" : "hidden"} />
                  Process All
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            {files.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 opacity-50">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                  <Upload size={40} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-600">No documents uploaded</p>
                  <p className="text-xs text-slate-400">Select up to 50 FSSAI licenses to begin extraction</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {files.map((entry) => (
                  <div 
                    key={entry.id}
                    onClick={() => setActiveFileId(entry.id)}
                    className={`p-4 flex items-center gap-4 cursor-pointer transition-all ${activeFileId === entry.id ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                  >
                    <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${entry.status === 'done' ? 'bg-green-50 text-green-600' : entry.status === 'loading' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                      {entry.status === 'loading' ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${activeFileId === entry.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {entry.file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-tighter opacity-40">{(entry.file.size / 1024 / 1024).toFixed(2)} MB</span>
                        <span className="text-[10px] text-slate-200">|</span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${entry.status === 'done' ? 'text-green-600' : entry.status === 'loading' ? 'text-indigo-600' : entry.status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                          {entry.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFile(entry.id); }}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: Extracted Data Review Panel */}
        <section className="w-full md:w-7/12 flex flex-col gap-4 min-h-0">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Extraction Review</h2>
            {activeEntry?.status === 'done' && (
              <div className="flex items-center gap-2 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">
                <CheckCircle2 size={10} />
                VERIFIED BY GEMINI
              </div>
            )}
          </div>

          <div className="flex-1 bg-white rounded-lg shadow-md border border-slate-200 flex flex-col min-h-0">
            <AnimatePresence mode="wait">
              {!activeEntry ? (
                <motion.div 
                  key="empty-review"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 opacity-50"
                >
                  <TableIcon size={48} className="text-slate-200" />
                  <p className="text-sm font-medium text-slate-400">Select a document from the queue to review extraction details</p>
                </motion.div>
              ) : activeEntry.status === 'loading' ? (
                <motion.div 
                  key="loading-review"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center p-8 space-y-6"
                >
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                      <FileText size={32} />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-widest">Processing {activeEntry.file.name}</p>
                    <p className="text-xs text-slate-400 font-mono italic animate-pulse">Running OCR & Intelligence patterns...</p>
                  </div>
                </motion.div>
              ) : activeEntry.status === 'error' ? (
                <motion.div 
                  key="error-review"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                    <AlertCircle size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">Extraction Failed</p>
                    <p className="text-xs text-red-500">{activeEntry.error || 'Unknown error occurred during processing'}</p>
                  </div>
                  <button 
                    onClick={() => processFile(activeEntry.id)}
                    className="px-6 py-2 bg-slate-900 text-white rounded-md text-xs font-bold uppercase tracking-widest hover:bg-black transition-all"
                  >
                    Retry Extraction
                  </button>
                </motion.div>
              ) : activeEntry.status === 'pending' ? (
                <motion.div 
                  key="pending-review"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6"
                >
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-400 rounded-3xl flex items-center justify-center">
                    <Upload size={40} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-widest">Document Ready</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">This document is pending processing. Click the button below to start extraction for this specific file.</p>
                  </div>
                  <button 
                    onClick={() => processFile(activeEntry.id)}
                    className="px-10 py-3 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all hover:translate-y-[-2px] active:translate-y-0"
                  >
                    Extract This File
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="done-review"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <div className="flex-1 p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 focus-within:text-indigo-500 transition-colors">Entity Name</label>
                        <input 
                          type="text" 
                          value={activeEntry.data?.entityName || ''} 
                          onChange={(e) => handleFieldChange('entityName', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded px-3 py-2.5 text-sm font-semibold text-slate-800 transition-all focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Complete Address</label>
                        <textarea 
                          rows={2} 
                          value={activeEntry.data?.address || ''}
                          onChange={(e) => handleFieldChange('address', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded px-3 py-2.5 text-sm text-slate-700 transition-all focus:outline-none focus:border-indigo-500 focus:bg-white h-20 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">City</label>
                        <input 
                          type="text" 
                          value={activeEntry.data?.city || ''} 
                          onChange={(e) => handleFieldChange('city', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">State</label>
                        <input 
                          type="text" 
                          value={activeEntry.data?.state || ''} 
                          onChange={(e) => handleFieldChange('state', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">FSSAI License No.</label>
                        <input 
                          type="text" 
                          value={activeEntry.data?.fssaiLicenseNo || ''} 
                          onChange={(e) => handleFieldChange('fssaiLicenseNo', e.target.value)}
                          className="w-full bg-indigo-50/50 border border-indigo-100 rounded px-3 py-2.5 text-sm font-mono tracking-wider font-bold text-indigo-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Valid Upto</label>
                        <input 
                          type="text" 
                          value={activeEntry.data?.validUpto || ''} 
                          onChange={(e) => handleFieldChange('validUpto', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        />
                      </div>

                      <div className="col-span-2">
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-widest mb-1">Category Check</span>
                            <span className="text-xs font-bold text-slate-800">100 - Standardised Food Product Identification</span>
                          </div>
                          <div className="flex items-center space-x-6 bg-white p-1 rounded-lg border border-slate-200">
                            <label className="flex items-center space-x-2 cursor-pointer py-1 px-3 rounded-md transition-all group">
                              <input 
                                type="radio" 
                                name={`cat100-${activeEntry.id}`}
                                className="hidden" 
                                checked={activeEntry.data?.category100 === 'Yes'} 
                                onChange={() => handleFieldChange('category100', 'Yes')} 
                              />
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${activeEntry.data?.category100 === 'Yes' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                                {activeEntry.data?.category100 === 'Yes' && <div className="w-1 h-1 bg-white rounded-full"></div>}
                              </div>
                              <span className={`text-[10px] font-bold tracking-widest ${activeEntry.data?.category100 === 'Yes' ? 'text-indigo-600' : 'text-slate-400'}`}>YES</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer py-1 px-3 rounded-md transition-all group">
                              <input 
                                type="radio" 
                                name={`cat100-${activeEntry.id}`}
                                className="hidden" 
                                checked={activeEntry.data?.category100 === 'No'} 
                                onChange={() => handleFieldChange('category100', 'No')} 
                              />
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${activeEntry.data?.category100 === 'No' ? 'border-slate-400 bg-slate-400' : 'border-slate-300'}`}>
                                {activeEntry.data?.category100 === 'No' && <div className="w-1 h-1 bg-white rounded-full"></div>}
                              </div>
                              <span className={`text-[10px] font-bold tracking-widest ${activeEntry.data?.category100 === 'No' ? 'text-slate-600' : 'text-slate-400'}`}>NO</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                    <button 
                      onClick={downloadCSV}
                      className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                    >
                      Export Current Data
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-8 bg-white border-t border-slate-200 px-6 flex items-center justify-between shrink-0 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-[10px] font-bold text-slate-400 space-x-1.5 uppercase tracking-tighter">
            <span className={`w-2 h-2 rounded-full ${isProcessingAll ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></span>
            <span>{isProcessingAll ? 'Batch Extraction Active' : 'Service: Online'}</span>
          </div>
          <div className="text-[10px] text-slate-200">|</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            Queue: {files.filter(f => f.status === 'done').length}/{files.length} Done
          </div>
        </div>
        <div className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter opacity-60">
          SESSION: BATCH-V1-2026
        </div>
      </footer>
    </div>
  );
}

