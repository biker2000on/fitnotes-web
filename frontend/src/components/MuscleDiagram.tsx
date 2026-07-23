// MuscleDiagram.tsx - Stylized front/back anatomy figures with muscle regions
// tinted by involvement: primary (red), secondary (amber), untargeted (gray).
import React from 'react';
import type { MuscleKey } from '../lib/muscles';

interface MuscleDiagramProps {
  primary: Set<MuscleKey> | MuscleKey[];
  secondary?: Set<MuscleKey> | MuscleKey[];
  height?: number;
  showLegend?: boolean;
  compact?: boolean;
}

const COLOR_PRIMARY = '#e0393e';
const COLOR_SECONDARY = '#f0b429';
const COLOR_INACTIVE = '#3a4048';
const COLOR_BODY = '#2a2f36';
const COLOR_LINE = '#181b20';

type Shape =
  | { kind: 'path'; d: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotate?: number };

// All shapes describe the LEFT side of the body (viewBox 0 0 120 250,
// centerline x=60) and are mirrored automatically, guaranteeing symmetry.
const FRONT_SHAPES: Partial<Record<MuscleKey, Shape[]>> = {
  neck: [{ kind: 'path', d: 'M60,27 L60,36 L53,37 C54,33 55,30 55,27 Z' }],
  traps: [{ kind: 'path', d: 'M54,31 C49,34 43,37 39,40 C44,40 50,39 54,37 Z' }],
  front_delts: [{ kind: 'ellipse', cx: 37.5, cy: 45, rx: 5.5, ry: 5, rotate: -22 }],
  side_delts: [{ kind: 'ellipse', cx: 30.8, cy: 48, rx: 4.4, ry: 6.6, rotate: -14 }],
  chest: [{ kind: 'path', d: 'M60,41 C51,40 44,43 41,48 C39,53 42,60 48,63 C53,65.5 58,64 60,62 Z' }],
  biceps: [{ kind: 'ellipse', cx: 30.4, cy: 64, rx: 4.8, ry: 10.5, rotate: 9 }],
  forearms: [{ kind: 'ellipse', cx: 25.4, cy: 92, rx: 4.2, ry: 12.5, rotate: 9 }],
  abs: [{ kind: 'path', d: 'M60,67 L53.5,67 C52,78 52.5,92 55.5,105 L60,106 Z' }],
  obliques: [{ kind: 'path', d: 'M52,68 C49.5,78 49.5,92 52.5,102 L54.5,104 C52,93 51.8,79 53,68 Z' }],
  hip_flexors: [{ kind: 'path', d: 'M55,108 L60,109 L60,118 C57.5,115 55.5,111.5 55,108 Z' }],
  adductors: [{ kind: 'path', d: 'M58.5,121 C58.5,135 57.5,147 55.5,157 L52.8,156 C54,143 55.8,130 56.5,121 Z' }],
  quads: [{ kind: 'path', d: 'M47,115 C42,128 41.5,150 45.5,170 L52.5,171 C55.5,154 55.5,132 54,118 C51.5,115.5 49,114.5 47,115 Z' }],
  calves: [{ kind: 'ellipse', cx: 49, cy: 196, rx: 4.2, ry: 14, rotate: 2 }],
};

const BACK_SHAPES: Partial<Record<MuscleKey, Shape[]>> = {
  neck: [{ kind: 'path', d: 'M60,26 L60,31 L55,31 C55.5,29 55.8,27.5 55.8,26 Z' }],
  traps: [{ kind: 'path', d: 'M60,29 C54,31 46,35 40,41 C47,45 54,52 57.5,62 L60,62 Z' }],
  rear_delts: [{ kind: 'ellipse', cx: 32.3, cy: 47.5, rx: 5.2, ry: 6.2, rotate: -16 }],
  upper_back: [{ kind: 'path', d: 'M42,50 C46,55 52,60 57.5,63 L57.5,68 C50.5,65 44,58 41,52 Z' }],
  lats: [{ kind: 'path', d: 'M41.5,55 C41,64 44,78 51,89 C53.5,92.5 56.5,94.5 58,94.5 L58,68 C52.5,64.5 46,60 41.5,55 Z' }],
  lower_back: [{ kind: 'path', d: 'M60,66 L60,106 L55.8,104 C55.8,91 56.8,77 57.8,66 Z' }],
  triceps: [{ kind: 'ellipse', cx: 29.8, cy: 65, rx: 4.8, ry: 11, rotate: 10 }],
  forearms: [{ kind: 'ellipse', cx: 25, cy: 92, rx: 4.2, ry: 12.5, rotate: 9 }],
  abductors: [{ kind: 'ellipse', cx: 43, cy: 114, rx: 3.4, ry: 6.6, rotate: 16 }],
  glutes: [{ kind: 'path', d: 'M60,108 C52,106.5 45.5,110 44.5,118.5 C44,127 50,132.5 57,131.5 C59,131 60,129 60,127 Z' }],
  hamstrings: [{ kind: 'path', d: 'M47,134 C44,146 44,160 47.5,172 L54,172.5 C56,160 56,146 55,135 C52,133.2 49,133.2 47,134 Z' }],
  calves: [{ kind: 'ellipse', cx: 49.3, cy: 195, rx: 5.2, ry: 15, rotate: 2 }],
};

