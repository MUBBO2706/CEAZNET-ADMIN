import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import type { NewsLog } from '../types';
import { 
    ChevronDown, 
    CalendarDays, 
    Clock, 
    Hash, 
    Timer, 
    Terminal,
    Code,
    List,
    Info,
    Copy,
    Check,
    AlertTriangle,
    Trash2,
    X,
} from 'lucide-react';

export const InfoPopover: React.FC<{ info: string; className?: string }> = ({ info, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ left: 0, top: 0, bottom: 0, right: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({ 
                left: rect.left, 
                top: rect.top, 
                bottom: rect.bottom, 
                right: rect.right 
            });
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
        }
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, updatePosition]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isOpen &&
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className={`inline-flex items-center ${className}`}>
            <button
                ref={triggerRef}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="text-slate-400 hover:text-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full p-0.5"
                aria-label="More information"
            >
                <Info size={14} />
            </button>
            {isOpen && ReactDOM.createPortal(
                <div 
                    ref={popoverRef}
                    className="fixed z-[9999] mb-1.5 w-60 p-2 text-[11px] font-medium bg-slate-800 text-slate-100 rounded-md shadow-2xl border border-slate-700/50 break-words leading-tight shadow-black/20"
                    style={{ 
                        left: `${coords.left + (coords.right - coords.left) / 2}px`, 
                        top: `${coords.top}px`,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-800 border-b border-r border-slate-700/50 rotate-45"></div>
                    <span className="relative z-10 block">{info}</span>
                </div>,
                document.body
            )}
        </div>
    );
};

export const PanelCard = React.forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string; borderColor?: string; style?: React.CSSProperties }>(
    ({ children, className = '', borderColor, style }, ref) => (
        <div ref={ref} className={`panel-card p-3 ${borderColor ? `border-t-[3px] ${borderColor}` : ''} ${className}`} style={style}>
            {children}
        </div>
    )
);
PanelCard.displayName = 'PanelCard';


