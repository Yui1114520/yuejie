import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function NewsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h11A1.5 1.5 0 0 1 18 5.5V18a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5.5Z" />
      <path d="M18 8h.5A1.5 1.5 0 0 1 20 9.5V18" />
      <path d="M7 8h7M7 11.5h7M7 15h4" />
    </svg>
  );
}

export function PapersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4h11a2 2 0 0 1 2 2v13.5a1.5 1.5 0 0 1-2.2 1.3L12 19l-3.8 1.8A1.5 1.5 0 0 1 6 19.5V6a2 2 0 0 1 2-2Z" transform="translate(-1 0)" />
      <path d="M9 8h6M9 11.5h6M9 15h4" />
    </svg>
  );
}

export function LearnIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.2 3.7 5.2 3.7 8.5s-1.3 6.3-3.7 8.5c-2.4-2.2-3.7-5.2-3.7-8.5S9.6 5.7 12 3.5Z" />
    </svg>
  );
}

export function MeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M4.8 20c.6-3.6 3.6-5.6 7.2-5.6s6.6 2 7.2 5.6" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21c3.6 0 6.2-2.4 6.2-5.8 0-4.4-4-6.1-3.4-10.2-2.2.7-3.4 2.4-3.9 4.1-.5-.6-.8-1.6-.8-2.6C7.7 8 5.8 10.8 5.8 15c0 3.4 2.6 6 6.2 6Z" />
      <path d="M12 21c1.7 0 2.9-1.2 2.9-2.8 0-1.7-1.5-2.5-1.5-4.2-1.4.6-2.2 1.8-2.2 3-.4-.4-.6-.9-.7-1.4-1 1-1.6 2-1.6 3.1 0 1.4 1.3 2.3 3.1 2.3Z" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 8.5 4.6L12 12.2 3.5 7.6 12 3Z" />
      <path d="m4.5 12 7.5 4 7.5-4M4.5 16.4l7.5 4 7.5-4" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}
