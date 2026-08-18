import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { animeApi } from '../api/anime.js';
import { ApiError } from '../api/client.js';
import type { NormalizedAnime } from '../types/dto.js';

export function PickPage() {
    const [item, setItem] = useState<NormalizedAnime | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    function load() {
        setBusy(true);
        setErr(null);
        animeApi.pick(item?.id)
            .then(setItem)
            .catch((e) => setErr(e instanceof ApiError ? e.message : 'Ошибка подбора'))
            .finally(() => setBusy(false));
    }

    useEffect(load, []);

    return (
        <div className="pick">
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
                            <Link className="btn-ghost" to={`/anime/${item.id}`}>Открыть тайтл</Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}