export const StatCard: React.FC<{ 
    title: string; 
    value: string | number; 
    description: string; 
    icon: React.ReactNode; 
    borderColor?: string; 
    valueClassName?: string;
    info?: string;
    trend?: { value: string | number; label: string; positive?: boolean; neutral?: boolean; negative?: boolean };
}> = ({ title, value, description, icon, borderColor = 'border-slate-200', valueClassName = '', info, trend }) => (
    <PanelCard className={`relative overflow-hidden border-t-[3px] ${borderColor} rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group flex flex-col justify-between bg-gradient-to-br from-[var(--card-bg)] to-[var(--subtle-bg)]`}>
        {/* Background decorative icon */}
        <div className="absolute -right-2 -bottom-2 opacity-[0.03] dark:opacity-[0.05] transform group-hover:scale-125 group-hover:-rotate-12 transition-all duration-500 pointer-events-none">
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 80, strokeWidth: 1 }) : null}
        </div>
        
        <div className="relative z-10 flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div className="text-[var(--text-secondary)] opacity-90 p-1 bg-[var(--card-bg)] shadow-sm rounded-md group-hover:scale-110 group-hover:text-[var(--text-primary)] transition-all duration-300 flex-shrink-0">
                        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-3 h-3 sm:w-3.5 sm:h-3.5" }) : icon}
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate leading-none" title={title}>{title}</p>
                </div>
                {info && <InfoPopover info={info} className="flex-shrink-0" />}
            </div>
            
            <div className="mt-1 flex items-end justify-between gap-2">
                <p className={`text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tighter leading-none truncate flex-1 min-w-0 ${valueClassName}`} title={value.toString()}>{value}</p>
                {trend && (
                    <div className="flex flex-col items-end justify-end text-right mb-0.5 flex-shrink-0">
                        <span className={`text-[11px] sm:text-xs font-bold leading-none ${trend.neutral ? 'text-slate-500 dark:text-slate-400' : trend.negative ? 'text-rose-500 dark:text-rose-400' : trend.positive !== false ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                            {trend.value}
                        </span>
                        <span className="text-[8px] sm:text-[9px] text-[var(--text-secondary)] uppercase tracking-wider mt-0.5 line-clamp-1" title={trend.label}>{trend.label}</span>
                    </div>
                )}
            </div>
            
            <div className="mt-0.5">
                <p className="text-[9px] sm:text-[10px] text-[var(--text-secondary)] font-medium leading-none truncate" title={description}>
                    {description}
                </p>
            </div>
        </div>
    </PanelCard>
);

export const timeAgo = (dateInput: string | Date): string => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return 'Invalid date';
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 5) return "just now";
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
};

// === Shared Log Detail View Components ===

export const LogContentPanel: React.FC<{ title: string; children: React.ReactNode; copyText: string; icon: React.ReactNode; className?: string }> = ({ title, children, copyText, icon, className = '' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!copyText) return;
        navigator.clipboard.writeText(copyText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`panel-card overflow-hidden !p-0 flex flex-col ${className}`}>
            <div className="flex justify-between items-center p-3 border-b border-slate-200 bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-2">
                     <div className="w-4 flex items-center justify-center text-slate-500">{icon}</div>
                    <h4 className="font-semibold text-slate-800 text-sm">{title}</h4>
                </div>
                <button 
                    onClick={handleCopy} 
                    data-tooltip="Copy"
                    className={`text-slate-500 hover:text-indigo-600 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200 ${copied ? 'text-green-500' : ''}`}
                    disabled={!copyText}
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
            </div>
            <div className="p-3 text-xs flex-grow min-h-0 bg-[var(--card-bg)] overflow-y-auto">
                {children}
            </div>
        </div>
    );
};


export const CustomDropdown: React.FC<{
    options: string[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    displayLabels?: Record<string, string>;
    triggerClassName?: string;
}> = ({ options, value, onChange, className = '', displayLabels, triggerClassName = 'px-4 py-2.5 text-[13px]' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0, direction: 'down' as 'up' | 'down' });

    const handleSelect = (option: string) => {
        onChange(option);
        setIsOpen(false);
    };

    const getDropdownPosition = (triggerEl: HTMLButtonElement) => {
        const rect = triggerEl.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const panelHeight = Math.min(options.length * 40 + 8, 240);
        
        let direction: 'up' | 'down' = 'down';
        let top = rect.bottom;
        
        if (spaceBelow < panelHeight && spaceAbove > spaceBelow) {
            direction = 'up';
            top = rect.top;
        }
        
        // Use trigger width directly as requested for modal width
        const panelWidth = rect.width;
        
        // Ensure left position does not overflow viewport margins
        let left = rect.left;
        if (left + panelWidth > window.innerWidth - 16) {
            left = Math.max(16, window.innerWidth - panelWidth - 16);
        }
        
        return {
            top,
            left,
            width: panelWidth,
            direction
        };
    };

    const toggleOpen = () => {
        if (!isOpen && triggerRef.current) {
            setPosition(getDropdownPosition(triggerRef.current));
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isClickInsideTrigger = dropdownRef.current?.contains(target);
            const isClickInsidePanel = panelRef.current?.contains(target);
            
            if (!isClickInsideTrigger && !isClickInsidePanel) {
                setIsOpen(false);
            }
        };
        
        const handleScrollOrResize = () => {
            if (isOpen && triggerRef.current) {
                setPosition(getDropdownPosition(triggerRef.current));
            }
        };

        const preventScroll = (e: Event) => {
            if (isOpen) {
                const target = e.target as Node;
                // Allow scrolling inside the panel itself
                if (!panelRef.current?.contains(target)) {
                    e.preventDefault();
                }
            }
        };

        // Use capture phase for scroll to catch any scrollable container
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);
        
        if (isOpen) {
            document.addEventListener('wheel', preventScroll, { passive: false, capture: true });
            document.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
            document.removeEventListener('wheel', preventScroll, { capture: true });
            document.removeEventListener('touchmove', preventScroll, { capture: true });
        };
    }, [isOpen]);

    const displayValue = displayLabels?.[value] || value;

    const panelContent = (
        <div
            ref={panelRef}
            className={`custom-dropdown-panel ${isOpen ? 'open' : ''} bg-[var(--card-bg)] pb-1 pt-1 relative`}
            role="listbox"
            style={{
                position: 'fixed',
                top: position.direction === 'down' ? position.top + 15 : 'auto',
                bottom: position.direction === 'up' ? window.innerHeight - position.top + 15 : 'auto',
                left: position.left,
                width: position.width,
                zIndex: 999999
            }}
        >
            <div className={`absolute left-[50%] -ml-1.5 w-3 h-3 bg-[var(--card-bg)] border-l border-t border-[var(--border-color)] rotate-45 ${position.direction === 'down' ? '-top-1.5' : '-bottom-1.5'}`} />
            {options.map((option) => (
                <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={value === option}
                    className={`custom-dropdown-option ${value === option ? 'active text-[var(--accent-color)] bg-[var(--subtle-bg)]' : 'text-[var(--text-primary)]'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(option);
                    }}
                >
                    {displayLabels?.[option] || option}
                </button>
            ))}
        </div>
    );

    return (
        <>
            <style>{`
                .custom-dropdown-wrapper {
                    position: relative;
                    width: fit-content;
                }
                .custom-dropdown-trigger {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: fit-content;
                    min-width: 120px;
                    text-align: left;
                    background-color: var(--card-bg);
                    border: 1px solid var(--border-color);
                    transition: all 0.2s ease-in-out;
                    border-radius: 0.5rem;
                    color: var(--text-primary);
                    cursor: pointer;
                    padding: 0.375rem 0.75rem;
                    font-size: 0.75rem;
                }
                .custom-dropdown-trigger:focus {
                    outline: none;
                    border-color: var(--accent-color);
                    box-shadow: 0 0 0 2px var(--accent-glow);
                }
                .custom-dropdown-trigger .chevron {
                    transition: transform 0.2s ease;
                    margin-left: 0.5rem;
                }
                .custom-dropdown-trigger[aria-expanded="true"] .chevron {
                    transform: rotate(180deg);
                }
                .custom-dropdown-panel {
                    border: 1px solid var(--border-color);
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
                    overflow-y: auto;
                    overflow-x: hidden;
                    max-height: 240px;
                    transition: opacity 0.15s ease-out, transform 0.15s ease-out, visibility 0.15s;
                    transform-origin: top;
                    opacity: 0;
                    transform: scale(0.98);
                    pointer-events: none;
                    visibility: hidden;
                    background-color: var(--card-bg);
                }
                .custom-dropdown-panel.open {
                    opacity: 1;
                    transform: scale(1);
                    pointer-events: auto;
                    visibility: visible;
                }
                .custom-dropdown-option {
                    display: block;
                    width: 100%;
                    text-align: left;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.75rem;
                    line-height: 1.4;
                    color: var(--text-primary);
                    cursor: pointer;
                    transition: background-color 0.15s ease;
                    white-space: normal;
                    word-break: break-word;
                }
                .custom-dropdown-option:hover, .custom-dropdown-option.active {
                    background-color: var(--subtle-bg);
                }
                .custom-dropdown-option.active {
                    font-weight: 600;
                    color: var(--accent-color);
                }
            `}</style>
            <div ref={dropdownRef} className={`custom-dropdown-wrapper ${className}`}>
                <button
                    ref={triggerRef}
                    type="button"
                    className={`custom-dropdown-trigger ${triggerClassName}`}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    onClick={toggleOpen}
                >
                    <span className="capitalize truncate min-w-0">{displayValue}</span>
                    <ChevronDown size={16} className="text-slate-500 chevron" />
                </button>
                {isOpen && ReactDOM.createPortal(panelContent, document.body)}
            </div>
        </>
    );
};

