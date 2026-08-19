import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { tmdbApi } from '../api/tmdb';
import { watchlistApi } from '../api/watchlist';
import { useAuth } from '../context/AuthContext';
import type { NormalizedAnime, TmdbFullDetails, TmdbSeasonEpisode, WatchStatus } from '../types/dto';

const STATUS_LABELS: Record<WatchStatus, string> = {
    WANT_TO_WATCH: 'Буду смотреть',
    WATCHING: 'Смотрю',
    WATCHED: 'Просмотрено',
    DROPPED: 'Брошено',
};

const NO_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400">' +
    '<rect width="100%" height="100%" fill="#1a1a20"/>' +
    '<text x="50%" y="50%" fill="#8e8e93" font-family="sans-serif" font-size="16" text-anchor="middle">Нет постера</text></svg>'
);

export function TmdbDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const type = searchParams.get('type') === 'movie' ? ('movie' as const) : ('tv' as const);
    const navigate = useNavigate();
    const { user } = useAuth();

    const [data, setData] = useState<TmdbFullDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<WatchStatus>('WANT_TO_WATCH');
    const [added, setAdded] = useState(false);
    const [season, setSeason] = useState(1);
    const [eps, setEps] = useState<TmdbSeasonEpisode[]>([]);

    const numId = Number(id);

    async function refresh() {
        const d = await tmdbApi.full(type, numId);
        setData(d);
        if (d.watchItem) setStatus(d.watchItem.status);
    }

    useEffect(() => {
        if (!id) return;
        refresh().catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка загрузки'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, type]);

    useEffect(() => {
        if (type !== 'tv') return;
        tmdbApi.season(numId, season).then(setEps).catch(() => setEps([]));
    }, [numId, season, type]);

    const watched = data?.watchItem?.watchedEpisodes ?? 0;
    const offsetBefore = data
        ? data.seasons.filter((s) => s.season < season).reduce((a, s) => a + (s.episodeCount || 0), 0)
        : 0;
    const totalEpisodes = data
        ? data.seasons.reduce((a, s) => a + (s.episodeCount || 0), 0) || (data.episodes ?? 0)
        : 0;
    const isWatched = (ep: number) => watched >= offsetBefore + ep;

    async function setGlobalWatched(n: number) {
        if (!data?.watchItem) return;
        const r = await watchlistApi.setProgress(data.watchItem.id, Math.max(0, n));
        setData({ ...data, watchItem: { ...data.watchItem, watchedEpisodes: r.watchedEpisodes } });
    }
    const toggleEpisode = (ep: number) =>
        setGlobalWatched(isWatched(ep) ? offsetBefore + ep - 1 : offsetBefore + ep);

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
        await refresh();
    }

    return (
        <div className="detail">
            <button className="btn-ghost" onClick={() => navigate(-1)}>← Назад</button>
            {error && <div className="form-error">{error}</div>}
            {data && (
                <>
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
                                {data.contentType === 'tv' && <span>Сезоны: {data.seasons.length || '—'}</span>}
                            </div>
                            {user && !added && (
                                <div className="detail__actions">
                                    <select value={status} onChange={(e) => setStatus(e.target.value as WatchStatus)}>
                                        {(Object.keys(STATUS_LABELS) as WatchStatus[]).map((s) => (
                                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                        ))}
                                    </select>
                                    {!data.watchItem && <button className="btn-accent" onClick={addToList}>Добавить</button>}
                                </div>
                            )}
                            {added && <div className="anime-card__added">✓ в списке</div>}
                        </div>
                    </div>

                    {data.description && <div className="detail__description card">{data.description}</div>}

                    <TmdbRecs type={type} id={numId} />

                    {type === 'tv' && data.seasons.length > 0 && (
                        <div className="detail__episodes card">
                            <div className="detail__actions">
                                <label>Сезон
                                    <select value={season} onChange={(e) => setSeason(Number(e.target.value))}>
                                        {data.seasons.map((s) => (
                                            <option key={s.season} value={s.season}>Сезон {s.season}</option>
                                        ))}
                                    </select>
                                </label>
                                <span className="anime-card__meta">
                                    Серии · {watched}/{totalEpisodes || '—'}
                                </span>
                            </div>
                            {!data.watchItem && (
                                <p className="empty">Добавьте тайтл в список, чтобы отмечать просмотренные серии.</p>
                            )}
                            <div className="episodes-list">
                                {eps.map((e) => (
                                    <label key={e.episode} className={'episode' + (isWatched(e.episode) ? ' episode--watched' : '')}>
                                        <input
                                            type="checkbox"
                                            checked={isWatched(e.episode)}
                                            disabled={!data.watchItem}
                                            onChange={() => toggleEpisode(e.episode)}
                                        />
                                        <span className="episode__num">{e.episode}</span>
                                        <span className="episode__name">{e.name ?? `Серия ${e.episode}`}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function TmdbRecs({ type, id }: { type: 'tv' | 'movie'; id: number }) {
    const [recs, setRecs] = useState<NormalizedAnime[]>([]);
    useEffect(() => {
        tmdbApi.related(type, id).then(setRecs).catch(() => setRecs([]));
    }, [type, id]);
    if (recs.length === 0) return null;
    return (
        <div className="card">
            <h3>Похожее по жанрам</h3>
            <div className="recs-row">
                {recs.map((r) => (
                    <Link key={r.id} to={`/title/tmdb/${r.id}?type=${r.contentType}`} className="rec-card">
                        <img className="rec-card__cover" src={r.image.preview || NO_COVER} alt="" loading="lazy"
                            onError={(e) => { if (e.currentTarget.src !== NO_COVER) e.currentTarget.src = NO_COVER; }} />
                        <div className="rec-card__title">{r.russian ?? r.name}</div>
                    </Link>
                ))}
            </div>
        </div>
    );
}