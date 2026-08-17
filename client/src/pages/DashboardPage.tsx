import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import type { GenreStat } from '../types/dto.js';

export function StatsPanel() {
    const { user } = useAuth();
    const [stats, setStats] = useState<GenreStat[]>([]);

    useEffect(() => {
        if (!user) return;
        api.get<GenreStat[]>('/stats/genres').then(setStats).catch(() => setStats([]));
    }, [user]);

    const max = Math.max(1, ...stats.map((s) => s.count));

    return (
        <div className="dashboard">
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