const CustomDateInput: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="w-full">
            <label className="text-xs font-medium text-slate-500 block mb-1.5">{label}</label>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="form-input w-full text-sm pr-9"
                />
                <div
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 cursor-pointer text-slate-500 hover:text-slate-700 transition-colors"
                    onClick={() => inputRef.current?.showPicker()}
                >
                    <CalendarDays size={18} />
                </div>
            </div>
        </div>
    );
};

export const DateRangeFilter: React.FC<{
    onChange: (dates: { startDate: Date | null; endDate: Date | null }) => void;
}> = ({ onChange }) => {
    const [activeFilter, setActiveFilter] = useState<'all' | '7d' | 'custom'>('all');
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

    const customButtonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const handlePresetChange = useCallback((filter: 'all' | '7d') => {
        setActiveFilter(filter);
        setIsPopoverOpen(false); 

        const now = new Date();
        now.setHours(23, 59, 59, 999);
        let startDate: Date | null = null;
        let endDate: Date | null = new Date(now);

        switch (filter) {
            case '7d':
                startDate = new Date();
                startDate.setDate(now.getDate() - 6);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'all':
                startDate = null;
                endDate = null;
                break;
        }
        onChange({ startDate, endDate });
    }, [onChange]);
    
    useEffect(() => {
        handlePresetChange('all');
    }, [handlePresetChange]);

    const handleCustomApply = () => {
        if (customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            
            if (start > end) {
                alert("Start date cannot be after end date.");
                return;
            }

            setActiveFilter('custom');
            onChange({ startDate: start, endDate: end });
            setIsPopoverOpen(false);
        } else {
            alert("Please select both a start and end date.");
        }
    };

    const togglePopover = () => {
        if (customButtonRef.current) {
            const rect = customButtonRef.current.getBoundingClientRect();
            const popoverWidth = 340;
            let leftPos = rect.right + window.scrollX - popoverWidth;
            if (leftPos < 10) leftPos = 10;
            if (leftPos + popoverWidth > window.innerWidth - 10) {
                leftPos = window.innerWidth - (popoverWidth + 10);
            }
            
            setPopoverPosition({
                top: rect.bottom + window.scrollY + 8,
                left: leftPos,
            });
        }
        setIsPopoverOpen(prev => !prev);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                customButtonRef.current &&
                !customButtonRef.current.contains(event.target as Node)
            ) {
                setIsPopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const PresetButton: React.FC<{ label: string; filter: 'all' | '7d' }> = ({ label, filter }) => (
        <button
            onClick={() => handlePresetChange(filter)}
            className={`w-full px-3 py-1.5 text-[11px] font-medium rounded-xl transition-colors whitespace-nowrap ${
                activeFilter === filter
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800/80 shadow-sm'
            }`}
        >
            {label}
        </button>
    );
    
    const getCustomDisplayLabel = () => {
        if (activeFilter === 'custom' && customStartDate && customEndDate) {
            const start = new Date(customStartDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
            const end = new Date(customEndDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
            return `${start} - ${end}`;
        }
        return 'Custom Range';
    };

    const PopoverInnerContent = (
        <div className="panel-card !p-4 shadow-xl border border-slate-200/80">
            <h4 className="font-semibold text-sm mb-3 text-slate-800">Select Custom Date Range</h4>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
                <CustomDateInput 
                    label="Start Date"
                    value={customStartDate}
                    onChange={setCustomStartDate}
                />
                <CustomDateInput 
                    label="End Date"
                    value={customEndDate}
                    onChange={setCustomEndDate}
                />
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setIsPopoverOpen(false)} className="btn btn-secondary text-sm px-3 py-1.5">Cancel</button>
                <button onClick={handleCustomApply} className="btn btn-primary text-sm px-3 py-1.5">Apply</button>
            </div>
        </div>
    );

    const popoverContent = isPopoverOpen ? ReactDOM.createPortal(
        <>
            {/* Mobile: Modal with backdrop */}
            <div 
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
                onClick={() => setIsPopoverOpen(false)}
                aria-hidden="true"
            ></div>
            <div
                ref={popoverRef}
                style={{
                    '--popover-top': `${popoverPosition.top}px`,
                    '--popover-left': `${popoverPosition.left}px`,
                } as any}
                className="fixed z-50 p-4 inset-0 flex items-center justify-center md:p-0 md:inset-auto md:block md:absolute md:top-[var(--popover-top)] md:left-[var(--popover-left)]"
            >
                <div className="w-full max-w-sm md:w-[340px]">
                    {PopoverInnerContent}
                </div>
            </div>
        </>,
        document.body
    ) : null;


    return (
        <>
            <style>{`
                /* --- Date Input --- */
                /* Reset appearance to allow full custom styling */
                input[type="date"] {
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    appearance: none;
                    background-image: none;
                }
                
                /* Force hide the default calendar icon in WebKit browsers */
                input[type="date"]::-webkit-calendar-picker-indicator {
                    display: none !important;
                }
                
                /* Hide spin buttons in WebKit browsers */
                input[type="date"]::-webkit-inner-spin-button,
                input[type="date"]::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
            `}</style>
            <div className="w-full lg:w-auto">
                <div className="flex sm:inline-flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-none">
                        <PresetButton label="All Time" filter="all" />
                    </div>
                    <div className="flex-1 sm:flex-none">
                        <PresetButton label="Last 7 Days" filter="7d" />
                    </div>
                    
                    <button
                        ref={customButtonRef}
                        onClick={togglePopover}
                        className={`flex-1 sm:flex-none justify-center px-3 py-1.5 text-[11px] font-medium rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                            activeFilter === 'custom'
                                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800/80 shadow-sm'
                        }`}
                    >
                        <CalendarDays size={12} className="flex-shrink-0" />
                        <span className="truncate">{getCustomDisplayLabel()}</span>
                    </button>
                </div>
                {popoverContent}
            </div>
        </>
    );
};


export const ConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    confirmButtonClass?: string;
    isConfirmDisabled?: boolean;
}> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmButtonClass = 'btn-primary',
    isConfirmDisabled = false
}) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center modal-bg"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="modal-content w-full max-w-lg m-4 !rounded-2xl">
                <div className="p-4">
                    <h3 id="modal-title" className="text-base font-bold text-slate-800">{title}</h3>
                    <div className="text-xs text-slate-600 mt-1.5">
                        {message}
                    </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 flex justify-end gap-2 rounded-b-2xl">
                    <button type="button" onClick={onClose} className="btn btn-secondary text-sm">{cancelText}</button>
                    <button 
                        type="button"
                        onClick={onConfirm} 
                        className={`btn ${confirmButtonClass} text-sm`} 
                        disabled={isConfirmDisabled}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const AlertModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: React.ReactNode;
    buttonText?: string;
}> = ({ isOpen, onClose, title = "Alert", message, buttonText = "OK" }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center modal-bg"
            aria-labelledby="alert-modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="modal-content w-full max-w-sm m-4 !rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="p-4">
                    <h3 id="alert-modal-title" className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                        {title}
                    </h3>
                    <div className="text-sm text-slate-600 dark:text-zinc-400 mt-2 whitespace-pre-wrap">
                        {message}
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800/50 px-4 py-3 flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 dark:border-zinc-800">
                    <button type="button" onClick={onClose} className="btn btn-primary text-sm dark:bg-indigo-600 dark:hover:bg-indigo-700">{buttonText}</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const GlobalAlertProvider: React.FC = () => {
    const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; title: string }>({
        isOpen: false,
        message: "",
        title: "Alert"
    });

    useEffect(() => {
        const handleCustomAlert = (e: Event) => {
            const customEvent = e as CustomEvent;
            setAlertState({
                isOpen: true,
                message: customEvent.detail.message,
                title: customEvent.detail.title || "Alert"
            });
        };

        // Override window.alert
        window.alert = (message?: any) => {
            const event = new CustomEvent('global-alert', { detail: { message: String(message) } });
            window.dispatchEvent(event);
        };

        window.addEventListener('global-alert', handleCustomAlert);

        return () => {
            window.removeEventListener('global-alert', handleCustomAlert);
        };
    }, []);

    return (
        <AlertModal
            isOpen={alertState.isOpen}
            onClose={() => setAlertState(s => ({ ...s, isOpen: false }))}
            title={alertState.title}
            message={alertState.message}
        />
    );
};

