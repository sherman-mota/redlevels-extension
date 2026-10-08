import type { ThemeId } from '../types/redmine';

export type { ThemeId };

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  /** Swatches shown in the theme picker: [background, surface, accent]. */
  swatches: [string, string, string];
}

/** Visual tokens live in index.css (html[data-theme=...]); this is picker metadata. */
export const THEMES: Record<ThemeId, ThemeDefinition> = {
  redlevels: {
    id: 'redlevels',
    name: 'Redlevels Crimson',
    description: 'Escuro sofisticado com destaques rubi (padrão)',
    swatches: ['#020617', '#1e293b', '#e11d48'],
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Navy',
    description: 'Azul profundo com acentos índigo',
    swatches: ['#070b1f', '#1a2346', '#6366f1'],
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Aurora',
    description: 'Petróleo escuro com acentos esmeralda',
    swatches: ['#04120f', '#163029', '#10b981'],
  },
  amber: {
    id: 'amber',
    name: 'Warm Amber',
    description: 'Carvão aquecido com detalhes âmbar',
    swatches: ['#0f0c09', '#2b241d', '#f59e0b'],
  },
  light: {
    id: 'light',
    name: 'Clean Light',
    description: 'Claro, com alto contraste',
    swatches: ['#f1f5f9', '#ffffff', '#e11d48'],
  },
};

export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = THEMES[theme] ? theme : 'redlevels';
}
