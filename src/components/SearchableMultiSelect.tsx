import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, LucideIcon } from 'lucide-react';

export interface MultiSelectOption {
  id: string | number;
  label: string;
  count?: number;
  badge?: string;
}

interface SearchableMultiSelectProps {
  label?: string;
  allLabel?: string;
  icon?: LucideIcon;
  options: MultiSelectOption[];
  selectedValues: (string | number)[];
  onChange: (values: any[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  maxBadgeDisplay?: number;
}

export const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  label,
  allLabel,
  icon: Icon,
  options,
  selectedValues,
  onChange,
  placeholder,
  searchPlaceholder,
}) => {
  const effectiveLabel = label || placeholder || 'Itens';
  const effectiveSearchPlaceholder = searchPlaceholder || placeholder || 'Buscar...';
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q) || (opt.badge && opt.badge.toLowerCase().includes(q)));
  }, [options, search]);

  const selectedSet = useMemo(() => {
    const s = new Set<string>();
    selectedValues.forEach((v) => s.add(String(v)));
    return s;
  }, [selectedValues]);

  const toggleOption = (id: string | number) => {
    const idStr = String(id);
    if (selectedSet.has(idStr)) {
      onChange(selectedValues.filter((v) => String(v) !== idStr));
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(options.map((o) => o.id));
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onChange([]);
  };

  const buttonText = useMemo(() => {
    if (selectedValues.length === 0) {
      return allLabel || `Todos (${options.length})`;
    }
    if (selectedValues.length === 1) {
      const match = options.find((o) => String(o.id) === String(selectedValues[0]));
      return match ? match.label : `1 selecionado`;
    }
    return `${effectiveLabel} (${selectedValues.length})`;
  }, [selectedValues, options, allLabel, effectiveLabel]);

  const hasSelection = selectedValues.length > 0;

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'} w-full`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-1.5 transition-all text-left ${
          hasSelection
            ? 'bg-rose-950/40 border-rose-700/80 text-rose-300 shadow-sm'
            : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${hasSelection ? 'text-rose-400' : 'text-slate-400'}`} />}
          <span className="truncate">{buttonText}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasSelection && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleClear(e);
              }}
              className="p-0.5 rounded-full hover:bg-rose-900/60 text-rose-300 transition-colors"
              title="Limpar seleção"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-full left-0 mt-1.5 w-72 max-w-[90vw] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 space-y-2 animate-pop-in"
        >
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={effectiveSearchPlaceholder}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
            {search && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch('');
                }}
                className="absolute right-2 top-2 text-slate-400 hover:text-white"
                title="Limpar busca"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 border-b border-slate-800/80 pb-1.5">
            <button
              type="button"
              onClick={handleSelectAll}
              className="hover:text-rose-400 transition-colors font-medium"
            >
              Selecionar todos ({options.length})
            </button>
            {hasSelection && (
              <button
                type="button"
                onClick={handleClear}
                className="hover:text-rose-400 transition-colors font-medium text-rose-300"
              >
                Limpar seleção
              </button>
            )}
          </div>

          {/* List of options */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
            {filteredOptions.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-500">Nenhum resultado encontrado</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedSet.has(String(opt.id));
                return (
                  <div
                    key={String(opt.id)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleOption(opt.id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleOption(opt.id);
                      }
                    }}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                      isSelected
                        ? 'bg-rose-950/60 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-rose-600 border-rose-500 text-white'
                            : 'border-slate-700 bg-slate-950'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {(opt.badge || opt.count !== undefined) && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 shrink-0 pointer-events-none">
                        {opt.badge || opt.count}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
