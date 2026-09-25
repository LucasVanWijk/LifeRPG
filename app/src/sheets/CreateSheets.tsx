import { useState } from 'react';
import type { QuadKey, SizeKey } from '../domain/model';
import { CAMP_ICONS, campSize, CSIZE, QUADS } from '../domain/model';
import { Icon, type IconName } from '../components/Icon';
import { CloseBtn, onEnter, Seg, Sheet } from '../components/common';
import { useStore } from '../state/store';

const bigBtn = { minHeight: 50, fontSize: 18, color: 'var(--color-accent-700)', borderColor: 'var(--color-accent-600)' };

export function NewQuestSheet() {
  const { data, setUi, actions } = useStore();
  const [title, setTitle] = useState('');
  const [quad, setQuad] = useState<QuadKey>('side');
  const [due, setDue] = useState('');
  const [campaign, setCampaign] = useState('');
  const close = () => setUi({ newOpen: false });
  const create = () => {
    const t = title.trim();
    if (!t) return;
    actions.createQuest({ title: t, quad, due: due || null, campaign: campaign || null });
    close();
  };
  return (
    <Sheet onClose={close} label="New Quest">
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 6 }}><h3 style={{ fontSize: 26 }}>New Quest</h3><span style={{ marginLeft: 'auto' }}><CloseBtn onClick={close} /></span></div>
      <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={onEnter(create)} placeholder="What needs doing?" aria-label="Title" autoFocus />
      <p className="muted" style={{ margin: '-4px 0 0', fontSize: 12 }}>Only a title is needed. It goes to Side Quests unless you pick a zone.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {QUADS.map((z) => (
          <button key={z.key} className="chip" aria-pressed={quad === z.key} onClick={() => setQuad(z.key)} style={{ minHeight: 40, padding: '6px 11px', fontSize: 15 }}>
            <span style={{ color: z.color }}><Icon n={z.icon} size={14} /></span>{z.name}
          </button>
        ))}
      </div>
      <div className="two-col">
        <div className="field"><label htmlFor="nq-due">Due date</label><input id="nq-due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ minHeight: 44 }} /></div>
        <div className="field"><label htmlFor="nq-camp">Campaign</label>
          <select id="nq-camp" className="input" value={campaign} onChange={(e) => setCampaign(e.target.value)} style={{ minHeight: 44 }}>
            <option value="">None</option>
            {Object.entries(data.camps).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <button className="btn btn-primary" onClick={create} disabled={!title.trim()} style={bigBtn}>Pin to the board</button>
    </Sheet>
  );
}

/** New Campaign, or editing an existing one when `campKey` is given. */
export function CampaignSheet({ campKey }: { campKey: string | null }) {
  const { data, setUi, actions } = useStore();
  const existing = campKey ? data.camps[campKey] : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [desc, setDesc] = useState(existing?.desc ?? '');
  const [seal, setSeal] = useState(existing?.seal ?? '');
  const [icon, setIcon] = useState<IconName>(existing?.icon ?? 'flag');
  const [size, setSize] = useState<SizeKey>(existing ? campSize(existing) : 'M');
  const close = () => setUi({ campSheet: null });
  const title = existing ? 'Edit Campaign' : 'New Campaign';
  const save = () => {
    const n = name.trim();
    if (!n) return;
    const sz = CSIZE[size];
    const c = { name: n, short: n.split(' ')[0], desc: desc.trim() || 'A new campaign.', xp: sz.xp, gold: sz.gold, seal: seal.trim() || n + ' seal', icon };
    if (campKey && existing) {
      // A campaign already won keeps the reward it paid.
      actions.updateCampaign(campKey, existing.completedOn ? { ...c, xp: existing.xp, gold: existing.gold } : c);
      close();
    } else actions.createCampaign(c);
  };
  const remove = () => campKey && actions.confirm({
    title: 'Delete this campaign?',
    body: 'Its quests stay on the board, without a campaign.' + (existing?.completedOn ? ' The seal and reward you earned are kept.' : ''),
    confirmLabel: 'Delete campaign',
    onConfirm: () => actions.deleteCampaign(campKey),
  });
  return (
    <Sheet onClose={close} label={title}>
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 6 }}><h3 style={{ fontSize: 26 }}>{title}</h3><span style={{ marginLeft: 'auto' }}><CloseBtn onClick={close} /></span></div>
      <input className="title-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name your campaign" aria-label="Campaign name" autoFocus={!existing} />
      <div className="field"><label htmlFor="nc-goal">Goal</label><textarea id="nc-goal" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What does done look like?" style={{ minHeight: 70, fontSize: 14 }} /></div>
      <div className="field"><label>Seal</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {CAMP_ICONS.map((ic) => {
            const on = icon === ic;
            return (
              <button key={ic} onClick={() => setIcon(ic)} aria-label={ic} aria-pressed={on}
                style={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', border: '1.5px solid ' + (on ? 'var(--q-wax)' : 'var(--q-rule)'), background: on ? 'radial-gradient(circle at 35% 30%, var(--q-wax-hi), var(--q-wax) 62%)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-accent-800)' }}>
                <Icon n={ic} size={20} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="field"><label htmlFor="nc-seal">Reward title</label><input id="nc-seal" className="input" value={seal} onChange={(e) => setSeal(e.target.value)} placeholder="e.g. Explorer's seal" style={{ minHeight: 44 }} /></div>
      {!existing?.completedOn && (
        <div className="field"><label>Size</label>
          <Seg name="nc-size" value={size} onChange={setSize} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', width: '100%' }}
            optStyle={{ justifyContent: 'center', flexDirection: 'column', gap: 0, minHeight: 50, padding: '6px 4px' }}
            options={(['S', 'M', 'L'] as const).map((k) => ({ key: k, label: <><span>{CSIZE[k].name}</span><span className="muted tnum" style={{ fontSize: 11 }}>+{CSIZE[k].xp} XP · +{CSIZE[k].gold}g</span></> }))} />
        </div>
      )}
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        {existing?.completedOn ? 'This campaign is complete; its reward was paid.' : "The reward is paid once every quest in the campaign is done. Add quests from the New Quest sheet or a quest's edit screen."}
      </p>
      <button className="btn btn-primary" onClick={save} disabled={!name.trim()} style={bigBtn}>{existing ? 'Save changes' : 'Begin campaign'}</button>
      {existing && <button className="danger-btn" onClick={remove}><Icon n="x" size={15} />Delete campaign</button>}
    </Sheet>
  );
}
