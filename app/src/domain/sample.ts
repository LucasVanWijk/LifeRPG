import { addDays, dayDiff, MONL, parseDay, shortDate } from './dates';
import type { Data, Quest } from './model';
import { newExpedition } from './expedition/engine';

/** The day the sample data was written against; every sample date is shifted so it stays relative to today. */
const BASE = '2026-09-25';

const splitNotes = (s: string) => s.split(/(?<=\.)\s+/).filter(Boolean).map((t, i) => ({ id: i + 1, t }));

/** Sample log used by the tests (the data from the design prototype). The app itself starts empty. */
export function sampleData(today: string): Data {
  const shift = dayDiff(today, BASE);
  const d = (iso: string) => addDays(iso, shift);
  const mmdd = (iso: string) => d(iso).slice(5);
  const longDay = (iso: string) => { const x = parseDay(d(iso)); return x.getDate() + ' ' + MONL[x.getMonth()].slice(0, 3) + ' ' + x.getFullYear(); };
  const tripStart = parseDay(d('2026-10-12')), tripEnd = parseDay(d('2026-10-22'));
  const tripRange = tripStart.getMonth() === tripEnd.getMonth()
    ? tripStart.getDate() + '–' + tripEnd.getDate() + ' ' + MONL[tripEnd.getMonth()]
    : shortDate(d('2026-10-12')) + ' – ' + shortDate(d('2026-10-22'));

  const q = (id: number, title: string, quad: Quest['quad'], due: string | null, size: Quest['size'], campaign: string | null, status: Quest['status'], notes = ''): Quest =>
    ({ id, title, quad, due: due ? d(due) : null, size, campaign, status, notes: splitNotes(notes), steps: [], companions: [] });

  return {
    version: 2,
    hero: { name: 'Rowan', xp: 340, level: 7, next: 500, gold: 425, points: 340 },
    quests: [
      q(1, 'Renew passport', 'crisis', '2026-09-25', 'M', 'ireland', 'doing', 'Current one expires in November. Bring two photos and the old passport to the town hall.'),
      q(2, 'Book dentist appointment', 'errand', '2026-09-23', 'S', null, 'todo', 'Six-month check-up. Number is in the Codex.'),
      q(4, 'Plan Ireland itinerary', 'main', '2026-10-02', 'L', 'ireland', 'doing', 'Galway, Connemara, Dingle. Check ferry times to the Aran Islands. Sophie wants to see the Cliffs of Moher.'),
      q(5, 'Clean out garage', 'side', '2026-10-04', 'L', null, 'todo'),
      q(7, 'Book rental car in Shannon', 'crisis', '2026-09-27', 'M', 'ireland', 'todo'),
      q(8, 'Pay car insurance', 'crisis', '2026-09-25', 'S', null, 'todo'),
      q(9, 'Pick paint colour', 'main', '2026-09-28', 'M', 'study', 'todo'),
      q(10, 'Order bookshelf', 'errand', '2026-09-30', 'M', 'study', 'todo'),
      q(11, 'Sand the walls', 'main', null, 'L', 'study', 'doing'),
      q(12, 'Sort old photos', 'side', null, 'S', null, 'todo'),
      q(13, 'Buy rain jacket', 'side', '2026-10-08', 'S', 'ireland', 'todo'),
      q(14, 'Download offline maps', 'side', '2026-10-10', 'S', 'ireland', 'todo'),
      q(15, 'Install desk lamp', 'side', null, 'S', 'study', 'todo'),
      q(16, 'Request time off', 'crisis', null, 'S', 'ireland', 'done'),
      q(17, 'Book flights to Shannon', 'crisis', null, 'M', 'ireland', 'done'),
      q(18, 'Buy travel adapter', 'errand', null, 'S', 'ireland', 'done'),
      q(19, 'Choose B&B in Galway', 'main', null, 'M', 'ireland', 'done'),
      q(20, 'Empty the study', 'main', null, 'L', 'study', 'done'),
      q(21, 'Buy paint rollers', 'errand', null, 'S', 'study', 'done'),
    ],
    habits: [
      { id: 1, title: 'Call mom', every: 'weekly', size: 'S', created: d('2026-09-01'), log: [d('2026-09-01'), d('2026-09-10'), d('2026-09-16')] },
      { id: 2, title: 'Read before bed', every: 'daily', size: 'S', created: d('2026-09-20'), log: [d('2026-09-22'), d('2026-09-23'), d('2026-09-24')] },
    ],
    camps: {
      ireland: { name: 'Ireland trip', short: 'Ireland', desc: 'Ten days on the west coast with Sophie, ' + tripRange + '.', xp: 250, gold: 100, seal: "Wayfarer's seal", icon: 'compass' },
      study: { name: 'Renovate study', short: 'Study', desc: 'Turn the spare bedroom into a quiet place to work.', xp: 200, gold: 80, seal: "Builder's seal", icon: 'home' },
    },
    companions: [
      { id: 'sophie', name: 'Sophie de Vries', first: 'Sophie', rel: 'Best friend', bday: mmdd('2026-03-14'), notes: [
        { t: 'Going to Ireland on ' + shortDate(d('2026-10-12')), date: d('2026-10-12'), label: 'Sophie → Ireland' },
        { t: 'Allergic to nuts' }, { t: 'Likes Formula 1' }, { t: 'Wants to see the Cliffs of Moher' }] },
      { id: 'mom', name: 'Mom', first: 'Mom', rel: 'Mother', bday: mmdd('2026-09-27'), notes: [
        { t: 'Prefers a call on Sunday afternoons' }, { t: 'Loves white orchids' },
        { t: 'Knee check-up on ' + shortDate(d('2026-10-02')), date: d('2026-10-02'), label: 'Mom → knee check-up' }] },
      { id: 'tom', name: 'Tom', first: 'Tom', rel: 'Brother', bday: mmdd('2026-01-03'), notes: [
        { t: 'Housewarming on ' + shortDate(d('2026-09-26')), date: d('2026-09-26'), label: 'Tom → housewarming' },
        { t: 'Just moved to Amersfoort' }, { t: 'Vegetarian' }] },
      { id: 'daan', name: 'Daan Visser', first: 'Daan', rel: 'Colleague', bday: mmdd('2026-06-19'), notes: [
        { t: 'Running the Utrecht half marathon' }, { t: 'Two kids, Noor and Sem' }] },
    ],
    tomes: [
      { id: 'shows', name: 'Shows to watch', items: ['Severance|1', 'Shōgun', 'The Bear', 'Slow Horses', 'Blue Eye Samurai'] },
      { id: 'gifts', name: 'Gift ideas', items: ['White orchid for Mom', 'F1 Lego set for Sophie', "Board game for Tom's housewarming"] },
      { id: 'books', name: 'Books to read', items: ['Piranesi|1', 'The Name of the Wind', 'Tress of the Emerald Sea', 'A Psalm for the Wild-Built'] },
    ].map((t) => ({ ...t, items: t.items.map((s, i) => ({ id: i + 1, t: s.split('|')[0], done: s.endsWith('|1') })) })),
    codex: [
      { id: 'dentist', name: 'Dentist', sub: 'Tandartspraktijk Wittevrouwen', icon: 'pin', fields: [
        { k: 'Address', v: 'Biltstraat 112, 3572 BK Utrecht' }, { k: 'Phone', v: '030 271 44 90' }, { k: 'Hours', v: 'Mon–Fri, 08:00–17:00' }, { k: 'Dentist', v: 'Dr. M. Bakker' }] },
      { id: 'car', name: 'Car', sub: 'Volkswagen Golf, grey', icon: 'car', fields: [
        { k: 'License plate', v: 'K-482-RD' }, { k: 'APK date', v: longDay('2026-09-29'), date: d('2026-09-29'), label: 'Car → APK' },
        { k: 'Insurance', v: 'Policy 88-1204-7' }, { k: 'Tyre pressure', v: '2.3 bar front · 2.1 bar rear' }] },
      { id: 'resto', name: 'Favorite restaurant in Utrecht', sub: 'De Zilveren Lepel', icon: 'utensils', fields: [
        { k: 'Address', v: 'Oudegracht 158, Utrecht' }, { k: 'Phone', v: '030 233 10 27' }, { k: 'Always order', v: 'Mushroom risotto, then the pear tart' }, { k: 'Tip', v: 'Ask for a table on the wharf' }] },
      { id: 'gym', name: 'Gym', sub: 'Sportcentrum Olympos', icon: 'dumbbell', fields: [
        { k: 'Locker code', v: '4471' }, { k: 'Membership', v: 'Renews ' + longDay('2027-01-01') }] },
    ],
    expedition: newExpedition(0),
  };
}
