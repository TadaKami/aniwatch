import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { topsApi } from '../api/tops';
import { useAuth } from '../context/AuthContext';
import type { TopDto } from '../types/dto';

const CT_LABELS: Record<string, string> = { any: 'Все', anime: 'Аниме', tv: 'Сериалы', movie: 'Фильмы' };

export function TopsPage() {
    const { user } = useAuth();
    const [tops, setTops] = useState<TopDto[] | null>(null);

    const reload = useCallback(() => { topsApi.list().then(setTops).catch(() => setTops([])); }, []);
    useEffect(() => { reload(); }, [reload]);

    return (
        <div className="tops">
            <div className="tops__head">
                <h2>Топы пользователей</h2>
                {user && <Link className="btn-accent" to="/tops/new">Создать топ</Link>}
            </div>
            {tops === null && <div className="empty">Загружаем…</div>}
            {tops !== null && tops.length === 0 && <div className="empty">Пока нет топов — создайте первый.</div>}
            <div className="tops__grid">
                {tops?.map((t) => (
                    <Link key={t.id} to={`/tops/${t.id}`} className="card top-card">
                        <div className="top-card__head">
                            <b>{t.name}</b>
                            <span className="anime-card__meta">{CT_LABELS[t.contentType] ?? t.contentType}</span>
                        </div>
                        <div className="anime-card__meta">автор: {t.ownerName} · {t.items.length} тайтлов</div>
                        {t.description && <p className="top-card__desc">{t.description}</p>}
                        <div className="top-card__posters">
                            {t.items.slice(0, 5).map((i) => i.coverImage ? <img key={i.id} src={i.coverImage} alt="" /> : null)}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}