// Half-body silhouette (left side), mirrored for the right.
const SILHOUETTE_HALF = [
  'M60,6 C53,6 49,11 49,18 C49,23 51,27 54,30',
  'C52,32 50,34 47.5,36.5 C42,38.5 35,41 31,45',
  'C27,49 25.8,55 25.5,60 C25,70 24,82 22.5,94',
  'C21.5,100 20.5,106 20.5,112 C18.5,117 19,122 22,121',
  'C25,120 26.2,113 27.2,108 C29,98 30.8,88 31.8,80',
  'C33,74 34,68 35.2,62 C35.8,58.5 36.6,56.5 37.6,56',
  'C37.6,68 37.8,82 40,94 C42,102 44,110 44,118',
  'C40.5,132 40,152 44,172 C45,186 45.2,202 47,218',
  'C46,224 45,230 48,232 C52,234 55,232 54.2,226',
  'C53.4,220 53.2,214 53.2,208 C54,196 54.8,186 55,178',
  'C55.2,172 55.8,168 56.2,164 C57.2,152 58,140 58.4,128',
  'C59,124 60,122 60,120 Z',
].join(' ');

function shapeFill(key: MuscleKey, primary: Set<MuscleKey>, secondary: Set<MuscleKey>): string {
  if (primary.has(key)) return COLOR_PRIMARY;
  if (secondary.has(key)) return COLOR_SECONDARY;
  return COLOR_INACTIVE;
}

function renderShapes(
  shapes: Partial<Record<MuscleKey, Shape[]>>,
  primary: Set<MuscleKey>,
  secondary: Set<MuscleKey>,
) {
  return (Object.entries(shapes) as Array<[MuscleKey, Shape[]]>).map(([key, list]) => (
    <g key={key}>
      {list.map((s, i) => {
        const fill = shapeFill(key, primary, secondary);
        const active = fill !== COLOR_INACTIVE;
        const common = {
          fill,
          stroke: COLOR_LINE,
          strokeWidth: 0.7,
          opacity: active ? 1 : 0.9,
        };
        if (s.kind === 'path') {
          return (
            <React.Fragment key={i}>
              <path d={s.d} {...common} />
              <path d={s.d} {...common} transform="translate(120,0) scale(-1,1)" />
            </React.Fragment>
          );
        }
        const transform = (mirror: boolean) => {
          const rot = s.rotate ? ` rotate(${mirror ? -s.rotate : s.rotate} ${s.cx} ${s.cy})` : '';
          return mirror ? `translate(120,0) scale(-1,1)${rot}` : rot || undefined;
        };
        return (
          <React.Fragment key={i}>
            <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={transform(false)} {...common} />
            <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={transform(true)} {...common} />
          </React.Fragment>
        );
      })}
    </g>
  ));
}

function Figure({ shapes, primary, secondary, label, height }: {
  shapes: Partial<Record<MuscleKey, Shape[]>>;
  primary: Set<MuscleKey>;
  secondary: Set<MuscleKey>;
  label: string;
  height: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg viewBox="0 0 120 250" height={height} role="img" aria-label={`${label} muscle diagram`}>
        <path d={SILHOUETTE_HALF} fill={COLOR_BODY} stroke={COLOR_LINE} strokeWidth={0.8} />
        <path d={SILHOUETTE_HALF} fill={COLOR_BODY} stroke={COLOR_LINE} strokeWidth={0.8} transform="translate(120,0) scale(-1,1)" />
        {renderShapes(shapes, primary, secondary)}
        {/* Ab segmentation lines for definition */}
        <g stroke={COLOR_LINE} strokeWidth={0.6} opacity={0.55}>
          <line x1={53} y1={77} x2={67} y2={77} />
          <line x1={52.6} y1={86} x2={67.4} y2={86} />
          <line x1={53} y1={95} x2={67} y2={95} />
          <line x1={60} y1={67} x2={60} y2={106} />
        </g>
      </svg>
      <span style={{ fontSize: 11, opacity: 0.6 }}>{label}</span>
    </div>
  );
}

// Collapsible "Muscles Worked" wrapper used across views (workout summary,
// calendar day, routine cards, history drawer).
export function MuscleDiagramDetails({ primary, secondary, label = 'Muscles Worked', defaultOpen = true, height = 170, showLegend = false }: {
  primary: Set<MuscleKey> | MuscleKey[];
  secondary?: Set<MuscleKey> | MuscleKey[];
  label?: string;
  defaultOpen?: boolean;
  height?: number;
  showLegend?: boolean;
}) {
  const primCount = primary instanceof Set ? primary.size : primary.length;
  const secCount = secondary ? (secondary instanceof Set ? secondary.size : secondary.length) : 0;
  if (primCount === 0 && secCount === 0) return null;
  return (
    <details open={defaultOpen} style={{ border: '1px solid var(--border-dark)', borderRadius: '12px', padding: '10px 12px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>{label}</summary>
      <div style={{ marginTop: '10px' }}>
        <MuscleDiagram primary={primary} secondary={secondary} height={height} showLegend={showLegend} />
      </div>
    </details>
  );
}

export default function MuscleDiagram({ primary, secondary = [], height = 210, showLegend = true, compact = false }: MuscleDiagramProps) {
  const prim = primary instanceof Set ? primary : new Set(primary);
  const sec = secondary instanceof Set ? new Set(secondary) : new Set(secondary);
  prim.forEach(k => sec.delete(k));

  return (
    <div className="muscle-diagram" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 4 : 10 }}>
      <div style={{ display: 'flex', gap: compact ? 8 : 24, justifyContent: 'center' }}>
        <Figure shapes={FRONT_SHAPES} primary={prim} secondary={sec} label="Front" height={height} />
        <Figure shapes={BACK_SHAPES} primary={prim} secondary={sec} label="Back" height={height} />
      </div>
      {showLegend && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', fontSize: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_PRIMARY, display: 'inline-block' }} />
            Primary muscles
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_SECONDARY, display: 'inline-block' }} />
            Secondary muscles
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_INACTIVE, display: 'inline-block' }} />
            Not targeted
          </span>
        </div>
      )}
    </div>
  );
}
