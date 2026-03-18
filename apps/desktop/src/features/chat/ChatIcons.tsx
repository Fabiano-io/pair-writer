import type { SVGProps } from "react";

export function AttachIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" {...props}>
      <path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2A4 4 0 0 1 18.6 8.3l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
    </svg>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M8 3v10" />
      <path d="M3 8h10" />
    </svg>
  );
}

export function ImageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3" y="3.5" width="14" height="13" rx="2.6" />
      <circle cx="7.1" cy="8" r="1.45" />
      <path d="M4.8 14.3 8.4 10.6l2.7 2.6 2.2-2.2 2.4 2.5" />
    </svg>
  );
}

export function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M4 2.5h5l3 3v8A1.5 1.5 0 0 1 10.5 15h-6A1.5 1.5 0 0 1 3 13.5V4A1.5 1.5 0 0 1 4.5 2.5Z" />
      <path d="M9 2.5v3h3" />
    </svg>
  );
}

export function AgentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M5.2 5.2A2.8 2.8 0 0 1 8 2.4a2.8 2.8 0 0 1 2.8 2.8" />
      <path d="M3.3 10.4A4.7 4.7 0 0 1 8 5.7a4.7 4.7 0 0 1 4.7 4.7" />
      <path d="M2.3 13.2A5.7 5.7 0 0 1 8 7.5a5.7 5.7 0 0 1 5.7 5.7" />
    </svg>
  );
}

export function PlanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M4 4.5h8" />
      <path d="M4 8h8" />
      <path d="M4 11.5h5.5" />
      <circle cx="2.4" cy="4.5" r=".7" fill="currentColor" stroke="none" />
      <circle cx="2.4" cy="8" r=".7" fill="currentColor" stroke="none" />
      <circle cx="2.4" cy="11.5" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AskIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M8 12.8a4.8 4.8 0 1 0-4.8-4.8A4.8 4.8 0 0 0 8 12.8Z" />
      <path d="M6.8 6.5a1.4 1.4 0 1 1 2.2 1.1c-.7.5-1 .8-1 1.5" />
      <circle cx="8" cy="11.2" r=".55" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M2.4 10s2.9-5 7.6-5 7.6 5 7.6 5-2.9 5-7.6 5-7.6-5-7.6-5Z" />
      <circle cx="10" cy="10" r="2.45" />
    </svg>
  );
}

export function ToolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M16.2 4.2a4.1 4.1 0 0 0-5.3 4.9L5.6 14.4a2.2 2.2 0 1 0 3.1 3.1l5.3-5.3a4.1 4.1 0 0 0 4.9-5.3l-2.5 2.5-2.2-.3-.3-2.2 2.3-2.7Z" />
      <circle cx="7.2" cy="15.8" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ThinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.55" {...props}>
      <path d="M8 4.3A2.7 2.7 0 0 0 5.2 7a2.6 2.6 0 0 0-1.8 2.5A2.5 2.5 0 0 0 5 11.8a2.6 2.6 0 0 0 2.5 3.7H8" />
      <path d="M12 4.3A2.7 2.7 0 0 1 14.8 7a2.6 2.6 0 0 1 1.8 2.5 2.5 2.5 0 0 1-1.6 2.3 2.6 2.6 0 0 1-2.5 3.7H12" />
      <path d="M10 4.2v11.3" />
      <path d="M7.4 7.3c.3-.7.9-1.1 1.9-1.3" />
      <path d="M7.3 10.6c.4-.5 1.1-.8 2-.9" />
      <path d="M12.6 7.3c-.3-.7-.9-1.1-1.9-1.3" />
      <path d="M12.7 10.6c-.4-.5-1.1-.8-2-.9" />
    </svg>
  );
}

export function MicrophoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.55" {...props}>
      <path d="M10 13a3 3 0 0 0 3-3V6.2a3 3 0 1 0-6 0V10a3 3 0 0 0 3 3Z" />
      <path d="M5.6 9.5a4.4 4.4 0 0 0 8.8 0" />
      <path d="M10 13.4v3.2" />
      <path d="M7.3 16.6h5.4" />
    </svg>
  );
}

export function SendArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M8 13V3" />
      <path d="M4.7 6.3L8 3l3.3 3.3" />
    </svg>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M4 6.5 8 10l4-3.5" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M3.5 8.3 6.5 11l6-6" />
    </svg>
  );
}
