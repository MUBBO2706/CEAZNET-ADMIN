import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Check, X, Brackets, Braces, ToggleLeft, Hash, FolderOpen, Type, ChevronRight, ChevronDown, Box } from 'lucide-react';

// --- Helper to safely get nested values ---
export const getNestedValue = (obj: any, path: (string | number)[]): any => {
    return path.reduce((xs, x) => (xs && xs[x] !== undefined) ? xs[x] : undefined, obj);
}

// --- Immutable State Helpers ---
export const updateNestedValue = (obj: any, path: (string | number)[], value: any): any => {
    if (path.length === 0) return value;
    const [head, ...tail] = path;
    const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
    newObj[head as keyof typeof newObj] = updateNestedValue(obj[head as keyof typeof obj], tail, value);
    return newObj;
};

export const deleteNestedValue = (obj: any, path: (string | number)[]): any => {
    if (path.length === 0) return obj;
    if (path.length === 1) {
        const [key] = path;
        const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
        if (Array.isArray(newObj)) {
            newObj.splice(key as number, 1);
        } else {
            delete newObj[key as string];
        }
        return newObj;
    }
    const [head, ...tail] = path;
    const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
    newObj[head as keyof typeof newObj] = deleteNestedValue(obj[head as keyof typeof obj], tail);
    return newObj;
};

export type NodeProps = {
    nodeKey: string | number;
    value: any;
    path: (string | number)[];
    onUpdate: (path: (string | number)[], value: any) => void;
    onDelete: (path: (string | number)[]) => void;
    onAdd: (path: (string | number)[], value: any) => void;
    isRoot?: boolean;
};

// Helper to determine input type
const getFieldType = (value: any): 'string' | 'number' | 'boolean' => {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    return 'string';
};

const getTypeIcon = (value: any) => {
    if (typeof value === 'boolean') return <ToggleLeft size={12} className="text-purple-500" />;
    if (typeof value === 'number') return <Hash size={12} className="text-blue-500" />;
    if (Array.isArray(value)) return <Box size={12} className="text-orange-500" />;
    if (typeof value === 'object' && value !== null) return <FolderOpen size={12} className="text-amber-500" />;
    return <Type size={12} className="text-emerald-500" />;
}

// Primitive Field (String, Number, Boolean)
export const PrimitiveNode: React.FC<Omit<NodeProps, 'onAdd'>> = ({ nodeKey, value, path, onUpdate, onDelete }) => {
    const type = getFieldType(value);
    const [localValue, setLocalValue] = useState(String(value));

    // Sync local state when prop changes
    useEffect(() => { setLocalValue(String(value)); }, [value]);

    const handleBlur = () => {
        let finalVal: any = localValue;
        if (type === 'number') finalVal = Number(localValue);
        if (finalVal !== value) onUpdate(path, finalVal);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleBlur();
    };

    return (
        <div className="group flex items-center gap-2 py-1 hover:bg-[var(--sidebar-link-hover-bg)] rounded-md px-2 -ml-2 transition-colors">
            <div className="w-4 shrink-0 flex justify-center">{getTypeIcon(value)}</div>
            <label className="text-xs font-mono font-semibold text-[var(--text-secondary)] min-w-[100px] max-w-[180px] truncate" title={String(nodeKey)}>
                {nodeKey}
            </label>
            <div className="flex-grow min-w-0 relative">
                {type === 'boolean' ? (
                    <button
                        onClick={() => onUpdate(path, !value)}
                        className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${value ? 'bg-[var(--accent-color)]' : 'bg-gray-400 dark:bg-zinc-600'}`}
                    >
                        <span aria-hidden="true" className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value ? 'translate-x-3' : 'translate-x-0'}`} />
                    </button>
                ) : (
                    <input
                        type={type === 'number' ? 'number' : 'text'}
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-transparent border-b border-transparent focus:border-[var(--accent-color)] hover:border-[var(--border-color)] outline-none text-xs font-mono text-[var(--text-primary)] py-0.5 transition-colors"
                    />
                )}
            </div>
            <button 
                onClick={() => onDelete(path)} 
                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all shrink-0 ml-auto"
            >
                <Trash2 size={12} />
            </button>
        </div>
    );
};

