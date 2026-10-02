'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export type SearchableOption = { value: string; label: string; description?: string };
type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
};

export default function SearchableSelect({
  options, value, onChange, placeholder = 'Choose an option…',
  searchPlaceholder = 'Type to search…', allowClear = true, disabled = false,
  className = '', emptyMessage = 'No matches found',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return options.filter(option => !q || (option.label + ' ' + (option.description || '')).toLocaleLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery(selected?.label || '');
  }, [value, selected?.label, open]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return <div ref={root} className={'search-select ' + className}>
    <div className={'search-select-control' + (open ? ' search-select-open' : '') + (disabled ? ' search-select-disabled' : '')}>
      <Search size={17} aria-hidden="true" className="search-select-leading" />
      <input
        role="combobox" aria-label={placeholder} aria-expanded={open} aria-autocomplete="list"
        autoComplete="off" disabled={disabled} value={open ? query : (selected?.label || '')}
        placeholder={placeholder} onFocus={() => { setQuery(''); setOpen(true); }}
        onClick={() => { if (!open) { setQuery(''); setOpen(true); } }}
        onChange={event => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && filtered[0]) { event.preventDefault(); onChange(filtered[0].value); setQuery(filtered[0].label); setOpen(false); }
          if (event.key === 'ArrowDown') setOpen(true);
        }}
      />
      {allowClear && value && !disabled && <button type="button" className="search-select-clear" aria-label="Clear selection" onClick={() => { onChange(''); setQuery(''); setOpen(false); }}><X size={15}/></button>}
      <ChevronDown size={16} aria-hidden="true" className={'search-select-chevron' + (open ? ' search-select-chevron-up' : '')}/>
    </div>
    {open && !disabled && <div className="search-select-menu" role="listbox">
      {filtered.length ? filtered.slice(0, 80).map(option => <button type="button" role="option" aria-selected={value === option.value} key={option.value || '__empty'} onClick={() => { onChange(option.value); setQuery(option.label); setOpen(false); }} className={'search-select-option' + (value === option.value ? ' search-select-option-active' : '')}>
        <span className="search-select-option-copy"><span>{option.label}</span>{option.description && <small>{option.description}</small>}</span>
        {value === option.value && <Check size={16}/>}
      </button>) : <div className="search-select-empty">{emptyMessage}</div>}
    </div>}
  </div>;
}
