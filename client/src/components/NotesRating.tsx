import { useState } from 'react';
import { watchlistApi } from '../api/watchlist';

function ratingLabel(n: number): string {
    if (n <= 3) return 'так себе';
    if (n <= 5) return 'ну такое';
    if (n <= 7) return 'нормально';
    if (n <= 8) return 'хорошо';
    if (n <= 9) return 'отлично';
    return 'шедевр!';
}

export function NotesRating({ watchItem }: { watchItem: { id: string; note: string | null; rating: number | null } }) {
    const [note, setNote] = useState(watchItem.note ?? '');
    const [rating, setRating] = useState<number | null>(watchItem.rating ?? null);
    const [msg, setMsg] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    async function save() {
        setMsg(null);
        setSaving(true);
        try {
            await watchlistApi.update(watchItem.id, { note, rating });
            setMsg('Сохранено ✓');
        } catch {
            setMsg('Не удалось сохранить');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="card notes">
            <h3>Моя заметка и оценка</h3>

            <div className="notes__block">
                <span className="notes__label">Ваша оценка</span>
                <div className="rating-picker">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button
                            key={n}
                            type="button"
                            className={
                                'rating-btn' +
                                (rating != null && n <= rating ? ' rating-btn--fill' : '') +
                                (rating === n ? ' rating-btn--active' : '')
                            }
                            onClick={() => setRating(rating === n ? null : n)}
                        >
                            {n}
                        </button>
                    ))}
                </div>
                {rating != null && <span className="notes__rating-hint">★ {rating}/10 — {ratingLabel(rating)}</span>}
            </div>

            <div className="notes__block">
                <span className="notes__label">Заметка</span>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Впечатления, любимые моменты, почему стоит досмотреть…"
                />
            </div>

            <div className="notes__actions">
                <button className="btn-accent" onClick={save} disabled={saving}>
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
                {msg && <span className="profile__ok">{msg}</span>}
            </div>
        </div>
    );
}