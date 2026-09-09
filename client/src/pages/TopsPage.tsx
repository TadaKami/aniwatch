import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { topsApi } from '../api/tops';
import { watchlistApi } from '../api/watchlist';
import { useAuth } from '../context/AuthContext';
import type { TopDto, WatchlistItem } from '../types/dto';

const CT_LABELS: Record<string, string> = { any: 'Все', anime: 'Аниме', tv: 'Сериалы', movie: 'Фильмы' };

export function TopsPage() {
    const { user } = useAuth();
    const [tops, setTops] = useState<TopDto[] | null>(null);
    const [list, setList] = useState<WatchlistItem[]>([]);
    const [name, setName] = useState('');
    const [contentType, setContentType] = useState<'any' | 'anime' | 'tv' | 'movie'>('any');

    const reload = useCallback(() => { topsApi.list().then(setTops).catch(() => setTops([])); }, []);

    useEffect(() => {
        if (!user) return;
        reload();
        watchlistApi.list().then(setList).catch(() => setList([]));
    }, [user, reload]);

    if (!user) return <div className="empty">Войдите, чтобы создавать топы.</div>;

    async function create() {
        if (!name.trim()) return;
        await topsApi.create({ name: name.trim(), contentType });
        setName('');
        reload();
    }

    async function move(top: TopDto, idx: number, dir: -1 | 1) {
        const ids = top.items.map((i) => i.animeId);
        const j = idx + dir;
        if (j < 0 || j >= ids.length) return;
        [ids[idx], ids[j]] = [ids[j], ids[idx]];
        await topsApi.reorder(top.id, ids);
        reload();
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
                    <button className="btn-accent" onClick={create}>Создать</button>
                </div>
            </div>

            {tops === null && <div className="empty">Загружаем…</div>}
            {tops !== null && tops.length === 0 && <div className="empty">Пока нет топов — создайте первый.</div>}

            {tops?.map((top) => {
                const inTop = new Set(top.items.map((i) => i.animeId));
                const candidates = list.filter((w) =>
                    (top.contentType === 'any' || w.anime.contentType === top.contentType) && !inTop.has(w.anime.id));
                return (
                    <div key={top.id} className="card top-card">
                        <div className="detail__actions">
                            <h3>{top.name} · {CT_LABELS[top.contentType] ?? top.contentType}</h3>
                            <button className="btn-ghost" onClick={async () => { await topsApi.remove(top.id); reload(); }}>✕ Удалить топ</button>
                        </div>
                        {top.items.length === 0 && <div className="empty">Топ пуст — добавьте тайтлы ниже.</div>}
                        {top.items.map((it, idx) => (
                            <div key={it.id} className="top-item">
                                <span className="top-item__pos">{idx + 1}</span>
                                {it.coverImage && <img className="top-item__cover" src={it.coverImage} alt="" />}
                                <Link className="top-item__title"
                                    to={it.source === 'tmdb' ? `/title/tmdb/${it.shikimoriId}?type=${it.contentType}` : `/anime/${it.shikimoriId}`}>
                                    {it.russian ?? it.name}
                                </Link>
                                <div className="top-item__btns">
                                    <button className="btn-ghost" disabled={idx === 0} onClick={() => move(top, idx, -1)}>▲</button>
                                    <button className="btn-ghost" disabled={idx === top.items.length - 1} onClick={() => move(top, idx, 1)}>▼</button>
                                    <button className="btn-ghost" onClick={async () => { await topsApi.removeItem(top.id, it.animeId); reload(); }}>✕</button>
                                </div>
                            </div>
                        ))}
                        {candidates.length > 0 && (
                            <div className="detail__actions">
                                <select id={`add-${top.id}`}>
                                    {candidates.map((w) => <option key={w.id} value={w.anime.id}>{w.anime.russian ?? w.anime.name}</option>)}
                                </select>
                                <button className="btn-accent" onClick={async () => {
                                    const sel = document.getElementById(`add-${top.id}`) as HTMLSelectElement | null;
                                    if (sel?.value) { await topsApi.addItem(top.id, sel.value); reload(); }
                                }}>Добавить</button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}