import { useEffect, useState } from 'react';
import { animeApi } from '../api/anime';
import { tmdbApi } from '../api/tmdb';
import type { ReviewDto } from '../types/dto';

const SENTIMENT: Record<string, { label: string; cls: string }> = {
    positive: { label: 'Положительный', cls: 'review-badge--positive' },
    neutral: { label: 'Нейтральный', cls: 'review-badge--neutral' },
    negative: { label: 'Отрицательный', cls: 'review-badge--negative' },
};

export function ReviewsBlock({ source, id, type }: { source: 'shikimori' | 'tmdb'; id: number; type: 'tv' | 'movie' }) {
    const [open, setOpen] = useState(false);
    const [reviews, setReviews] = useState<ReviewDto[] | null>(null);

    useEffect(() => { setReviews(null); }, [id, source, type]);

    useEffect(() => {
        if (!open || reviews !== null) return;
        let cancelled = false;
        const req = source === 'tmdb' ? tmdbApi.reviews(type, id) : animeApi.reviews(id);
        req.then((r) => { if (!cancelled) setReviews(r); })
            .catch(() => { if (!cancelled) setReviews([]); });
        return () => { cancelled = true; };
    }, [open, reviews, source, id, type]);

    const counts = reviews ? reviews.reduce<Record<string, number>>((a, r) => {
        const k = r.sentiment ?? 'none';
        a[k] = (a[k] ?? 0) + 1;
        return a;
    }, {}) : {};

    return (
        <div className="card reviews-card">
            <button className="btn-accent" onClick={() => setOpen((v) => !v)}>
                {open ? 'Скрыть отзывы' : 'Отзывы'}
            </button>

            {open && reviews !== null && reviews.length > 0 && (
                <div className="review-summary">
                    <span className="review-badge review-badge--all">Все: {reviews.length}</span>
                    {counts.positive ? <span className="review-badge review-badge--positive">Положительные: {counts.positive}</span> : null}
                    {counts.neutral ? <span className="review-badge review-badge--neutral">Нейтральные: {counts.neutral}</span> : null}
                    {counts.negative ? <span className="review-badge review-badge--negative">Отрицательные: {counts.negative}</span> : null}
                </div>
            )}

            {open && reviews === null && <div className="empty">Загружаем…</div>}

            {open && reviews !== null && reviews.length === 0 && (
                <div className="empty">
                    Отзывов пока нет.{' '}
                    {source === 'shikimori' ? (
                        <a href={`https://shikimori.one/animes/${id}`} target="_blank" rel="noreferrer">Читать на Shikimori</a>
                    ) : (
                        <a href={`https://www.themoviedb.org/${type === 'movie' ? 'movie' : 'tv'}/${id}`} target="_blank" rel="noreferrer">Читать на TMDB</a>
                    )}
                </div>
            )}

            {open && reviews !== null && reviews.length > 0 && (
                <div className="reviews">
                    {reviews.map((r, i) => (
                        <article key={i} className={'review' + (r.sentiment ? ` review--${r.sentiment}` : '')}>
                            <header className="review__head">
                                <span className="review__author">{r.author}</span>
                                <span className="review__head-right">
                                    {r.sentiment && (
                                        <span className={`review-badge ${SENTIMENT[r.sentiment].cls}`}>
                                            {SENTIMENT[r.sentiment].label}
                                        </span>
                                    )}
                                    {r.score != null && <span className="review__score">★ {r.score}/10</span>}
                                    {r.date && <span className="review__date">{r.date}</span>}
                                </span>
                            </header>
                            <p className="review__text">{r.text}</p>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}