export const BatchActionToolbar: React.FC<{
    selectedCount: number;
    totalCount?: number;
    isAllSelected?: boolean;
    onCancel: () => void;
    onDelete: () => void;
    onSelectAll?: () => void;
}> = ({ selectedCount, totalCount, isAllSelected, onCancel, onDelete, onSelectAll }) => (
    <div className="fixed bottom-4 right-4 z-50 bg-slate-800 text-white rounded-lg shadow-2xl flex items-center gap-3 p-2 animate-fade-in-up">
        <span className="font-bold text-xs px-1.5">{selectedCount} {totalCount ? `of ${totalCount}` : ''} selected</span>
        
        {onSelectAll && (
            <button 
                onClick={onSelectAll} 
                className="text-xs font-semibold text-slate-300 hover:text-white px-2 py-1.5 transition-colors border-r border-slate-600 leading-none"
            >
                {isAllSelected ? 'Unselect All' : 'Select All'}
            </button>
        )}
        
        <button onClick={onDelete} className="btn btn-danger flex items-center gap-1.5 !py-1.5 !px-2.5 text-xs">
            <Trash2 size={14} />
            Delete
        </button>

        <button 
            onClick={onCancel} 
            className="text-xs font-semibold text-slate-300 hover:text-white px-2 py-1.5 transition-colors leading-none"
            aria-label="Cancel selection"
        >
            Cancel
        </button>
    </div>
);