// Custom Type Dropdown for Visual Editor
const CustomTypeDropdown: React.FC<{ value: string, onChange: (val: any) => void }> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = [
        { value: 'string', label: 'String' },
        { value: 'number', label: 'Number' },
        { value: 'boolean', label: 'Boolean' },
        { value: 'object', label: 'Object' },
        { value: 'array', label: 'Array' }
    ];

    return (
        <div className="relative shrink-0 w-20 sm:w-24">
            <div 
                className="flex items-center justify-between cursor-pointer border border-[var(--border-color)] bg-white dark:bg-zinc-800 px-2 rounded-md h-7 text-xs text-[var(--text-primary)]"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="capitalize">{value}</span>
                <ChevronDown size={12} className={`transition-transform text-[var(--text-secondary)] ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <>
                <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-zinc-800 border border-[var(--border-color)] rounded-md shadow-xl z-20 py-1">
                    {options.map(opt => (
                        <div 
                            key={opt.value}
                            className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700 ${value === opt.value ? 'text-[var(--accent-color)] font-semibold' : 'text-[var(--text-primary)]'}`}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
                </>
            )}
        </div>
    );
};

// Add New Property Input (For Objects)
export const AddProperty: React.FC<{ onAdd: (key: string, value: any) => void, onCancel: () => void }> = ({ onAdd, onCancel }) => {
    const [key, setKey] = useState('');
    const [value, setValue] = useState('');
    const [type, setType] = useState<'string' | 'number' | 'boolean' | 'object' | 'array'>('string');

    const handleConfirm = () => {
        if (!key.trim()) return;
        let finalValue: any = value;
        if (type === 'number') finalValue = Number(value) || 0;
        if (type === 'boolean') finalValue = value.toLowerCase() === 'true';
        if (type === 'object') finalValue = {};
        if (type === 'array') finalValue = [];
        onAdd(key, finalValue);
        setKey('');
        setValue('');
    };

    return (
        <div className="flex flex-nowrap items-center gap-1.5 p-1.5 bg-[var(--subtle-bg)] rounded-md border border-[var(--border-color)] my-1 ml-4 animate-fade-in-up shadow-sm">
            <input 
                autoFocus 
                type="text" 
                value={key} 
                onChange={e => setKey(e.target.value)} 
                placeholder="Key" 
                className="form-input !py-1 !px-1.5 !text-[11px] sm:!text-xs !h-7 w-14 sm:w-24 shrink-0" 
            />
            {type !== 'object' && type !== 'array' && (
                 <input 
                    type={type === 'number' ? 'number' : 'text'} 
                    value={value} 
                    onChange={e => setValue(e.target.value)} 
                    placeholder="Val" 
                    className="form-input !py-1 !px-1.5 !text-[11px] sm:!text-xs !h-7 min-w-[3.5rem] sm:min-w-[5rem] flex-1 shrink" 
                />
            )}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto justify-end">
                <CustomTypeDropdown value={type} onChange={setType} />
                <div className="flex gap-1 shrink-0">
                    <button onClick={onCancel} className="p-1 h-7 w-7 flex items-center justify-center bg-slate-200 text-slate-600 rounded hover:bg-slate-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 transition-colors"><X size={14}/></button>
                    <button onClick={handleConfirm} className="p-1 h-7 w-7 flex items-center justify-center bg-[var(--accent-color)] text-white rounded hover:bg-[var(--accent-color-dark)] transition-colors"><Check size={14}/></button>
                </div>
            </div>
        </div>
    );
};

