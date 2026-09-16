import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SearchPage } from './pages/SearchPage';
import { ProfilePage } from './pages/ProfilePage';
import { WatchlistPage } from './pages/WatchlistPage';
import { AnimeDetailPage } from './pages/AnimeDetailPage';
import { PickPage } from './pages/PickPage';
import { TmdbDetailPage } from './pages/TmdbDetailPage';
import { TopsPage } from './pages/TopsPage';
import { TopCreatePage } from './pages/TopCreatePage';
import { TopViewPage } from './pages/TopViewPage';



export default function App(){
  return(
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/anime/:id" element={<AnimeDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/pick" element={<PickPage />} />
          <Route path="/tops" element={<TopsPage />} />
          <Route path="/tops/new" element={<TopCreatePage />} />
          <Route path="/tops/:id" element={<TopViewPage />} />
          <Route path="/title/tmdb/:id" element={<TmdbDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

      </Routes>
    </AuthProvider>
  );
}