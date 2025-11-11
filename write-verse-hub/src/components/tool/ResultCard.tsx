import { Button } from "@/components/ui/button-brutal";
import { Copy, Download, Check } from "lucide-react";
import { useState } from "react";
import { exportTxt } from "@/lib/export";

/**
 * Result Card Component
 * 
 * Displays a single generated result with copy and export actions.
 * Used across all tools for consistent result display.
 * 
 * Props:
 * - content: The generated text content
 * - index: Result number (for display)
 * - metadata: Optional additional info (e.g., open rate, score)
 * 
 * Features:
 * - Copy to clipboard with visual feedback
 * - Export individual result
 * - Highlight on hover
 */

interface ResultCardProps {
  content: string;
  index: number;
  metadata?: {
    label: string;
    value: string;
    color?: string;
  };
}

export const ResultCard = ({ content, index, metadata }: ResultCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    try {
      console.groupCollapsed("[Export] ResultCard export");
      console.debug("index", index);
      exportTxt(`writerai-result-${index}.txt`, content);
      console.groupEnd();
    } catch (e) {
      console.error("[Export] Failed", e);
      alert("Export failed. See console for details.");
    }
  };

  return (
    <div className="border-4 border-black bg-card p-6 shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-3 border-black bg-primary flex items-center justify-center">
            <span className="font-bold text-primary-foreground">{index}</span>
          </div>
          {metadata && (
            <div className="border-2 border-black bg-background px-3 py-1">
              <span className="text-xs font-bold uppercase">{metadata.label}:</span>
              <span className={`ml-2 text-sm font-bold ${metadata.color || "text-primary"}`}>
                {metadata.value}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="border-3 border-black p-2 bg-background hover:bg-accent transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={handleExport}
            className="border-3 border-black p-2 bg-background hover:bg-accent transition-colors"
            title="Export"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-sm max-w-none">
        <p className="text-base font-medium leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      </div>
    </div>
  );
};
