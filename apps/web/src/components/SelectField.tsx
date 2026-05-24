import {
  Check,
  ChevronDown,
  CircleAlert,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  compact?: boolean;
  showSelectedDescription?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
  showSelectedDescription = true,
  className = "",
  buttonClassName = "",
  menuClassName = "",
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value]
  );
  const sizeClass = compact
    ? "h-[34px] px-2 py-1.5"
    : "min-h-10 px-3 py-2";
  const iconSizeClass = compact ? "h-5 w-5" : "h-6 w-6";
  const labelClass = compact
    ? "block text-sm text-slate-400"
    : "mb-1 block text-xs font-medium text-slate-500";
  const buttonMarginClass = compact ? "mt-1" : "";

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selectOption = (nextValue: T) => {
    onChange(nextValue);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    option: SelectOption<T>,
    index: number
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(option.value);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (index + offset + options.length) % options.length;
      rootRef.current
        ?.querySelectorAll<HTMLButtonElement>("[data-select-option]")
        [nextIndex]?.focus();
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span className={labelClass}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onButtonKeyDown}
        className={`flex w-full items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-900 text-left text-sm text-slate-100 shadow-sm transition hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 ${buttonMarginClass} ${sizeClass} ${buttonClassName}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`flex shrink-0 items-center justify-center rounded bg-brand-500/10 text-brand-500 ${iconSizeClass}`}
          >
            {selected?.icon ?? <UserRound className="h-3.5 w-3.5" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{selected?.label}</span>
            {showSelectedDescription && selected?.description && (
              <span className="block truncate text-xs text-slate-500">
                {selected.description}
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className={`absolute right-0 z-50 mt-2 w-full min-w-52 overflow-hidden rounded-md border border-slate-700 bg-white p-1 shadow-xl shadow-slate-900/10 ${menuClassName}`}
        >
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                data-select-option
                onClick={() => selectOption(option.value)}
                onKeyDown={(event) => onOptionKeyDown(event, option, index)}
                className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm transition ${
                  active
                    ? "bg-brand-500 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${
                    active ? "bg-white/15 text-white" : "bg-brand-500/10 text-brand-500"
                  }`}
                >
                  {option.icon ?? <UserRound className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.description && (
                    <span
                      className={`block truncate text-xs ${
                        active ? "text-white/80" : "text-slate-500"
                      }`}
                    >
                      {option.description}
                    </span>
                  )}
                </span>
                {active && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const selectIcons = {
  viewer: <UserRound className="h-3.5 w-3.5" />,
  duty: <ShieldCheck className="h-3.5 w-3.5" />,
  ops: <CircleAlert className="h-3.5 w-3.5" />,
  none: <XCircle className="h-3.5 w-3.5" />,
};
