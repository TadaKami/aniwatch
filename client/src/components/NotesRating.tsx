import { useState } from 'react';
import { watchlistApi } from '../api/watchlist';

export function NotesRating({ watchItem }: { watchItem: { id: string; note: string | null; rating: number | null } }) {
    const [note, setNote] = useState(watchItem.note ?? '');
    const [rating, setRating] = useState<number | null>(watchItem.rating ?? null);
    const [msg, setMsg] = useState<string | null>(null);

    async function save() {
        setMsg(null);
        try {
            await watchlistApi.update(watchItem.id, { note, rating });
            setMsg('Сохранено ✓');
        } catch {
            setMsg('Не удалось сохранить');
        }
    }

    return (
        <div className="card notes">
            <h3>Моя заметка и оценка</h3>
            <label>Ваша оценка
                <select value={rating ?? ''} onChange={(e) => setRating(e.target.value === '' ? null : Number(e.target.value))}>
                    <option value="">—</option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ваши заметки к тайтлу…" />
            <div className="detail__actions">
                <button className="btn-accent" onClick={save}>Сохранить</button>
                {msg && <span className="profile__ok">{msg}</span>}
            </div>
        </div>
    );
}