export const CopyButton: React.FC<{ textToCopy: string; className?: string; }> = ({ textToCopy, className = '' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!textToCopy) return;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            data-tooltip="Copy"
            className={`absolute top-2 right-2 z-10 text-slate-500 hover:text-indigo-600 disabled:text-slate-300 disabled:cursor-not-allowed transition-all w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50/50 hover:bg-slate-200 dark:bg-zinc-800/50 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 focus:opacity-100 ${copied ? '!opacity-100 text-green-500' : ''} ${className}`}
            disabled={!textToCopy}
            aria-label="Copy code to clipboard"
        >
            {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
    );
};

export const ActionPopover: React.FC<{
    isOpen: boolean;
    anchorEl: HTMLElement | null;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
}> = ({ isOpen, anchorEl, onClose, children, className = '' }) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const tailRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isOpen &&
                popoverRef.current && 
                !popoverRef.current.contains(event.target as Node) &&
                anchorEl &&
                !anchorEl.contains(event.target as Node)
            ) {
                onClose();
            }
        };
        if (isOpen) {
            setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, anchorEl]);

    useLayoutEffect(() => {
        if (!isOpen || !anchorEl || !popoverRef.current) {
            return;
        }

        const popoverEl = popoverRef.current;
        const tailEl = tailRef.current;
        
        // Find the closest scrollable container
        const getScrollParent = (node: HTMLElement | null): HTMLElement => {
            if (!node) return document.body;
            if (node.scrollHeight > node.clientHeight) {
                const overflowY = window.getComputedStyle(node).overflowY;
                if (overflowY === 'auto' || overflowY === 'scroll') {
                    return node;
                }
            }
            return getScrollParent(node.parentElement);
        };
        
        const scrollContainer = getScrollParent(anchorEl);

        const updatePosition = () => {
            if (!anchorEl || !popoverEl) return;

            const rect = anchorEl.getBoundingClientRect();
            const popoverWidth = 208; // w-52
            const popoverHeight = popoverEl.offsetHeight || 150; // estimate if not rendered yet
            
            // Check if it overflows bottom
            const spaceBelow = window.innerHeight - rect.bottom;
            const placeTop = spaceBelow < popoverHeight + 10 && rect.top > popoverHeight + 10;

            // Use fixed positioning to avoid layout thrashing and ensure perfectly synced scrolling
            let top = placeTop ? rect.top - popoverHeight - 8 : rect.bottom + 8; // 8px gap for the tail
            let left = rect.right - popoverWidth + 12; // Adjust to align the tail with the 3 dots

            left = Math.max(left, 10);

            popoverEl.style.position = 'fixed';
            popoverEl.style.top = `${top}px`;
            popoverEl.style.left = `${left}px`;
            
            if (tailEl) {
                tailEl.className = placeTop 
                    ? "absolute -bottom-1.5 right-4 w-3 h-3 bg-[var(--card-bg)] border-b border-r border-[var(--border-color)] rotate-45 z-0"
                    : "absolute -top-1.5 right-4 w-3 h-3 bg-[var(--card-bg)] border-t border-l border-[var(--border-color)] rotate-45 z-0";
            }
        };

        updatePosition();

        let ticking = false;
        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    updatePosition();
                    ticking = false;
                });
                ticking = true;
            }
        };

        scrollContainer.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', updatePosition);

        return () => {
            scrollContainer.removeEventListener('scroll', onScroll);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, anchorEl]);

    if (!isOpen || !anchorEl) {
        return null;
    }

    return ReactDOM.createPortal(
        <div ref={popoverRef} className={`z-50 w-52 ${className}`} style={{ position: 'fixed', top: '-9999px', left: '-9999px' }}>
            {/* The Tail */}
            <div ref={tailRef} className="absolute -top-1.5 right-4 w-3 h-3 bg-[var(--card-bg)] border-t border-l border-[var(--border-color)] rotate-45 z-0"></div>
            {/* The Content */}
            <div className="relative bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-lg overflow-hidden z-10">
                <div className="p-1">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};