'use client';

interface QuickActionProps {
  icon: string;
  label: string;
  prompt: string;
  isActive: boolean;
  onClick: () => void;
}

export default function QuickAction({ icon, label, prompt, isActive, onClick }: QuickActionProps) {
  return (
    <button onClick={onClick} title={prompt} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all shrink-0 ${isActive ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-[0_0_0_1px_rgba(37,99,235,0.2)]' : 'bg-white border-zinc-200 text-zinc-600 hover:border-blue-300 hover:text-blue-600 hover:shadow-[0_0_0_1px_rgba(37,99,235,0.1)]'}`}>
      <span className="text-xs leading-none">{icon}</span>
      {label}
    </button>
  );
}
