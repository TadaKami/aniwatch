import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { watchlistApi } from '../api/watchlist';
import { useAuth } from '../context/AuthContext';
import type { WatchlistItem, WatchStatus } from '../types/dto';

const GROUPS: { status: WatchStatus; label: string }[] = [
    { status: 'WATCHING', label: 'Смотрю' },
    { status: 'WANT_TO_WATCH', label: 'Буду смотреть' },
    { status: 'WATCHED', label: 'Просмотрено' },
    { status: 'DROPPED', label: 'Брошено' },
];

const STATUS_LABELS: Record<WatchStatus, string> = Object.fromEntries(
    GROUPS.map((g) => [g.status, g.label])
) as Record<WatchStatus, string>;

export function WatchlistPage(){
    const { user } = useAuth();
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!user) return;
        watchlistApi.list().then(setItems).finally(() => setLoaded(true));
    }, [user]);
    
    if (!user) return <div className="empty">Войдите, чтобы увидеть свои списки.</div>;

    async function change(it: WatchlistItem, s: WatchStatus) {
        await watchlistApi.update(it.id, s);
        setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, status: s } : p)));
    }

    async function remove(it: WatchlistItem) {
        await watchlistApi.remove(it.id);
        setItems((prev) =>prev.filter((p)=> p.id !== it.id));
    }

    return (
        <div className="watchlist">
            {GROUPS.map((g) => {
                const group = items.filter((i) => i.status === g.status);
                if (group.length === 0) return null;
                return (
                    <section key={g.status} className="watchlist__group">
                        <h3>{g.label} · {group.length}</h3>
                        <div className="anime-grid">
                            {group.map((it) => (
                                <div key={it.id} className="anime-card card">
                                    <Link to={it.anime.source === 'tmdb' ? `/title/tmdb/${it.anime.shikimoriId}?type=${it.anime.contentType}` : `/anime/${it.anime.shikimoriId}`}>
                                        {it.anime.coverImage && (
                                            <img className="anime-card__cover" src={it.anime.coverImage} alt="" />
                                        )}
                                        <div className="anime-card__title">{it.anime.russian ?? it.anime.name}</div>
                                    </Link>
                                    <div className="anime-card__add">
                                        <select value={it.status} onChange={(e) => change(it, e.target.value as WatchStatus)}>
                                            {(Object.keys(STATUS_LABELS) as WatchStatus[]).map((s) => (
                                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                            ))}
                                        </select>
                                        <button className="btn-ghost" onClick={() => remove(it)}>✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                );
            })}
            {loaded && items.length === 0 && (
                <div className="empty">Списки пусты — найдите аниме в <Link to="/search">поиске</Link>.</div>
            )}
        </div>
    );
}