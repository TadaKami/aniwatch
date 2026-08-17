import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError, api } from '../api/client.js';
import { profileApi } from '../api/profile.js';
import { useAuth } from '../context/AuthContext.js';
import { StatsPanel } from './DashboardPage.js';
import { Link } from 'react-router-dom';
import type { NextItem } from '../types/dto.js';

function downscale(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const size = 256;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('canvas')); return; }
            const min = Math.min(img.width, img.height);
            ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = url;
    });
}

const KIND_RU: Record<string, string> = {
    tv: 'ТВ', movie: 'Фильм', ova: 'OVA', ona: 'ONA', special: 'Спешл', music: 'Клип',
};

function NextPanel() {
    const [items, setItems] = useState<NextItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<NextItem[]>('/stats/next')
            .then(setItems)
            .catch(() => setError('Не удалось загрузить продолжения'));
    }, []);

    if (error) return <div className="form-error">{error}</div>;
    if (!items) return <div className="empty">Загружаем продолжения…</div>;
    if (items.length === 0) {
        return <div className="empty">Продолжений не найдено: вы посмотрели всё вышедшее 🎉</div>;
    }

    return (
        <div className="anime-grid">
            {items.map((it) => (
                <div key={it.id} className="anime-card card">
                    <Link to={`/anime/${it.id}`}>
                        {it.image && <img className="anime-card__cover" src={it.image.preview} alt="" loading="lazy" />}
                        <div className="anime-card__title">{it.russian ?? it.name}</div>
                    </Link>
                    <div className="anime-card__meta">
                        {KIND_RU[it.kind ?? ''] ?? it.kind ?? '—'} · {it.airedOn ? new Date(it.airedOn).getUTCFullYear() : 'TBA'}
                        {it.status === 'ongoing' && ' · онгоинг'}
                        {it.status === 'anons' && ' · анонс'}
                    </div>
                    <div className="anime-card__meta">Продолжение: {it.sourceTitle}</div>
                    {it.inListStatus && <div className="anime-card__added">Уже в списке</div>}
                </div>
            ))}
        </div>
    );
}

export function ProfilePage() {
    const { user, updateUser } = useAuth();
    const [tab, setTab] = useState<'profile' | 'stats' | 'next'>('profile');
    const [name, setName] = useState(user?.name ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
    const [error, setError] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [since, setSince] = useState<string | null>(null);
    const [curPass, setCurPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [repPass, setRepPass] = useState('');
    const [passMsg, setPassMsg] = useState<string | null>(null);
    const [passErr, setPassErr] = useState<string | null>(null);    

    useEffect(() => {
        // подтягиваем свежий профиль (аватар мог поменяться в другой сессии)
        if (user) profileApi.get().then((p) => { updateUser(p); setSince(p.createdAt); }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!user) return <Navigate to="/login" replace />;

    async function onFile(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        setError(null);
        if (f.size > 4_000_000) { setError('Файл больше 4МБ'); return; }
        try {
            setAvatar(await downscale(f));
        } catch {
            setError('Не удалось прочитать изображение');
        }
    }

    async function save() {
        setError(null);
        setMsg(null);
        try {
            const updated = await profileApi.update({ name: name.trim(), email: email.trim(), avatar });
            updateUser(updated);
            setMsg('Сохранено ✓');
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
        }
    }
    async function changePassword() {
        setPassErr(null);
        setPassMsg(null);
        if (newPass !== repPass) { setPassErr('Пароли не совпадают'); return; }
        try {
            await profileApi.changePassword({ currentPassword: curPass, newPassword: newPass });
            setCurPass(''); setNewPass(''); setRepPass('');
            setPassMsg('Пароль обновлён ✓');
        } catch (e) {
            setPassErr(e instanceof ApiError ? e.message : 'Ошибка смены пароля');
        }
    }    

    return (
        <div className="profile">
            <div className="profile__tabs">
                <button className={'genre-chip' + (tab === 'profile' ? ' genre-chip--active' : '')} onClick={() => setTab('profile')}>Профиль</button>
                <button className={'genre-chip' + (tab === 'stats' ? ' genre-chip--active' : '')} onClick={() => setTab('stats')}>Статистика</button>
                <button className={'genre-chip' + (tab === 'next' ? ' genre-chip--active' : '')} onClick={() => setTab('next')}>Что дальше</button>
            </div>

            {tab === 'profile' ? (
                <>
                    <div className="profile__body card">
                        <h3>Смена пароля</h3>
                        <label>Текущий пароль
                            <input type="password" value={curPass} autoComplete="current-password"
                                onChange={(e) => setCurPass(e.target.value)} />
                        </label>
                        <label>Новый пароль
                            <input type="password" value={newPass} autoComplete="new-password" minLength={6}
                                onChange={(e) => setNewPass(e.target.value)} />
                        </label>
                        <label>Повторите новый пароль
                            <input type="password" value={repPass} autoComplete="new-password"
                                onChange={(e) => setRepPass(e.target.value)} />
                        </label>
                        {passErr && <div className="form-error">{passErr}</div>}
                        {passMsg && <div className="profile__ok">{passMsg}</div>}
                        <button className="btn-accent" disabled={!curPass || !newPass} onClick={changePassword}>
                            Обновить пароль
                        </button>
                    </div>
                </>
                
            ) : (
                tab === 'stats' ? <StatsPanel /> : <NextPanel />
            )}
        </div>
    );
}