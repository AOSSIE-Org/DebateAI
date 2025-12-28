import { useContext, useState, useRef, useEffect } from "react";
import { ThemeContext, ThemeOptions } from "../context/theme-provider";
import { Moon, Sun, Contrast } from "lucide-react";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const themeOptions = [
    { id: ThemeOptions.Light, name: "Light", icon: <Sun size={16} /> },
    { id: ThemeOptions.Dark, name: "Dark", icon: <Moon size={16} /> },
    { id: ThemeOptions.Contrast, name: "High Contrast", icon: <Contrast size={16} /> },
  ];

  const setTheme = (targetId: number) => {
    const current = theme;
    const totalThemes = Object.keys(ThemeOptions).length / 2;
    const clicks = (targetId - current + totalThemes) % totalThemes;
    for (let i = 0; i < clicks; i++) toggleTheme();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 p-2 text-sm font-medium rounded-md hover:bg-muted/70 transition"
      >
        {themeOptions.find((t) => t.id === theme)?.icon} Theme:{" "}
        <span>{themeOptions.find((t) => t.id === theme)?.name}</span>
        <svg
          className={`ml-auto w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-2 right-2 mt-1 bg-popover border border-border rounded-md shadow z-10">
          {themeOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => setTheme(option.id)}
              className="flex items-center gap-2 p-2 text-sm hover:bg-muted cursor-pointer rounded-md"
            >
              {option.icon}
              <span>{option.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}