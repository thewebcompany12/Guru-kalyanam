'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export type SearchableOption = { value: string; label: string; description?: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
};

export default function SearchableSelect({
  value, onChange, options, placeholder = 'Choose an option…',
  searchPlaceholder = 'Search by name…', disabled = false,
  className = '', clearable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(option => option.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return options.slice(0, 80);
    return options.filter(option =>
      (option.label + ' ' + (option.description || '')).toLocaleLowerCase().includes(q)
    ).slice(0, 80);
  }, [options, query]);

  return (
    <div className={`searchable-select ${className}`}>
      <button type="button" className="searchable-select-trigger" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open}
        onClick={() => { setOpen(value => !value); setQuery(''); }}>
        <span className={selected ? 'searchable-select-value' : 'searchable-select-placeholder'}>
          {selected?.label || placeholder}
        </span>
        <span className="searchable-select-actions">
          {clearable && value && !disabled && <span role="button" tabIndex={0} aria-label="Clear selection"
            className="searchable-select-clear" onClick={event => { event.stopPropagation(); onChange(''); setOpen(false); }}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onChange(''); setOpen(false); } }}><X size={14}/></span>}
          <ChevronDown size={17} className={open ? 'rotate-180 transition-transform' : 'transition-transform'}/>
        </span>
      </button>
      {open && !disabled && <>
        <button type="button" className="searchable-select-dismiss" aria-label="Close options" onClick={() => setOpen(false)} />
        <div className="searchable-select-popover">
          <label className="searchable-select-search"><Search size={16}/><input autoFocus value={query}
            onChange={event => setQuery(event.target.value)} placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}/></label>
          <div role="listbox" className="searchable-select-options">
            {clearable && <button type="button" role="option" aria-selected={!value} className="searchable-select-option searchable-select-empty"
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}>{placeholder}</button>}
            {filtered.map(option => <button type="button" role="option" aria-selected={option.value === value}
              key={option.value} className="searchable-select-option"
              onClick={() => { onChange(option.value); setOpen(false); setQuery(''); }}>
              <span className="min-w-0"><span className="block truncate font-semibold">{option.label}</span>
                {option.description && <span className="block truncate text-xs text-slate-400">{option.description}</span>}</span>
              {option.value === value && <Check size={16} className="shrink-0 text-emerald-600"/>}
            </button>)}
            {filtered.length === 0 && <p className="px-3 py-7 text-center text-sm text-slate-500">No matches. Try another search.</p>}
            {filtered.length === 80 && <p className="px-3 py-2 text-xs text-slate-400">Showing first 80 matches — type more to narrow results.</p>}
          </div>
        </div>
      </>}
    </div>
  );
}
