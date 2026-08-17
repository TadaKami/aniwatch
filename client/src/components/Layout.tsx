import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function Layout(){
    const { user, logout } = useAuth();
    return (
        <div className="layout">
            <header className="header">
                <Link to="/" className='header__logo'>AnimeWatch</Link>
                <nav className="header__nav">
                    <NavLink to="/profile">Профиль</NavLink>
                    <NavLink to="/search">Поиск</NavLink>
                    {user && <NavLink to="/watchlist">Мои списки</NavLink>}
                </nav>
                <div className="header__auth">
                    {user?(
                        <>
                            <span className="header__user">{user.name}</span>
                            {user.avatar && <img src={user.avatar} alt="" className="header__avatar" />}
                            <button className="bth-ghost" onClick={logout}>Выйти</button>
                        </>
                    ): (
                        <>
                            <Link to="/login">Войти</Link>
                            <Link to="/register" className="btn-accent">Регистрация</Link>
                        </>
                    )}
                </div>
            </header>
            <main className="layout__content container">
                <Outlet />
            </main>
        </div>
    );
}