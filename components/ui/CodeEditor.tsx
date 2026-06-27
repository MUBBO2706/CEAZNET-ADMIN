
import React, { useState } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import { Copy, Check } from 'lucide-react';

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    language?: string;
    placeholder?: string;
    height?: string;
    maxHeight?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
    value, 
    onChange, 
    language = 'json', 
    height = '300px',
    maxHeight
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Simple highlighter using PrismJS
    // We use the default import 'Prism' because the ESM build doesn't support named exports like 'highlight'.
    const highlightCode = (code: string) => {
        // Ensure grammar exists to prevent crash. 
        // Standard Prism bundles usually include 'clike' and 'javascript'.
        const grammar = Prism.languages.javascript || Prism.languages.clike || Prism.languages.text;
        if (!grammar) return code; // Fallback if no grammar found
        return Prism.highlight(code, grammar, 'javascript');
    };

    return (
        <div 
            className="relative rounded-lg overflow-hidden border border-[var(--border-color)] shadow-sm bg-[var(--card-bg)] flex flex-col"
            style={{ height, maxHeight }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--subtle-bg)] border-b border-[var(--border-color)] text-xs text-[var(--text-secondary)] select-none shrink-0">
                <span className="uppercase font-semibold font-mono">{language}</span>
                <div className="flex items-center gap-3">
                    <span className="hidden sm:inline opacity-70">Editor</span>
                    <button 
                        onClick={handleCopy} 
                        className={`flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors ${copied ? 'text-green-500' : ''}`}
                        aria-label="Copy code"
                    >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* Editor Container */}
            <div className="relative flex-grow min-h-0 bg-[var(--prism-bg)] overflow-auto custom-scrollbar flex items-stretch">
                {/* Line Numbers */}
                <div 
                    className="flex flex-col text-right select-none sticky left-0 z-10 bg-[var(--subtle-bg)] border-r border-[var(--border-color)] text-[var(--text-secondary)] py-[10px] px-3 shrink-0"
                    style={{
                        fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
                        fontSize: 13,
                        lineHeight: 1.5,
                        minHeight: '100%',
                    }}
                >
                    {value.split('\n').map((_, i) => (
                        <div key={i + 1} className="opacity-50">{i + 1}</div>
                    ))}
                </div>

                <div className="flex-grow">
                    <Editor
                        value={value}
                        onValueChange={onChange}
                        highlight={highlightCode}
                        padding={10}
                        style={{
                            fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
                            fontSize: 13,
                            lineHeight: 1.5,
                            backgroundColor: 'var(--prism-bg)',
                            color: 'var(--prism-text)',
                            minWidth: '100%',
                            width: 'max-content',
                        }}
                        textareaClassName="focus:outline-none !whitespace-pre"
                        preClassName="!whitespace-pre"
                    />
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;
