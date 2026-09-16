import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { topsApi } from '../api/tops';
import { watchlistApi } from '../api/watchlist';
import { useAuth } from '../context/AuthContext';
import type { WatchlistItem } from '../types/dto';

const CT_LABELS: Record<string, string> = { any: 'Все', anime: 'Аниме', tv: 'Сериалы', movie: 'Фильмы' };

export function TopCreatePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [contentType, setContentType] = useState<'any' | 'anime' | 'tv' | 'movie'>('any');
    const [list, setList] = useState<WatchlistItem[]>([]);
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    const [comments, setComments] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => { watchlistApi.list().then(setList).catch(() => setList([])); }, []);
    if (!user) return <div className="empty">Войдите, чтобы создавать топы.</div>;

    const candidates = list.filter((w) =>
        w.status === 'WATCHED' && w.anime.rating != null &&
        (contentType === 'any' || w.anime.contentType === contentType));

    async function submit() {
        setBusy(true); setErr(null);
        try {
            const items = candidates
                .filter((w) => checked[w.anime.id])
                .map((w) => ({ animeId: w.anime.id, comment: comments[w.anime.id]?.trim() || null }));
            const res = await topsApi.create({ name: name.trim(), description: description.trim() || null, contentType, items });
            navigate(`/tops/${res.id}`);
        } catch (e) { setErr(e instanceof ApiError ? e.message : 'Ошибка создания'); }
        finally { setBusy(false); }
    }

    return (
        <div className="tops">
            <div className="card">
                <h3>Новый топ</h3>
                <div className="detail__actions">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название топа…" />
                    <select value={contentType} onChange={(e) => setContentType(e.target.value as typeof contentType)}>
                        {Object.entries(CT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание топа (необязательно)…" />
                <p className="anime-card__meta">Наполнять топ можно тайтлами со статусом «Просмотрено» и с вашей оценкой.</p>
                {err && <div className="form-error">{err}</div>}
                <div className="detail__actions">
                    <button className="btn-accent" disabled={busy || !name.trim()} onClick={submit}>Создать</button>
                </div>
            </div>

            {candidates.length === 0 && <div className="empty">Нет подходящих тайтлов: отметьте тайтлы как «Просмотрено» и поставьте оценку.</div>}
            <div className="anime-grid">
                {candidates.map((w) => (
                    <div key={w.anime.id} className="anime-card card">
                        <label className="top-pick">
                            <input type="checkbox" checked={!!checked[w.anime.id]}
                                onChange={(e) => setChecked((c) => ({ ...c, [w.anime.id]: e.target.checked }))} />
                            {w.anime.coverImage && <img src={w.anime.coverImage} alt="" className="top-pick__cover" />}
                            <div>
                                <div className="anime-card__title">{w.anime.russian ?? w.anime.name}</div>
                                <div className="anime-card__meta">★ {w.anime.rating}</div>
                            </div>
                        </label>
                        {checked[w.anime.id] && (
                            <input value={comments[w.anime.id] ?? ''}
                                onChange={(e) => setComments((c) => ({ ...c, [w.anime.id]: e.target.value }))}
                                placeholder="Комментарий к тайтлу…" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}