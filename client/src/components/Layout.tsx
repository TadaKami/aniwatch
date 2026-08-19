import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function Layout(){
    const { user, logout } = useAuth();
    return (
        <div className="layout">
            <header className="header">
                <Link to="/" className='header__logo'>
                    <img src="/favicon.png" alt="" className="header__logo-img" />
                    <span>Episodex</span>
                </Link>
                <nav className="header__nav">
                    <NavLink to="/profile">Профиль</NavLink>
                    <NavLink to="/search">Поиск</NavLink>
                    <NavLink to="/pick">Что посмотреть</NavLink>
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
            <nav className="bottom-nav">
                <NavLink to="/profile"><i>👤</i><span>Профиль</span></NavLink>
                <NavLink to="/search"><i>🔍</i><span>Поиск</span></NavLink>
                <NavLink to="/pick"><i>🎲</i><span>Подбор</span></NavLink>
                {user && <NavLink to="/watchlist"><i>📚</i><span>Списки</span></NavLink>}
            </nav>            
        </div>
    );
}