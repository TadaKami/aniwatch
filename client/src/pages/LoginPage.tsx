import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function LoginPage(){
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e:FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try{
        await login(email, password);
        navigate('/', {replace: true});
    }catch (err){
        setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    }finally{
        setBusy(false);
    }
  }

  return(
    <div className="auth-page">
        <form className="auth-form card" onSubmit={onSubmit}>
            <h2>Вход</h2>
            {error && <div className='form-error'>{error}</div>}
            <label>
                Email
                <input type="email" required value={email} autoComplete="email" onChange={(e)=>setEmail(e.target.value)}></input>
            </label>
            <label>
                Пароль
                <input type="password" required value={password} autoComplete="current-password" onChange={(e)=>setPassword(e.target.value)}></input>
            </label>
            <button type="submit" disabled={busy}>{busy ? "Входим..." : "Войти"}</button>
            <p className="auth-form__alt">Нет аккаунта?<Link to="/register">Регистрация</Link></p>
        </form>
    </div>
  );

}