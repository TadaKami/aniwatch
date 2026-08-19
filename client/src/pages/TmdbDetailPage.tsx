import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { tmdbApi } from '../api/tmdb';
import { watchlistApi } from '../api/watchlist';
import { useAuth } from '../context/AuthContext';
import type { NormalizedAnime, WatchStatus } from '../types/dto';

const STATUS_LABELS: Record<WatchStatus, string> = {
    WANT_TO_WATCH: 'Буду смотреть',
    WATCHING: 'Смотрю',
    WATCHED: 'Просмотрено',
    DROPPED: 'Брошено',
};

export function TmdbDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const type = searchParams.get('type') === 'movie' ? ('movie' as const) : ('tv' as const);
    const navigate = useNavigate();
    const { user } = useAuth();
    const [data, setData] = useState<NormalizedAnime | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<WatchStatus>('WANT_TO_WATCH');
    const [added, setAdded] = useState(false);

    useEffect(() => {
        if (!id) return;
        tmdbApi.details(type, Number(id))
            .then(setData)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка загрузки'));
    }, [id, type]);

    async function addToList() {
        if (!data) return;
        await watchlistApi.add({
            shikimoriId: data.id,
            name: data.name,
            russian: data.russian,
            coverImage: data.image.original || data.image.preview,
            kind: data.kind,
            score: data.score,
            episodes: data.episodes,
            episodesAired: data.episodesAired,
            season: data.season,
            seasonYear: data.seasonYear,
            genres: data.genres.map((g) => g.russian ?? g.name),
            description: data.description,
            studios: data.studios,
            status,
            source: 'tmdb',
            contentType: data.contentType,
        });
        setAdded(true);
    }

    return (
        <div className="detail">
            <button className="btn-ghost" onClick={() => navigate(-1)}>← Назад</button>
            {error && <div className="form-error">{error}</div>}
            {data && (
                <div className="detail__hero card">
                    {data.image.preview && <img src={data.image.preview} alt="" className="detail__cover" />}
                    <div className="detail__info">
                        <h2>{data.russian ?? data.name}</h2>
                        <div className="detail__orig">{data.name}</div>
                        <div className="anime-card__genres">
                            {data.genres.map((g) => <span key={g.id} className="genre-chip">{g.russian ?? g.name}</span>)}
                        </div>
                        <div className="detail__meta">
                            <span>Тип: {data.contentType === 'tv' ? 'Сериал' : 'Фильм'}</span>
                            <span>Оценка: ★{data.score ?? '—'}</span>
                            <span>Год: {data.seasonYear ?? '—'}</span>
                            {data.contentType === 'tv' && <span>Серии: {data.episodes ?? '—'}</span>}
                        </div>
                        {user && !added && (
                            <div className="detail__actions">
                                <select value={status} onChange={(e) => setStatus(e.target.value as WatchStatus)}>
                                    {(Object.keys(STATUS_LABELS) as WatchStatus[]).map((s) => (
                                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                    ))}
                                </select>
                                <button className="btn-accent" onClick={addToList}>Добавить</button>
                            </div>
                        )}
                        {added && <div className="anime-card__added">✓ в списке</div>}
                    </div>
                </div>
            )}
            {data?.description && <div className="detail__description card">{data.description}</div>}
        </div>
    );
}