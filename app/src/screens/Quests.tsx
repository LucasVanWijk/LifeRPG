import { useRef, type CSSProperties, type DragEvent } from 'react';
import type { QuadKey, Quest, Status } from '../domain/model';
import { noteRotation, QUADS, SIZE, STATUSES } from '../domain/model';
import { Icon } from '../components/Icon';
import { byDue, questView, ScreenHead, Seg } from '../components/common';
import { useStore } from '../state/store';

export function Quests() {
  const { data, ui, setUi, isDesk } = useStore();
  const activeCount = data.quests.filter((q) => q.status !== 'done').length;
  return (
    <div className="screen" style={{ flex: 1, gap: 14 }}>
      <ScreenHead kicker={activeCount + ' open quests'} title="Quests">
        <Seg name="quest-view" value={ui.questView} onChange={(v) => setUi({ questView: v, mobileZone: null })}
          optStyle={{ minHeight: 40, padding: '8px 16px', fontSize: 14 }}
          options={[{ key: 'board', label: 'Quest Board' }, { key: 'campaign', label: 'Campaigns' }]} />
      </ScreenHead>
      {ui.questView === 'campaign' ? <CampaignView /> : isDesk ? <DeskBoard /> : ui.mobileZone ? <MobileZone zone={ui.mobileZone} /> : <MobileGrid />}
    </div>
  );
}

function useDrag() {
  const { ui, setUi } = useStore();
  return {
    dragId: ui.dragId,
    start: (e: DragEvent, id: number) => {
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(id)); } catch { /* older engines */ }
      setUi({ dragId: id });
    },
    end: () => setUi({ dragId: null, dragOver: null }),
    over: (e: DragEvent, key: string) => { e.preventDefault(); if (ui.dragOver !== key) setUi({ dragOver: key }); },
  };
}

const zoneStyle = (light: string) => ({ '--zone-light': light }) as CSSProperties;
const activeIn = (quests: Quest[], quad: QuadKey) => quests.filter((q) => q.status !== 'done' && q.quad === quad).sort(byDue);

function DeskBoard() {
  const { data, ui, setUi, today, actions } = useStore();
  const drag = useDrag();
  const drop = (e: DragEvent, key: QuadKey) => {
    e.preventDefault();
    if (ui.dragId) actions.updateQuest(ui.dragId, { quad: key });
    setUi({ dragId: null, dragOver: null });
  };
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '26px minmax(0,1fr) minmax(0,1fr)' }}>
        <span />
        <span className="axis" style={{ paddingBottom: 6 }}>Urgent</span>
        <span className="axis" style={{ paddingBottom: 6 }}>Not urgent</span>
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr' }}>
          <span className="axis axis-v">Important</span>
          <span className="axis axis-v">Not important</span>
        </div>
        <div className="wood" style={{ gridColumn: '2 / 4', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, padding: 14 }}>
          {QUADS.map((z) => {
            const list = activeIn(data.quests, z.key);
            return (
              <div key={z.key} className={'zone' + (z.key === 'main' ? ' is-main' : '') + (ui.dragOver === z.key ? ' is-over' : '')} style={{ ...zoneStyle(z.light), minHeight: 250, display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 14px 18px' }}
                onDragOver={(e) => drag.over(e, z.key)} onDrop={(e) => drop(e, z.key)}>
                <div className="zone-head">
                  <Icon n={z.icon} size={18} />
                  <span className="heading" style={{ fontSize: 22 }}>{z.name}</span>
                  <span className="tnum" style={{ fontSize: 12, color: 'var(--color-accent-200)' }}>{list.length}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-accent-200)', fontStyle: 'italic' }}>{z.sub}</span>
                  {z.key === 'main' && <span className="xp-mult">×1.5 XP</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: '18px 14px', alignContent: 'start' }}>
                  {list.map((q) => {
                    const v = questView(q, today, data.camps);
                    return (
                      <div key={q.id} className="note" draggable onDragStart={(e) => drag.start(e, q.id)} onDragEnd={drag.end} onClick={() => actions.openQuest(q.id)}
                        role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && actions.openQuest(q.id)}
                        style={{ gap: 7, padding: '16px 13px 10px', transform: 'rotate(' + noteRotation(q.id) + ')', opacity: drag.dragId === q.id ? 0.35 : 1 }}>
                        <span className="pin" />
                        <div className="heading" style={{ fontSize: 18, lineHeight: 1.15, textWrap: 'pretty' }}>{q.title}</div>
                        <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, whiteSpace: 'nowrap' }}>
                          {v.hasDue && <><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: v.dueColor }}><Icon n="calendar" size={12} />{v.dueLabel}</span><span style={{ color: 'var(--color-accent-500)' }}>·</span></>}
                          <span>{SIZE[q.size].name}</span>
                        </div>
                        <div className="note-foot">
                          <span>+{v.xp} XP</span>
                          <span style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                            {v.campaignName && <span className="camp-tag"><Icon n="flag" size={10} />{v.campaignName}</span>}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }} aria-label={v.gold + ' gold'}>+{v.gold}<span style={{ color: 'var(--color-accent-600)' }}><Icon n="coins" size={12} /></span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!list.length && <p style={{ margin: 'auto 0', textAlign: 'center', fontStyle: 'italic', fontSize: 13, color: 'var(--color-accent-200)' }}>Drop a quest here</p>}
              </div>
            );
          })}
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>Drag notes between zones to re-prioritise. Main Quests earn the most XP.</p>
    </>
  );
}

