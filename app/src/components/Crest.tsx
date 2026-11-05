import { useId } from 'react';
import { ICON_PATHS, type IconName } from './Icon';
import { rng } from '../domain/guild/rng';

// Heraldry drawn from a seed: a shield, two tinctures, a division and a charge.
const METALS = ['#e8d49a', '#e3e6e8'];
const COLOURS = ['#8e2f2c', '#2e4c7d', '#2f5e3b', '#5c3b70', '#2b2724', '#9a5a1e'];
const CHARGES: IconName[] = ['crown', 'star', 'sword', 'shield', 'tree', 'flame', 'feather', 'mountain', 'moon', 'sun', 'heart', 'compass', 'fish', 'trophy'];
const DIVISIONS = ['plain', 'pale', 'fess', 'bend', 'quarterly', 'chevron', 'chief'] as const;
const SHIELD = 'M4 4H44V25C44 39 34.5 48.5 24 53C13.5 48.5 4 39 4 25Z';

export function Crest({ seed, size = 40, charge, title }: { seed: number; size?: number; charge?: IconName; title?: string }) {
  const id = useId().replace(/:/g, '');
  const r = rng(seed);
  const metalFirst = r.chance(0.5);
  const metal = r.pick(METALS), colour = r.pick(COLOURS);
  const field = metalFirst ? metal : colour, other = metalFirst ? colour : metal;
  const division = r.pick(DIVISIONS);
  const icon = charge ?? r.pick(CHARGES);
  // The charge sits on the field's colour, so it takes the other tincture, outlined for contrast.
  const ink = division === 'plain' || division === 'chief' ? other : metal === field ? colour : metal;
  return (
    <svg width={size} height={size * 56 / 48} viewBox="0 0 48 56" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ display: 'block', flex: 'none' }}>
      <defs><clipPath id={'c' + id}><path d={SHIELD} /></clipPath></defs>
      <g clipPath={'url(#c' + id + ')'}>
        <rect width="48" height="56" fill={field} />
        {division === 'pale' && <rect x="24" width="24" height="56" fill={other} />}
        {division === 'fess' && <rect y="28" width="48" height="28" fill={other} />}
        {division === 'bend' && <path d="M0 0L48 56H0Z" fill={other} />}
        {division === 'quarterly' && <><rect x="24" width="24" height="28" fill={other} /><rect y="28" width="24" height="28" fill={other} /></>}
        {division === 'chevron' && <path d="M0 56L24 26L48 56Z" fill={other} />}
        {division === 'chief' && <rect width="48" height="14" fill={other} />}
      </g>
      {division !== 'plain' && division !== 'chief' && <circle cx="24" cy="27" r="12.5" fill={field === metal ? colour : metal} opacity=".95" />}
      <g transform="translate(13 16) scale(.92)" fill="none" stroke={division !== 'plain' && division !== 'chief' ? (field === metal ? metal : colour) : ink}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[icon] }} />
      <path d={SHIELD} fill="none" stroke="#3a2a1a" strokeOpacity=".55" strokeWidth="1.6" />
    </svg>
  );
}
