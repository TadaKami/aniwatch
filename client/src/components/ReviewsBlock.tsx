import { useEffect, useState } from 'react';
import { animeApi } from '../api/anime';
import { tmdbApi } from '../api/tmdb';
import type { ReviewDto } from '../types/dto';

export function ReviewsBlock({ source, id, type }: { source: 'shikimori' | 'tmdb'; id: number; type: 'tv' | 'movie' }) {
    const [open, setOpen] = useState(false);
    const [reviews, setReviews] = useState<ReviewDto[] | null>(null);

    useEffect(() => {
        if (!open || reviews !== null) return;
        const req = source === 'tmdb' ? tmdbApi.reviews(type, id) : animeApi.reviews(id);
        req.then(setReviews).catch(() => setReviews([]));
    }, [open, reviews, source, id, type]);

    return (
        <div className="card">
            <button className="btn-accent" onClick={() => setOpen((v) => !v)}>
                {open ? 'Скрыть отзывы' : 'Отзывы и комментарии'}
            </button>
            {open && reviews === null && <div className="empty">Загружаем…</div>}
            {open && reviews !== null && reviews.length === 0 && <div className="empty">Отзывов пока нет.</div>}
            {open && reviews !== null && reviews.length > 0 && (
                <div className="reviews">
                    {reviews.map((r, i) => (
                        <div key={i} className="review">
                            <div className="review__head">
                                <b>{r.author}</b>
                                {r.score != null && <span className="review__score">★{r.score}</span>}
                            </div>
                            <p className="review__text">{r.text}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}