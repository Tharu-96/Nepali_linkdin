import React from 'react';

export default function DocumentPicker({ onSelect, className = "btn btn-sm", label = "Select Document", accept = "*/*" }) {
  const inputRef = React.useRef(null);
  const trigger = () => inputRef.current && inputRef.current.click();
  const handle = (e) => {
    const f = e.target.files?.[0];
    if (f && onSelect) onSelect(f);
    e.target.value = '';
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handle} />
      <button type="button" onClick={trigger} className={className}>{label}</button>
    </div>
  );
}
