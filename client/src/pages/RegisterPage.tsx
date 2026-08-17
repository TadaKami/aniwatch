import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function RegisterPage(){
    const { user, register } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    if (user) return <Navigate to="/" replace />;
    
    async function onSubmit(e: FormEvent){
        e.preventDefault();
        setBusy(true);
        setError(null);
        try{
            await register(name, email, password);
            navigate('/', {replace: true});
        }catch(err){
            setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться');
        }finally{
            setBusy(false);
        }
    }

    return(
        <div className="auth-page">
            <form className="auth-form card" onSubmit={onSubmit}>
                <h2>Регистрация</h2>
                {error && <div className="form-error">{error}</div>}
                <label>
                Имя
                <input required minLength={2} value={name} autoComplete="name"
                        onChange={(e) => setName(e.target.value)} />
                </label>
                <label>
                Email
                <input type="email" required value={email} autoComplete="email"
                        onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                    Пароль
                    <input type="password" required minLength={6} value={password} autoComplete="new-password" onChange={(e)=> setPassword(e.target.value)} />
                </label>
                <button type="submit" disabled={busy}>{busy ? 'Создаём...' : 'Зарегистрироваться'}</button>
                <p className="auth-form__alt">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
            </form>
        </div>
    );
}