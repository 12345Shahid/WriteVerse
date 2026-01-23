import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Edit3 } from 'lucide-react';

interface NaturalWriteToggleProps {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    disabled?: boolean;
    compact?: boolean;
}

/**
 * Toggle between AI Write and Natural Write modes.
 * 
 * - AI Write: Standard AI generation (1 credit)
 * - Natural Write: AI + Humanizer pass (2 credits, bypasses AI detection)
 */
export function NaturalWriteToggle({ enabled, onToggle, disabled = false, compact = false }: NaturalWriteToggleProps) {
    return (
        <div className={`flex items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
            <div 
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    !enabled 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-400'
                }`}
            >
                <Sparkles className="w-3 h-3" />
                {!compact && <span>AI</span>}
            </div>
            
            <Switch
                checked={enabled}
                onCheckedChange={onToggle}
                disabled={disabled}
                className="data-[state=checked]:bg-green-600"
            />
            
            <div 
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    enabled 
                        ? 'bg-green-100 text-green-700' 
                        : 'text-gray-400'
                }`}
            >
                <Edit3 className="w-3 h-3" />
                {!compact && <span>Natural</span>}
            </div>
            
            {enabled && !compact && (
                <span className="text-xs text-green-600 ml-1">(2x credits)</span>
            )}
        </div>
    );
}

/**
 * Compact inline version for tight spaces
 */
export function NaturalWriteToggleInline({ enabled, onToggle, disabled = false }: NaturalWriteToggleProps) {
    return (
        <button
            onClick={() => onToggle(!enabled)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all border ${
                enabled
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={enabled ? 'Natural Write enabled (2x credits)' : 'Click to enable Natural Write'}
        >
            {enabled ? <Edit3 className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
            <span>{enabled ? 'Natural' : 'AI'}</span>
        </button>
    );
}
