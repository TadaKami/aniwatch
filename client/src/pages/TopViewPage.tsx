import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { topsApi } from '../api/tops';
import { useAuth } from '../context/AuthContext';
import type { TopDto } from '../types/dto';

const CT_LABELS: Record<string, string> = { any: 'Все', anime: 'Аниме', tv: 'Сериалы', movie: 'Фильмы' };

export function TopViewPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [top, setTop] = useState<TopDto | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (id) topsApi.get(id).then(setTop).catch((e) => setErr(e instanceof ApiError ? e.message : 'Ошибка'));
    }, [id]);

    if (err) return <div className="form-error">{err}</div>;
    if (!top) return <div className="empty">Загружаем…</div>;
    const isOwner = user?.id === top.userId;

    return (
        <div className="tops">
            <div className="card">
                <div className="top-card__head">
                    <h2>{top.name}</h2>
                    <span className="anime-card__meta">{CT_LABELS[top.contentType] ?? top.contentType}</span>
                </div>
                <div className="anime-card__meta">автор: {top.ownerName}</div>
                {top.description && <p className="top-card__desc">{top.description}</p>}
                {isOwner && (
                    <div className="detail__actions">
                        <button className="btn-ghost" onClick={async () => { await topsApi.remove(top.id); location.href = '/tops'; }}>✕ Удалить топ</button>
                    </div>
                )}
            </div>

            {top.items.length === 0 && <div className="empty">Топ пуст.</div>}
            <div className="anime-grid">
                {top.items.map((it) => (
                    <div key={it.id} className="anime-card card">
                        <Link to={it.source === 'tmdb' ? `/title/tmdb/${it.shikimoriId}?type=${it.contentType}` : `/anime/${it.shikimoriId}`}>
                            <div className="anime-card__poster">
                                {it.coverImage && <img src={it.coverImage} alt="" />}
                                <span className="top-item__pos">#{it.position}</span>
                            </div>
                            <div className="anime-card__title">{it.russian ?? it.name}</div>
                        </Link>
                        <div className="anime-card__meta">оценка автора: ★{it.ownerRating ?? '—'}</div>
                        {it.comment && <p className="top-card__desc">{it.comment}</p>}
                        {isOwner && (
                            <button className="btn-ghost" onClick={async () => { await topsApi.removeItem(top.id, it.animeId); setTop((t) => t && ({ ...t, items: t.items.filter((x) => x.id !== it.id) })); }}>✕</button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}