import { useState } from 'react';
import { Icon } from '../components/Icon';
import type { Reward } from '../domain/model';
import { heroName } from '../domain/model';
import { ScreenHead } from '../components/common';
import { useStore } from '../state/store';

export function Adventure() {
  const { data, setUi, actions } = useStore();
  const gold = data.hero.gold;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const p = parseInt(price, 10);
  const invalid = !name.trim() || !(p > 0);
  const cancel = () => { setAdding(false); setName(''); setPrice(''); };
  const save = () => { if (invalid) return; actions.addReward(name.trim(), p); cancel(); };

  return (
    <div className="screen screen-narrow" style={{ gap: 20 }}>
      <ScreenHead kicker="Spend what you've earned" title="Adventure">
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', border: '1px solid var(--color-accent-500)', borderRadius: 'var(--radius-md)', color: 'var(--color-accent-700)' }} aria-label={gold + ' gold'}>
          <Icon n="coins" size={17} /><span className="heading tnum" style={{ fontSize: 20, color: 'var(--q-ink)' }}>{gold}</span>
        </span>
      </ScreenHead>

      <section className="panel-framed" style={{ display: 'flex', flexDirection: 'column', padding: '18px 18px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12 }}>
          <span style={{ color: 'var(--color-accent-700)' }}><Icon n="beer" size={26} /></span>
          <div><h2 style={{ fontSize: 28 }}>The Tavern</h2><p className="muted" style={{ margin: 0, fontSize: 13 }}>Rewards you set for yourself, paid for in quest gold.</p></div>
        </div>
        {!data.rewards.length && (
          <p className="muted" style={{ margin: 0, padding: '12px 0', borderTop: '1px solid var(--q-rule)', fontStyle: 'italic', fontSize: 14 }}>
            No rewards yet. Add treats you'd like to earn, like an evening of gaming or a new book, and give each a price in gold.
          </p>
        )}
        {data.rewards.map((r) => <RewardRow key={r.id} r={r} gold={gold} onBuy={() => setUi({ buyId: r.id })} />)}
        {!adding ? (
          <button className="dashed-btn" onClick={() => setAdding(true)} style={{ gap: 8, minHeight: 50, margin: '6px 0 10px', fontSize: 17 }}><Icon n="plus" size={17} />Add reward</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0 12px', borderTop: '1px solid var(--q-rule)' }}>
            <div className="field"><label htmlFor="rw-name">Reward</label><input id="rw-name" className="input" placeholder="e.g. Afternoon at the sauna" value={name} onChange={(e) => setName(e.target.value)} autoFocus style={{ minHeight: 44 }} /></div>
            <div className="field"><label htmlFor="rw-price">Price in gold</label><input id="rw-price" className="input tnum" type="number" min={1} inputMode="numeric" placeholder="200" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} style={{ minHeight: 44 }} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={cancel} style={{ minHeight: 42 }}>Cancel</button>
              <button className="btn btn-primary inked" onClick={save} disabled={invalid} style={{ minHeight: 42 }}>Add to Tavern</button>
            </div>
          </div>
        )}
      </section>

      <section className="locked">
        <span style={{ width: 48, height: 48, flex: 'none', display: 'grid', placeItems: 'center', border: '1px solid var(--q-rule)', borderRadius: '50%', color: 'var(--color-accent-700)' }}><Icon n="mountain" size={22} /></span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kicker" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon n="lock" size={12} />Coming later</span>
          <h3 style={{ fontSize: 24 }}>Expeditions</h3>
          <p className="muted" style={{ margin: 0, fontSize: 14, textWrap: 'pretty' }}>Send {heroName(data.hero)} on a timed journey. They return with loot and a story.</p>
        </div>
      </section>
    </div>
  );
}

function RewardRow({ r, gold, onBuy }: { r: Reward; gold: number; onBuy: () => void }) {
  const { actions } = useStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(r.title);
  const [price, setPrice] = useState(String(r.price));
  const p = parseInt(price, 10);
  const invalid = !title.trim() || !(p > 0);
  const short = r.price > gold;
  const save = () => { if (invalid) return; actions.updateReward(r.id, { title: title.trim(), price: p }); setEditing(false); };
  const remove = () => actions.confirm({
    title: 'Remove “' + r.title + '”?', body: 'It leaves the Tavern. Gold you already spent on it is not returned.', confirmLabel: 'Remove reward',
    onConfirm: () => actions.deleteReward(r.id),
  });
  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0', borderTop: '1px solid var(--q-rule)' }}>
        <div className="two-col" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="field"><label htmlFor={'rw-t-' + r.id}>Reward</label><input id={'rw-t-' + r.id} className="input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ minHeight: 44 }} /></div>
          <div className="field"><label htmlFor={'rw-p-' + r.id}>Price</label><input id={'rw-p-' + r.id} className="input tnum" type="number" min={1} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} style={{ minHeight: 44 }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="danger-btn" onClick={remove}>Remove</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={() => { setEditing(false); setTitle(r.title); setPrice(String(r.price)); }} style={{ minHeight: 42 }}>Cancel</button>
          <button className="btn btn-primary inked" onClick={save} disabled={invalid} style={{ minHeight: 42 }}>Save</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 64, padding: '10px 0', borderTop: '1px solid var(--q-rule)' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span className="heading" style={{ fontSize: 19, lineHeight: 1.2 }}>{r.title}</span>
        <span className="muted tnum" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
          <Icon n="coins" size={13} />{r.price} gold
          {short && <span style={{ fontStyle: 'italic', color: 'var(--color-accent-700)' }}>· need {r.price - gold} more</span>}
        </span>
      </div>
      <button className="icon-btn" onClick={() => setEditing(true)} aria-label={'Edit ' + r.title}><Icon n="pencil" size={15} /></button>
      <button className="btn btn-primary" onClick={onBuy} disabled={short} style={{ minHeight: 42, minWidth: 72, color: 'var(--color-accent-700)', borderColor: 'var(--color-accent-600)' }}>Buy</button>
    </div>
  );
}
