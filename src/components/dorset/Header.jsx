import React from 'react';

export default function Header({ onNew, onExport, onImport }) {
  return (
    <header className="sticky top-0 z-30 text-white" style={{ background: 'linear-gradient(180deg,#111 0%,#1c1c1c 100%)', borderBottom: '5px solid #d71920' }}>
      <div className="max-w-6xl mx-auto px-3 py-2.5 flex justify-between items-start gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl p-1">
            <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=44&h=44&fit=crop" alt="logo" className="h-10 w-10 object-cover rounded-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Legionella Pro Compliance</h1>
            <p className="text-xs text-gray-300">Executive summary • control scheme • schematic • CQC support</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={onNew} className="text-sm px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-xl font-bold hover:bg-gray-100">New job</button>
          <button onClick={onExport} className="text-sm px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-xl font-bold hover:bg-gray-100">Backup job</button>
          <label className="text-sm px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-xl font-bold hover:bg-gray-100 cursor-pointer">
            Import
            <input type="file" accept=".json" className="hidden" onChange={onImport} />
          </label>
        </div>
      </div>
    </header>
  );
}