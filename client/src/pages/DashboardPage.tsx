import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { GenreStat } from '../types/dto';

export function DashboardPage(){
    const {user} = useAuth();
    const [status, setStatus] = useState<GenreStat[]>([]);

    useEffect(()=>{
        if (!user) return;
        api.get<GenreStat[]>('/stats/genres').then(setStatus).catch(()=> setStatus([]));
    }, [user]);

    const max = Math.max(1,...status.map((s)=>s.count));

    return (
        <div className="dashboard">
            <h2>Дашборд</h2>
            {!user &&(
                <div className="empty"><Link to="/login">Войдите</Link>, чтобы увидеть статистику по жанрам.</div>
            )}
            {user && status.length === 0 && (
                <div className="empty">Пока нет просмотренных тайтлов — отметьте что-нибудь как «Просмотрено».</div>
            )}
            <div className="dashboard__bars">
                {status.map((s)=>(
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