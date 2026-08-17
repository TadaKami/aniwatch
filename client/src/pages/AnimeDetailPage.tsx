import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { animeApi } from '../api/anime';
import { api, ApiError } from '../api/client';
import { watchlistApi } from '../api/watchlist';
import { useAuth } from '../context/AuthContext';
import type { AnimeDetailsResponse, WatchStatus, NormalizedAnime, RelatedAnime } from '../types/dto';

const STATUS_LABELS: Record<WatchStatus, string> = {
    WANT_TO_WATCH: 'Буду смотреть',
    WATCHING: 'Смотрю',
    WATCHED: 'Просмотрено',
    DROPPED: 'Брошено',
};

export function AnimeDetailPage(){
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [data, setData] = useState<AnimeDetailsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<WatchStatus>('WANT_TO_WATCH');
    const [epInfo, setEpInfo] = useState<Map<number, { russian: string | null; name: string | null }>>(new Map());

    const animeId = Number(id);
    async function refresh() {
        const r = await animeApi.details(animeId);
        setData(r);
        if(r.watchItem) setStatus(r.watchItem.status);
    }

    useEffect(()=>{
        if (!id) return;
        api.get<Array<{ episode: number; russian: string | null; name: string | null }>>(`/anime/${animeId}/episodes`)
            .then((list) => setEpInfo(new Map(list.map((e) => [e.episode, e]))))
            .catch(() => setEpInfo(new Map()));
        refresh().catch((e)=> setError(e instanceof ApiError ? e.message : 'Ошибка загрузки'));
    }, [id]);

    async function addToList() {
        if (!data) return;

        const a = data.anime;
        const item = await watchlistApi.add({
            shikimoriId: a.id, name: a.name, russian: a.russian,
            coverImage: a.image.original, kind: a.kind, score: a.score,
            episodes: a.episodes, episodesAired: a.episodesAired,
            season: a.season, seasonYear: a.seasonYear,
            genres: a.genres.map((g) => g.russian ?? g.name),
            description: a.description, studios: a.studios, status,
        });
        setData({...data, watchItem: {id: item.id, status, note: null}});
    }

    async function changeStatus(s: WatchStatus) {
        setStatus(s);
        if(data?.watchItem) await watchlistApi.update(data.watchItem.id, s);
    }

    const isWatched = (ep: number) =>
        data?.progress.some((p)=>p.seasonNumber === 1 && p.episodeNumber === ep) ?? false;

    async function toggleEpisode(ep: number) {
        if (!data?.watchItem) return;
        const body = { watchItemId: data.watchItem.id, seasonNumber: 1, episodeNumber: ep };
        if (isWatched(ep)) await watchlistApi.removeProgress(body);
        else await watchlistApi.addProgress(body);
        await refresh();
    }

    function Recommendations({ anime }: { anime: NormalizedAnime }) {
        const [recs, setRecs] = useState<NormalizedAnime[]>([]);

        useEffect(() => {
            const ids = anime.genres.slice(0, 3).map((g) => g.id);
            if (ids.length === 0) return;
            let cancelled = false;
            (async () => {
                for (const pick of [ids, ids.slice(0, 2), ids.slice(0, 1)]) {
                    if (pick.length === 0) continue;
                    const r = await animeApi.search({ genres: pick, perPage: 12 });
                    const list = r.media.filter((m) => m.id !== anime.id);
                    if (list.length >= 4 || pick.length === 1) {
                        if (!cancelled) setRecs(list.slice(0, 10));
                        return;
                    }
                }
            })().catch(() => {});
            return () => { cancelled = true; };
        }, [anime.id]);

        if (recs.length === 0) return null;
        return (
            <div className="card">
                <h3>Похожее по жанрам</h3>
                <div className="recs-row">
                    {recs.map((r) => (
                        <Link key={r.id} to={`/anime/${r.id}`} className="rec-card">
                            <img className="rec-card__cover" src={r.image.preview} alt="" loading="lazy" />
                            <div className="rec-card__title">{r.russian ?? r.name}</div>
                        </Link>
                    ))}
                </div>
            </div>
        );
    }
    const KIND_RU: Record<string, string> = {
        tv: 'ТВ', movie: 'Фильм', ova: 'OVA', ona: 'ONA', special: 'Спешл', music: 'Клип',
    };

    function FranchiseBlock({ currentId }: { currentId: number }) {
        const navigate = useNavigate();
        const [items, setItems] = useState<RelatedAnime[]>([]);
        const [open, setOpen] = useState(false);

        useEffect(() => {
            animeApi.related(currentId)
                .then((list) => setItems(list.filter((i) => i.id !== currentId)))
                .catch(() => setItems([]));
        }, [currentId]);

        if (items.length === 0) return null;

        return (
            <div className="card">
                <button className="btn-accent" onClick={() => setOpen((v) => !v)}>
                    {open ? 'Скрыть сезоны и фильмы' : `Сезоны и фильмы (${items.length})`}
                </button>
                {open && (
                    <div className="franchise-list">
                        {items.map((it) => (
                            <button key={it.id} className="franchise-row" onClick={() => navigate(`/anime/${it.id}`)}>
                                <span className="franchise-row__year">
                                    {it.airedOn ? new Date(it.airedOn).getUTCFullYear() : '—'}
                                </span>
                                <span className="franchise-row__kind">
                                    {KIND_RU[it.kind ?? ''] ?? it.kind ?? '—'}
                                </span>
                                <span className="franchise-row__title">{it.russian ?? it.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }    

    return (
        <div className="detail">
            <button className="btn-ghost" onClick={()=>navigate(-1)}>← Назад</button>
            {error && <div className="form-error">{error}</div>}
            {data && (
                <>
                    <div className="detail__hero card">
                        <img src={data.anime.image.original} alt="" className="detail__cover" />
                        <div className="detail__info">
                            <h2>{data.anime.russian ?? data.anime.name}</h2>
                            <div className="detail__orig">{data.anime.name}</div>
                            <div className="anime-card__genres">
                                {data.anime.genres.map((g)=>(
                                    <span key={g.id} className="genre-chip">{g.russian ?? g.name}</span>
                                ))}
                            </div>
                            <div className="detail__meta">
                                <span>Формат: {data.anime.kind ?? '—'}</span>
                                <span>Оценка: ★{data.anime.score ?? '—'}</span>
                                <span>Сезон: {data.anime.season ?? '—'} {data.anime.seasonYear ?? ''}</span>
                                <span>Эпизоды: {data.airedEpisodeCount}</span>
                                <span>Статус: {data.anime.status ?? '—'}</span>
                            </div>
                            {user &&(
                                <div className="detail__actions">
                                    <select value={status} onChange={(e)=> changeStatus(e.target.value as WatchStatus)}>
                                        {(Object.keys(STATUS_LABELS) as WatchStatus[]).map((s)=>(
                                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                        ))}
                                    </select>
                                    {!data.watchItem &&
                                        <button className="btn-accent" onClick={addToList}>Добавить</button>
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                    {data.anime.descriptionHtml && (
                        <div
                            className="detail__description card"
                            dangerouslySetInnerHTML={{ __html: data.anime.descriptionHtml }}
                        />
                    )}
                    <Recommendations anime={data.anime} />
                    <FranchiseBlock currentId={data.anime.id} />
                    {data.airedEpisodeCount > 0 && (
                         <div className="detail__episodes card">
                             <h3>Серии · {data.progress.length}/{data.airedEpisodeCount}</h3>
                            {!data.watchItem && (
                                <p className="empty">Добавьте тайтл в список, чтобы отмечать просмотренные серии.</p>
                            )}                          
                            <div className="episodes-list">
                                {Array.from({ length: data.airedEpisodeCount }, (_, i) => i + 1).map((ep) => {
                                    const info = epInfo.get(ep);
                                    const title = info?.russian ?? info?.name ?? `Серия ${ep}`;
                                    return (
                                        <label key={ep} className={'episode' + (isWatched(ep) ? ' episode--watched' : '')}>
                                                <input
                                                    type="checkbox"
                                                    checked={isWatched(ep)}
                                                    disabled={!data.watchItem}
                                                    onChange={() => toggleEpisode(ep)}
                                                />
                                            <span className="episode__num">{ep}</span>
                                            <span className="episode__name">{title}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}