// Add New Item Input (For Arrays)
export const AddArrayItem: React.FC<{ onAdd: (value: any) => void, onCancel: () => void }> = ({ onAdd, onCancel }) => {
    const [value, setValue] = useState('');
    const [type, setType] = useState<'string' | 'number' | 'boolean' | 'object' | 'array'>('string');

    const handleConfirm = () => {
        let finalValue: any = value;
        if (type === 'number') finalValue = Number(value) || 0;
        if (type === 'boolean') finalValue = value.toLowerCase() === 'true';
        if (type === 'object') finalValue = {};
        if (type === 'array') finalValue = [];
        onAdd(finalValue);
        setValue('');
    };

    return (
        <div className="flex flex-nowrap items-center gap-1.5 p-1.5 bg-[var(--subtle-bg)] rounded-md border border-[var(--border-color)] my-1 ml-4 animate-fade-in-up shadow-sm">
            <span className="text-[11px] sm:text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap shrink-0 hidden sm:inline">New Item:</span>
            {type !== 'object' && type !== 'array' && (
                 <input 
                    type={type === 'number' ? 'number' : 'text'} 
                    value={value} 
                    onChange={e => setValue(e.target.value)} 
                    placeholder="Val" 
                    className="form-input !py-1 !px-1.5 !text-[11px] sm:!text-xs !h-7 min-w-[3.5rem] sm:min-w-[5rem] flex-1 shrink" 
                />
            )}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto justify-end">
                <CustomTypeDropdown value={type} onChange={setType} />
                <div className="flex gap-1 shrink-0">
                    <button onClick={onCancel} className="p-1 h-7 w-7 flex items-center justify-center bg-slate-200 text-slate-600 rounded hover:bg-slate-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 transition-colors"><X size={14}/></button>
                    <button onClick={handleConfirm} className="p-1 h-7 w-7 flex items-center justify-center bg-[var(--accent-color)] text-white rounded hover:bg-[var(--accent-color-dark)] transition-colors"><Check size={14}/></button>
                </div>
            </div>
        </div>
    );
};

// Container Node (Object/Array)
export const ContainerNode: React.FC<NodeProps> = ({ nodeKey, value, path, onUpdate, onDelete, onAdd, isRoot }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    
    const isArray = Array.isArray(value);
    const Icon = isArray ? Brackets : Braces;
    const itemCount = isArray ? value.length : Object.keys(value).length;

    const handleAddProperty = (key: string, newValue: any) => {
        const newPath = [...path, key];
        onUpdate(newPath, newValue);
        setIsAdding(false);
    };

    const handleAddArrayItem = (newValue: any) => {
        onAdd(path, newValue);
        setIsAdding(false);
    };

    return (
        <div className="relative">
            {!isRoot && (
                <div className="group flex items-center gap-2 py-1 hover:bg-[var(--sidebar-link-hover-bg)] rounded-md px-2 -ml-2 cursor-pointer select-none" onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}>
                    <button className="text-[var(--text-secondary)]">
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <Icon size={14} className="opacity-60 text-indigo-500" />
                    <span className="text-xs font-bold text-[var(--text-primary)] font-mono" title={String(nodeKey)}>{nodeKey}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--subtle-bg)] px-1.5 rounded-full">{isArray ? `Array[${itemCount}]` : `Object{${itemCount}}`}</span>
                    <div className="flex-grow"></div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsAdding(true); setIsCollapsed(false); }} 
                            className="p-1 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded" 
                            title="Add child"
                        >
                            <Plus size={12} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(path); }} 
                            className="p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            )}

            {!isCollapsed && (
                <div className={`flex flex-col ${!isRoot ? 'ml-4 border-l border-[var(--border-color)] pl-4' : ''}`}>
                    {/* Render Children */}
                    {isArray
                        ? value.map((child: any, idx: number) => (
                            <JsonNode key={idx} nodeKey={idx} value={child} path={[...path, idx]} onUpdate={onUpdate} onDelete={onDelete} onAdd={onAdd} />
                        ))
                        : Object.entries(value).map(([k, v]) => (
                            <JsonNode key={k} nodeKey={k} value={v} path={[...path, k]} onUpdate={onUpdate} onDelete={onDelete} onAdd={onAdd} />
                        ))
                    }
                    
                    {/* Add Button / Form */}
                    {isAdding ? (
                        isArray ? (
                            <AddArrayItem onAdd={handleAddArrayItem} onCancel={() => setIsAdding(false)} />
                        ) : (
                            <AddProperty onAdd={handleAddProperty} onCancel={() => setIsAdding(false)} />
                        )
                    ) : (
                        (isRoot || itemCount === 0) && (
                            <button onClick={() => setIsAdding(true)} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-color)] py-1 px-2 mt-1 rounded hover:bg-[var(--subtle-bg)] w-fit transition-colors">
                                <Plus size={10} /> {isArray ? 'Add Item' : 'Add Property'}
                            </button>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export const JsonNode: React.FC<NodeProps> = (props) => {
    return typeof props.value === 'object' && props.value !== null 
        ? <ContainerNode {...props} /> 
        : <PrimitiveNode {...props} />;
};