function MobileGrid() {
  const { data, setUi } = useStore();
  return (
    <div className="wood" style={{ flex: 1, minHeight: 480, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gridTemplateRows: 'minmax(0,1fr) minmax(0,1fr)', gap: 9, padding: 10 }}>
      {QUADS.map((z) => {
        const list = activeIn(data.quests, z.key);
        return (
          <button key={z.key} className={'zone tile' + (z.key === 'main' ? ' is-main' : '')} style={zoneStyle(z.light)} onClick={() => setUi({ mobileZone: z.key })}>
            <span className="zone-head" style={{ gap: 5 }}>
              <Icon n={z.icon} size={14} />
              <span className="heading ellipsis" style={{ flex: 1, minWidth: 0, fontSize: 15 }}>{z.name}</span>
              <span className="heading tnum" style={{ fontSize: 19, lineHeight: 1, color: 'var(--color-accent-100)' }}>{list.length}</span>
              {z.key === 'main' && <span className="xp-mult" style={{ flex: 'none', fontSize: 10, lineHeight: 1.3, padding: '1px 4px' }}>×1.5</span>}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {list.slice(0, 6).map((q) => <span key={q.id} className="tile-note">{q.title}</span>)}
              {list.length > 6 && <span style={{ fontSize: 11, color: 'var(--color-accent-200)' }}>+{list.length - 6} more</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MobileZone({ zone }: { zone: QuadKey }) {
  const { data, setUi, today, actions } = useStore();
  const touchX = useRef(0);
  const z = QUADS.find((x) => x.key === zone)!;
  const list = activeIn(data.quests, zone);
  const step = (dir: number) => {
    const i = QUADS.findIndex((q) => q.key === zone);
    setUi({ mobileZone: QUADS[(i + dir + 4) % 4].key });
  };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="hscroll" style={{ gap: 6, margin: '0 -18px', padding: '0 18px 2px' }}>
        <button className="btn btn-secondary" onClick={() => setUi({ mobileZone: null })} style={{ flex: 'none', minHeight: 40, padding: '6px 10px' }}>
          <Icon n="chevron-left" size={16} />Board
        </button>
        {QUADS.map((c) => (
          <button key={c.key} className="chip" aria-pressed={c.key === zone} onClick={() => setUi({ mobileZone: c.key })} style={{ minHeight: 40, padding: '6px 12px', fontSize: 15 }}>
            <span className="dot" style={{ color: c.color }} />{c.name}
            <span className="tnum" style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12 }}>{activeIn(data.quests, c.key).length}</span>
          </button>
        ))}
      </div>
      <div className={'wood zone' + (zone === 'main' ? ' is-main' : '')}
        style={{ ...zoneStyle(z.light), flex: 1, display: 'flex', flexDirection: 'column', gap: 11, padding: '12px 12px 18px', minHeight: 480, borderRadius: 6, backgroundColor: 'var(--color-accent-800)', backgroundImage: 'var(--q-wood)' }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) >= 50) step(dx < 0 ? 1 : -1); }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className="zone-head">
            <Icon n={z.icon} size={18} />
            <span className="heading" style={{ fontSize: 23, whiteSpace: 'nowrap' }}>{z.name}</span>
            {zone === 'main' && <span className="xp-mult" style={{ marginLeft: 'auto' }}>×1.5 XP</span>}
          </div>
          <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--color-accent-200)' }}>{z.sub} · swipe to switch zones</span>
        </div>
        {list.map((q) => {
          const v = questView(q, today, data.camps);
          return (
            <button key={q.id} className="note" onClick={() => actions.openQuest(q.id)}
              style={{ gap: 4, padding: '12px 12px 8px', border: 0, fontFamily: 'var(--font-body)', transform: 'rotate(' + noteRotation(q.id, 0.4, 2) + ')' }}>
              <span className="pin" />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, width: '100%' }}>
                <div className="heading" style={{ flex: 1, fontSize: 17, lineHeight: 1.15 }}>{q.title}</div>
                <span className="tnum" style={{ fontSize: 12, color: 'var(--color-accent-700)', whiteSpace: 'nowrap' }}>+{v.xp} XP · +{v.gold}g</span>
              </div>
              <div className="meta" style={{ gap: '6px 10px' }}>
                {v.hasDue && <span style={{ color: v.dueColor }}><Icon n="calendar" size={12} />{v.dueLabel}</span>}
                <span>{SIZE[q.size].name}</span>
                {v.campaignName && <span style={{ gap: 4, padding: '1px 7px', border: '1px solid var(--q-rule)', borderRadius: 3 }}><Icon n="flag" size={10} />{v.campaignName}</span>}
              </div>
            </button>
          );
        })}
        {!list.length && <p style={{ margin: '40px 0', textAlign: 'center', fontStyle: 'italic', color: 'var(--color-accent-200)' }}>No quests in this zone.</p>}
      </div>
    </div>
  );
}

