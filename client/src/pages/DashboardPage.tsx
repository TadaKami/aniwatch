import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import type { GenreStat, StatsOverview } from '../types/dto.js';
import { Link } from 'react-router-dom';

export function StatsPanel() {
    const { user } = useAuth();
    const [stats, setStats] = useState<GenreStat[]>([]);
    const [ov, setOv] = useState<StatsOverview | null>(null);

    useEffect(() => {
        if (!user) return;
        api.get<GenreStat[]>('/stats/genres').then(setStats).catch(() => setStats([]));
        api.get<StatsOverview>('/stats/overview').then(setOv).catch(() => {});
    }, [user]);

    const max = Math.max(1, ...stats.map((s) => s.count));
    const actMax = Math.max(1, ...(ov?.activity.map((w) => w.count) ?? [1]));

    return (
        <div className="dashboard">
            {ov && (
                <>
                    <div className="stat-cards">
                        <div className="stat-card"><b>{ov.totals.episodesWatched}</b><span>серий отмечено</span></div>
                        <div className="stat-card"><b>{ov.totals.watchedTitles}</b><span>просмотрено</span></div>
                        <div className="stat-card"><b>{ov.totals.watchingTitles}</b><span>смотрю</span></div>
                        <div className="stat-card"><b>{ov.totals.totalTitles}</b><span>всего в списках</span></div>
                    </div>

                    <div className="card">
                        <h3>Активность · 12 недель</h3>
                        <div className="activity">
                            {ov.activity.map((w) => (
                                <div key={w.weekStart} className="act-col" title={`${w.weekStart}: ${w.count}`}>
                                    <div className="act-bar" style={{ height: `${Math.max(4, (w.count / actMax) * 100)}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {ov.watching.length > 0 && (
                        <div className="card">
                            <h3>Сейчас смотрю</h3>
                            <div className="watching">
                                {ov.watching.map((w) => (
                                    <Link key={w.shikimoriId} to={w.source === 'tmdb' ? `/title/tmdb/${w.shikimoriId}?type=${w.contentType}` : `/anime/${w.shikimoriId}`} className="watching-row">
                                        {w.coverImage && <img src={w.coverImage} alt="" className="watching-row__cover" />}
                                        <div className="watching-row__info">
                                            <div className="watching-row__title">{w.russian ?? w.name}</div>
                                            <div className="bar-row__track">
                                                <div className="bar-row__fill"
                                                    style={{ width: `${w.aired ? Math.min(100, (w.watched / w.aired) * 100) : 0}%` }} />
                                            </div>
                                        </div>
                                        <span className="watching-row__count">{w.watched}/{w.aired || '—'}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}            
            {stats.length === 0 && (
                <div className="empty">Пока нет просмотренных тайтлов — отметьте что-нибудь как «Просмотрено».</div>
            )}
            <div className="dashboard__bars">
                {stats.map((s) => (
                    <div className="bar-row" key={s.genre}>
                        <span className="bar-row__label">{s.genre}</span>
                        <div className="bar-row__track">
                            <div className="bar-row__fill" style={{ width: `${(s.count / max) * 100}%` }}></div>
                        </div>
                        <span className="bar-row__count">{s.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}