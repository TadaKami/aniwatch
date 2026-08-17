import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { profileApi } from '../api/profile.js';
import { useAuth } from '../context/AuthContext.js';
import { StatsPanel } from './DashboardPage.js';

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

export function ProfilePage() {
    const { user, updateUser } = useAuth();
    const [tab, setTab] = useState<'profile' | 'stats'>('profile');
    const [name, setName] = useState(user?.name ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
    const [error, setError] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // подтягиваем свежий профиль (аватар мог поменяться в другой сессии)
        if (user) profileApi.get().then(updateUser).catch(() => {});
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

    return (
        <div className="profile">
            <div className="profile__tabs">
                <button className={'genre-chip' + (tab === 'profile' ? ' genre-chip--active' : '')} onClick={() => setTab('profile')}>Профиль</button>
                <button className={'genre-chip' + (tab === 'stats' ? ' genre-chip--active' : '')} onClick={() => setTab('stats')}>Статистика</button>
            </div>

            {tab === 'profile' ? (
                <div className="profile__body card">
                    <div className="profile__avatar-wrap">
                        {avatar
                            ? <img className="profile__avatar" src={avatar} alt="" />
                            : <div className="profile__avatar profile__avatar--empty">{(name || '?').slice(0, 1).toUpperCase()}</div>}
                        <div className="profile__avatar-btns">
                            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Загрузить фото</button>
                            {avatar && <button className="btn-ghost" onClick={() => setAvatar(null)}>Убрать</button>}
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
                    </div>

                    <label>Имя
                        <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={50} />
                    </label>
                    <label>Email
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>

                    {error && <div className="form-error">{error}</div>}
                    {msg && <div className="profile__ok">{msg}</div>}
                    <button className="btn-accent" onClick={save}>Сохранить</button>
                </div>
            ) : (
                <StatsPanel />
            )}
        </div>
    );
}