function CampaignView() {
  const { data, ui, setUi, isDesk, today, actions } = useStore();
  const drag = useDrag();
  const campKey = data.camps[ui.campaign] ? ui.campaign : Object.keys(data.camps)[0];
  const camp = campKey ? data.camps[campKey] : undefined;
  const cq = data.quests.filter((q) => q.campaign === campKey);
  const done = cq.filter((q) => q.status === 'done').length;
  const pct = Math.round((done / Math.max(1, cq.length)) * 100) + '%';
  const drop = (e: DragEvent, s: Status) => {
    e.preventDefault();
    const id = ui.dragId;
    setUi({ dragId: null, dragOver: null });
    if (id) actions.setStatus(id, s);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: isDesk ? 16 : 10 }}>
      <div className="hscroll" style={{ gap: 8 }}>
        {Object.entries(data.camps).map(([k, c]) => {
          const all = data.quests.filter((q) => q.campaign === k);
          return (
            <button key={k} className="chip" aria-pressed={k === campKey} onClick={() => setUi({ campaign: k })} style={{ gap: 7, minHeight: 44, padding: '6px 12px', fontSize: 16 }}>
              <Icon n="flag" size={15} />{c.name}
              <span className="muted tnum" style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12 }}>{all.filter((q) => q.status === 'done').length}/{all.length}</span>
            </button>
          );
        })}
        <button className="dashed-btn" onClick={() => setUi({ newCampOpen: true, openId: null, newOpen: false })} style={{ flex: 'none', minHeight: 44, padding: '6px 12px', fontSize: 16 }}>
          <Icon n="plus" size={15} />New campaign
        </button>
      </div>

      {camp && !isDesk && (
        <section className="panel-framed" style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '11px 13px', boxShadow: 'inset 0 0 0 3px var(--q-parch), inset 0 0 0 4px var(--q-rule)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="seal" style={{ width: 30, height: 30, boxShadow: 'inset 0 0 0 2px var(--q-wax), inset 0 0 0 3px rgba(255,230,200,.35), 0 1px 3px rgba(40,10,0,.3)' }}><Icon n={camp.icon} size={14} /></span>
            <h3 className="ellipsis" style={{ flex: 1, minWidth: 0, fontSize: 21 }}>{camp.name}</h3>
            <span className="tnum" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{done} / {cq.length}</span>
          </div>
          <div className="bar" style={{ height: 7, borderRadius: 4 }}><div style={{ width: pct, borderRadius: 2, background: 'var(--q-moss)' }} /></div>
          <div className="muted tnum ellipsis" style={{ fontSize: 12 }}>Reward: {camp.seal} · +{camp.xp} XP · +{camp.gold} gold</div>
        </section>
      )}
      {camp && isDesk && (
        <section className="panel-framed" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 28px', alignItems: 'center', padding: '18px 20px' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="kicker">Campaign</span>
            <h2 style={{ fontSize: 30 }}>{camp.name}</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>{camp.desc}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <div className="bar" style={{ flex: 1, height: 9 }}><div style={{ width: pct, background: 'var(--q-moss)' }} /></div>
              <span className="tnum" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{done} / {cq.length} quests</span>
            </div>
          </div>
          <div style={{ flex: '0 1 260px', display: 'flex', alignItems: 'center', gap: 14, paddingLeft: 18, borderLeft: '1px solid var(--q-rule)' }}>
            <span className="seal" style={{ width: 54, height: 54, boxShadow: 'inset 0 0 0 4px var(--q-wax), inset 0 0 0 5px rgba(255,230,200,.35), 0 2px 5px rgba(40,10,0,.35)' }}><Icon n={camp.icon} size={22} /></span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="label">Completion reward</span>
              <span className="heading" style={{ fontSize: 18, lineHeight: 1.15 }}>{camp.seal}</span>
              <span className="muted tnum" style={{ fontSize: 13 }}>+{camp.xp} XP · +{camp.gold} gold</span>
            </div>
          </div>
        </section>
      )}

      <div className="hscroll" style={{ flex: 1, gap: 12, scrollSnapType: 'x mandatory', margin: isDesk ? 0 : '0 -18px', padding: isDesk ? '4px 0 0' : '4px 18px 6px' }}>
        {STATUSES.map(([k, name]) => {
          const list = cq.filter((q) => q.status === k).sort(byDue);
          return (
            <div key={k} className={'col' + (ui.dragOver === 'c-' + k ? ' is-over' : '')} style={{ flex: isDesk ? '1 1 0' : '0 0 80%' }}
              onDragOver={(e) => drag.over(e, 'c-' + k)} onDrop={(e) => drop(e, k)}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 6, borderBottom: '1px solid var(--q-rule)' }}>
                <span className="heading" style={{ fontSize: 20 }}>{name}</span>
                <span className="muted tnum" style={{ fontSize: 12 }}>{list.length}</span>
              </div>
              {list.map((q) => {
                const v = questView(q, today, data.camps);
                return (
                  <div key={q.id} className="camp-card-note" draggable onDragStart={(e) => drag.start(e, q.id)} onDragEnd={drag.end} onClick={() => actions.openQuest(q.id)}
                    role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && actions.openQuest(q.id)} style={{ opacity: drag.dragId === q.id ? 0.35 : 1 }}>
                    <span className="pin" />
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div className="heading" style={{ flex: 1, fontSize: 16, lineHeight: 1.15, textDecoration: v.done ? 'line-through' : 'none', color: v.done ? 'var(--color-accent-700)' : 'var(--q-ink)' }}>{q.title}</div>
                      {v.done && <span style={{ color: 'var(--q-moss)' }}><Icon n="check" size={16} stroke={2.2} /></span>}
                    </div>
                    <div className="meta">
                      {v.hasDue && <span style={{ color: v.dueColor }}>{v.dueLabel}</span>}
                      <span style={{ gap: 4, color: v.quad.color }}><span className="dot" style={{ width: 6, height: 6 }} />{v.quad.name}</span>
                      <span>{q.size}</span>
                      <span className="tnum" style={{ marginLeft: 'auto', color: 'var(--color-accent-700)' }}>+{v.xp} XP</span>
                    </div>
                  </div>
                );
              })}
              {!list.length && <p className="muted" style={{ margin: '24px 0', textAlign: 'center', fontStyle: 'italic', fontSize: 13 }}>Nothing here yet.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
