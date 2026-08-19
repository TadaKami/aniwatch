import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { animeApi } from '../api/anime.js';
import { ApiError } from '../api/client.js';
import { tmdbApi } from '../api/tmdb.js';
import type { NormalizedAnime } from '../types/dto.js';

const TYPES = [
    { id: 'anime', label: 'Аниме' },
    { id: 'tv', label: 'Сериалы и дорамы' },
    { id: 'movie', label: 'Фильмы' },
] as const;
type PickType = (typeof TYPES)[number]['id'];

export function PickPage() {
    const [params, setParams] = useSearchParams();
    const rawType = params.get('type') ?? '';
    const type: PickType = rawType === 'tv' || rawType === 'movie' ? rawType : 'anime';

    const [item, setItem] = useState<NormalizedAnime | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    function load() {
        setBusy(true);
        setErr(null);
        const req = type === 'anime' ? animeApi.pick() : tmdbApi.pick(type);
        req.then(setItem)
            .catch((e) => setErr(e instanceof ApiError ? e.message : 'Ошибка подбора'))
            .finally(() => setBusy(false));
    }

    useEffect(load, [type]);

    return (
        <div className="pick">
            <div className="src-tabs">
                {TYPES.map((t) => (
                    <button
                        key={t.id}
                        className={'genre-chip' + (type === t.id ? ' genre-chip--active' : '')}
                        onClick={() => {
                            const next = new URLSearchParams(params);
                            if (t.id === 'anime') next.delete('type');
                            else next.set('type', t.id);
                            setParams(next);
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <h2>Что посмотреть</h2>
            <p className="pick__hint">Случайный тайтл из топа рейтинга, которого нет в ваших списках.</p>
            {err && <div className="form-error">{err}</div>}
            {busy && <div className="empty">Подбираем…</div>}
            {item && !busy && (
                <div className="pick__card card">
                    <img className="pick__cover" src={item.image.preview} alt="" />
                    <div className="pick__info">
                        <h3>{item.russian ?? item.name}</h3>
                        <div className="anime-card__meta">
                            {item.kind ?? '—'} · {item.episodes ?? '?'} эп. · ★{item.score ?? '—'}
                        </div>
                        <div className="anime-card__genres">
                            {item.genres.slice(0, 4).map((g) => (
                                <span key={g.id} className="genre-chip">{g.russian ?? g.name}</span>
                            ))}
                        </div>
                        {item.description && <p className="pick__desc">{item.description.slice(0, 300)}…</p>}
                        <div className="pick__actions">
                            <button className="btn-accent" onClick={load}>🎲 Ещё вариант</button>
                            <Link
                                className="btn-ghost"
                                to={item.source === 'tmdb' ? `/title/tmdb/${item.id}?type=${item.contentType}` : `/anime/${item.id}`}
                            >
                                Открыть тайтл
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}