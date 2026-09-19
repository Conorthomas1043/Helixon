"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { ALL_NAV_ITEMS } from "./nav";

// Cmd/Ctrl+K jump-to. Type to filter pages, arrows to move, Enter to go.
export function CommandPalette({ open, onClose, onLogout }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => {
    const pages = ALL_NAV_ITEMS.map((item) => ({
      key: item.href,
      label: item.label,
      hint: item.group,
      icon: item.icon,
      description: item.hint,
      run: () => router.push(item.href),
    }));
    const actions = [{ key: "logout", label: "Log out", hint: "Action", icon: "logout", run: onLogout }];
    const all = [...pages, ...actions];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((i) => `${i.label} ${i.hint} ${i.description || ""}`.toLowerCase().includes(q));
  }, [query, router, onLogout]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const active = Math.min(index, Math.max(0, items.length - 1));

  function close() {
    setQuery("");
    setIndex(0);
    onClose();
  }

  function choose(item) {
    close();
    item?.run();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((active + 1) % Math.max(1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((active - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  return (
    <div className="palette-overlay" onMouseDown={close}>
      <div className="palette" role="dialog" aria-label="Jump to" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Jump to a page or action..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={onKeyDown}
          aria-label="Search pages"
        />
        <div className="palette-list" role="listbox">
          {items.length === 0 && <div className="empty">Nothing matches &ldquo;{query}&rdquo;.</div>}
          {items.map((item, i) => (
            <button
              key={item.key}
              role="option"
              aria-selected={i === active}
              className={`palette-item ${i === active ? "active" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(item)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
        <div className="palette-foot">
          <span>&uarr;&darr; move</span>
          <span>&crarr; open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
