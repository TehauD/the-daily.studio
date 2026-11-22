/** 1.5px-stroke 20×20 icon set, drawn for FORGE. currentColor only. */
const P: Record<string, string> = {
  guide: "M4 4.5h5a2 2 0 0 1 2 2V16a1.5 1.5 0 0 0-1.5-1.5H4zM16 4.5h-5M16 4.5v10h-4.5A1.5 1.5 0 0 0 10 16",
  overview: "M3.5 10a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0M10 10l3.2-2.4M10 3.5v1.6M3.5 10h1.6M16.5 10h-1.6",
  observatory: "M10 3v2M10 15v2M3 10h2M15 10h2M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6M5.4 5.4l1.4 1.4M13.2 13.2l1.4 1.4",
  studio: "M4 5h12M4 10h12M4 15h12M7 3.5v3M13 8.5v3M9 13.5v3",
  trajectory: "M3.5 15.5c3 0 2.5-5.5 6.5-5.5s3.5-5.5 6.5-5.5M3.5 15.5h.01M16.5 4.5h.01M10 10h.01",
  dataset: "M4 5.5c0-1.1 2.7-2 6-2s6 .9 6 2-2.7 2-6 2-6-.9-6-2M4 5.5v9c0 1.1 2.7 2 6 2s6-.9 6-2v-9M4 10c0 1.1 2.7 2 6 2s6-.9 6-2",
  training: "M3.5 16.5h13M5 14l3-4 3 2 4-6M15 6h-2.5M15 6v2.5",
  evaluation: "M5 16.5V9M10 16.5V4.5M15 16.5v-5M3.5 16.5h13",
  factory: "M10 3l6 3.5v7L10 17l-6-3.5v-7zM10 10l6-3.5M10 10v7M10 10L4 6.5",
  settings: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4",
  search: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12M17 17l-3.8-3.8",
  check: "M4.5 10.5l3.5 3.5 7.5-8",
  x: "M5 5l10 10M15 5L5 15",
  alert: "M10 3.5l7 12.5H3zM10 8.5v3.5M10 14.2v.1",
  info: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14M10 9v4.5M10 6.5v.1",
  question: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14M8 8a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M10 14v.1",
  chevron: "M8 5l5 5-5 5",
  chevronDown: "M5 8l5 5 5-5",
  play: "M6.5 4.5v11l9-5.5z",
  stop: "M5.5 5.5h9v9h-9z",
  copy: "M7 7h8.5v9.5H7zM4.5 13V3.5H13",
  sun: "M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.3 4.3l1.1 1.1M14.6 14.6l1.1 1.1M4.3 15.7l1.1-1.1M14.6 5.4l1.1-1.1",
  moon: "M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8",
  monitor: "M3 4.5h14v9H3zM7 16.5h6M10 13.5v3",
  gpu: "M3 6h14v8H3zM6 9h3v2H6zM11 9h3v2h-3zM5 14v2.5M15 14v2.5M3 8H1.5M3 12H1.5",
  external: "M11 4h5v5M16 4l-7 7M14 11.5V16H4V6h4.5",
  lock: "M5.5 9h9v7.5h-9zM7.5 9V6.5a2.5 2.5 0 0 1 5 0V9",
  seal: "M10 2.5l2 1.6 2.5-.3.9 2.4 2.1 1.4-.8 2.4.8 2.4-2.1 1.4-.9 2.4-2.5-.3-2 1.6-2-1.6-2.5.3-.9-2.4L2.5 12l.8-2.4L2.5 7.2l2.1-1.4.9-2.4 2.5.3zM7.3 10l1.8 1.8 3.6-3.6",
  refresh: "M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3h-3",
  download: "M10 3.5v9M6.5 9.5L10 13l3.5-3.5M4 16.5h12",
  sidebar: "M3.5 4h13v12h-13zM8 4v12",
  command: "M7 7h6v6H7zM7 7V5.5A1.5 1.5 0 1 0 5.5 7zM13 7V5.5A1.5 1.5 0 1 1 14.5 7zM7 13v1.5A1.5 1.5 0 1 1 5.5 13zM13 13v1.5a1.5 1.5 0 1 0 1.5-1.5z",
  layers: "M10 3l7 4-7 4-7-4zM3 11l7 4 7-4",
  link: "M8.5 11.5l3-3M7 9l-1.8 1.8a2.8 2.8 0 0 0 4 4L11 13M13 11l1.8-1.8a2.8 2.8 0 0 0-4-4L9 7",
  file: "M5 2.5h6.5L15 6v11.5H5zM11.5 2.5V6H15",
  plus: "M10 4.5v11M4.5 10h11",
  dot: "M10 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2",
  agent: "M7 6.5h6a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3M10 6.5V3.5M8 11h.01M12 11h.01M2.5 10.5v1.5M17.5 10.5v1.5",
  lens: "M2.5 10c2.2-3.7 4.7-5.5 7.5-5.5s5.3 1.8 7.5 5.5c-2.2 3.7-4.7 5.5-7.5 5.5S4.7 13.7 2.5 10M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  graph: "M3 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M13 5a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 15a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7 6h6M6.2 7.6l2.9 5.6M13.8 6.6l-2.9 6.6",
  flask: "M8 3h4M8.5 3v5L4 15.5A1 1 0 0 0 4.9 17h10.2a1 1 0 0 0 .9-1.5L11.5 8V3M6 12.5h8",
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 16, className = "", title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d={P[name]} />
    </svg>
  );
}
