import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { animeApi } from '../api/anime';
import { tmdbApi } from '../api/tmdb';
import { ApiError } from '../api/client';
import { watchlistApi } from '../api/watchlist';
import { useAuth } from '../context/AuthContext';
import type { GenreDto, NormalizedAnime, SearchResponse, WatchStatus } from '../types/dto';
import { api } from '../api/client';

const PER_PAGE = [20, 30, 50];
const SEASONS = ['winter', 'spring', 'summer', 'fall'];
const KINDS = ['tv', 'movie', 'ova', 'ona', 'special', 'music'];
const STATUSES = ['anons', 'ongoing', 'released'];
const SRC_TABS = [
    { id: 'anime', label: 'Аниме' },
    { id: 'tv', label: 'Сериалы и дорамы' },
    { id: 'movie', label: 'Фильмы' },
] as const;
const COUNTRIES = [
    { code: 'KR', label: 'Корея' },
    { code: 'CN', label: 'Китай' },
    { code: 'JP', label: 'Япония' },
    { code: 'TH', label: 'Тайланд' },
];
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

export function SearchPage() {
    const [params, setParams] = useSearchParams();

    const query = params.get('q') ?? '';
    const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
    const perPage = PER_PAGE.includes(Number(params.get('perPage'))) ? Number(params.get('perPage')) : 20;
    const genres = (params.get('genres') ?? '').split(',').filter(Boolean).map(Number);
    const season = params.get('season') ?? '';
    const year = params.get('year') ?? '';
    const kind = params.get('kind') ?? '';
    const status = params.get('status') ?? '';
    const srcRaw = params.get('src') ?? '';
    const src = (srcRaw === 'tv' || srcRaw === 'movie' ? srcRaw : 'anime') as 'anime' | 'tv' | 'movie';
    const country = params.get('country') ?? '';
    const sort = params.get('sort') ?? '';
    const genresKey = genres.join(',');

    const [input, setInput] = useState(query);
    const [genreList, setGenreList] = useState<GenreDto[]>([]);
    const [data, setData] = useState<SearchResponse | null>(null);
    const [error, setError] = useState<string |null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(()=>{setInput(query);}, [query]);

    useEffect(()=>{
        if (src === 'anime') {
            animeApi.genres().then((r) => setGenreList(r.genres)).catch(() => setGenreList([]));
        } else {
            tmdbApi.genres(src).then((r) => setGenreList(r.genres)).catch(() => setGenreList([]));
        }
    }, [src]);

    useEffect(() => {
        let cancelled = false;
        setBusy(true);
        setError(null);
        const req = src === 'anime'
            ? animeApi.search({
                query: query || undefined,
                genres: genres.length ? genres : undefined,
                season: season || undefined,
                year: year ? Number(year) : undefined,
                kind: kind || undefined,
                status: status || undefined,
                sort: sort || undefined,
                page,
                perPage,
            })
            : tmdbApi.search({
                type: src,
                query: query || undefined,
                genres: genres.length ? genres : undefined,
                year: year ? Number(year) : undefined,
                country: src === 'tv' && country ? country : undefined,
                sort: sort || undefined,
                page,
                perPage: Math.min(perPage, 20),
            });
        req
            .then((r) => { if (!cancelled) setData(r); })
            .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Ошибка поиска'); })
            .finally(() => { if (!cancelled) setBusy(false); });
        return () => { cancelled = true; };
     },[src, query, genresKey, season, year, kind, status, country, sort, page, perPage]);

    function updateParams(patch: Record<string, string | null>){
        const next = new URLSearchParams(params);
        for(const [k,v] of Object.entries(patch)){
            if (v === null || v === '') next.delete(k);
            else next.set(k, v);
        }
        if (!('page' in patch)) next.delete('page');
        setParams(next);
    }

    function onSubmit(e: FormEvent){
        e.preventDefault();
        updateParams({q: input.trim() || null});
    }

    function toggleGenre(id: number){
        const next = genres.includes(id) ? genres.filter((g)=>g !== id) : [...genres, id];
        updateParams({genres: next.join(',') || null});
    }

    const sorted = useMemo(() => {
        if (!data) return null;
        if (sort !== 'date_asc' && sort !== 'date_desc') return data;
        const media = [...data.media].sort((a, b) => {
            const da = a.airedOn ? Date.parse(a.airedOn) : Number.POSITIVE_INFINITY;
            const db = b.airedOn ? Date.parse(b.airedOn) : Number.POSITIVE_INFINITY;
            return sort === 'date_asc' ? da - db : db - da;
        });
        return { ...data, media };
    }, [data, sort]);    

    return(
        <div className="search-page">
            <div className="src-tabs">
                {SRC_TABS.map((t) => (
                    <button
                        key={t.id}
                        className={'genre-chip' + (src === t.id ? ' genre-chip--active' : '')}
                        onClick={() => updateParams({ src: t.id === 'anime' ? null : t.id, genres: null })}
                    >
                       {t.label}
                    </button>
                ))}
            </div>        
            <form className="search-form" onSubmit={onSubmit}>
                <input className="search-form__input" value={input} onChange={(e)=> setInput(e.target.value)}
                   placeholder={src === 'anime' ? 'Поиск аниме… (например, Наруто)' : src === 'tv' ? 'Поиск сериала/дорамы…' : 'Поиск фильма…'} />
                <button type="submit" className="btn-accent">Найти</button>
            </form>
            <div className="filters card">
                <div className="filters__row">
                    <label>Сортировка по дате
                        <select value={sort} onChange={(e) => updateParams({ sort: e.target.value || null })}>
                            <option value="">По умолчанию</option>
                            <option value="date_asc">Сначала старые</option>
                            <option value="date_desc">Сначала новые</option>
                        </select>
                    </label>                    
                    {src === 'anime' && (
                        <label>Сезон
                            <select value={season} onChange={(e)=> updateParams({season: e.target.value || null})}>
                                <option value="">-</option>
                                {SEASONS.map((s)=> <option key={s} value={s}>{s}</option> )}
                            </select>
                        </label>
                    )}
                    <label>Год
                        <input type="number" placeholder="2024" value={year}
                            onChange={(e) => updateParams({ year: e.target.value || null })} />
                    </label>
                    {src === 'anime' && (
                        <label>Формат
                            <select value={kind} onChange={(e) => updateParams({ kind: e.target.value || null })}>
                                <option value="">—</option>
                                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </label>
                    )}
                    {src === 'anime' && (
                        <label>Статус
                            <select value={status} onChange={(e) => updateParams({ status: e.target.value || null })}>
                                <option value="">—</option>
                                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>
                    )}
                    {src === 'tv' && (
                        <label>Страна
                            <select value={country} onChange={(e) => updateParams({ country: e.target.value || null })}>
                                <option value="">Все</option>
                                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                            </select>
                        </label>
                    )}
                    <label>На странице
                        <select value={String(perPage)} onChange={(e) => updateParams({ perPage: e.target.value })}>
                            {PER_PAGE.map((n) => <option key={n} value={String(n)}>{n}</option>)}
                        </select>
                    </label>
                </div>
                <div className="filters__genres">
                    {genreList.map((g) => (
                        <button
                            key={g.id}
                            type="button"
                            className={'genre-chip' + (genres.includes(g.id) ? ' genre-chip--active' : '')}
                            onClick={() => toggleGenre(g.id)}
                        >
                            {g.russian ?? g.name}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            {busy && <div className="empty"></div>}

            <div className="anime-grid">
                {sorted?.media.map((a)=> <AnimeCard key={a.id} anime={a} />)}
            </div>
            {sorted && sorted.media.length === 0 && !busy && (
                <div className="empty">Ничего не найдено — попробуйте изменить запрос или фильтры.</div>
            )}

            {data &&
                <div className="pagination">
                    <button disabled={page <= 1} onClick={()=> updateParams({page: String(page - 1)})}>← Назад</button>
                    <span>стр. {data.pageInfo.currentPage}</span>
                    <button disabled={!data.pageInfo.hasNextPage} onClick={()=> updateParams({page: String(page + 1)})}>Вперёд →</button>
                </div>
            }            
        </div>
    );
}

function AnimeCard({anime}: {anime: NormalizedAnime}){
    const {user} = useAuth();
    const [status, setStatus] = useState<WatchStatus>('WANT_TO_WATCH');
    const [added, setAdded] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [cover, setCover] = useState(anime.image.preview);

    useEffect(() => {
        let cancelled = false;
        api.get<{ ok: boolean }>(`/anime/cover-status?u=${encodeURIComponent(anime.image.preview)}`)
            .then((r) => { if (!cancelled && !r.ok) setCover(NO_COVER); })
            .catch(() => { /* молча оставляем оригинал */ });
        return () => { cancelled = true; };
    }, [anime.image.preview]);

    async function add(){
        setErr(null);
        try {
            await watchlistApi.add({
                shikimoriId: anime.id,
                name: anime.name,
                russian: anime.russian,
                coverImage: anime.image.original,
                kind: anime.kind,
                score: anime.score,
                episodes: anime.episodes,
                episodesAired: anime.episodesAired,
                season: anime.season,
                seasonYear: anime.seasonYear,
                genres: anime.genres.map((g) => g.russian ?? g.name),
                description: anime.description,
                studios: anime.studios,
                status,
                source: anime.source,
                contentType: anime.contentType,
            });
            setAdded(true);
        } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Ошибка');
        }        
    }

    return (
        <div className="anime-card card">
            <Link to={anime.source === 'tmdb' ? `/title/tmdb/${anime.id}?type=${anime.contentType}` : `/anime/${anime.id}`}>
                <img
                    className="anime-card__cover"
                    src={cover}
                    alt={anime.russian ?? anime.name}
                    loading="lazy"
                    onError={(e) => { if (e.currentTarget.src !== NO_COVER) e.currentTarget.src = NO_COVER; }}
                />
                <span className={'type-badge' + (anime.contentType === 'tv' ? ' type-badge--tv' : anime.contentType === 'movie' ? ' type-badge--movie' : '')}>
                    {anime.contentType === 'anime' ? 'Аниме' : anime.contentType === 'tv' ? 'Сериал' : 'Фильм'}
                </span>                
                <div className="anime-card__title">{anime.russian ?? anime.name}</div>                
            </Link>
            <div className="anime-card__meta">
                {anime.kind ?? '—'} · {anime.episodes ?? '?'} эп. · ★{anime.score ?? '—'}
            </div>
            <div className="anime-card__genres">
                {anime.genres.slice(0, 3).map((g) => (
                    <span key={g.id} className="genre-chip">{g.russian ?? g.name}</span>
                ))}                
            </div>
            {user && !added && (
                <div className="anime-card__add">
                    <select value={status} onChange={(e) => setStatus(e.target.value as WatchStatus)}>
                        {(Object.keys(STATUS_LABELS) as WatchStatus[]).map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                    </select>
                    <button className="btn-accent" onClick={add}>Добавить</button>
                </div>
            )}
            {user && added && <div className="anime-card__added">✓ в списке</div>}
            {err && <div className="form-error">{err}</div>}            
        </div>
    );
}