import { Navigate, Route, Routes } from 'react-router-dom'
import { JamShell, RootShell } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { EditSongPage } from './pages/EditSongPage'
import { JamSongsPage } from './pages/JamSongsPage'
import { JamSettingsPage } from './pages/JamSettingsPage'
import { JamOverviewPage } from './pages/JamOverviewPage'
import { JoinPage } from './pages/JoinPage'
import { MusiciansPage } from './pages/MusiciansPage'
import { MyJamPage } from './pages/MyJamPage'
import { NewJamPage } from './pages/NewJamPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProposeSongPage } from './pages/ProposeSongPage'
import { SetlistPage } from './pages/SetlistPage'
import { SongDetailPage } from './pages/SongDetailPage'

export default function App() {
  return (
    <Routes>
      <Route element={<RootShell />}>
        <Route index element={<Navigate to="/jams" replace />} />
        <Route path="jams" element={<HomePage />} />
        <Route path="home" element={<Navigate to="/jams" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="join/:inviteCode" element={<JoinPage />} />
        <Route path="jam/new" element={<NewJamPage />} />
        <Route path="jam/:jamId" element={<JamShell />}>
          <Route index element={<JamOverviewPage />} />
          <Route path="songs" element={<JamSongsPage />} />
          <Route path="song/:songId" element={<SongDetailPage />} />
          <Route path="song/:songId/edit" element={<EditSongPage />} />
          <Route path="propose" element={<ProposeSongPage />} />
          <Route path="setlist" element={<SetlistPage />} />
          <Route path="musicians" element={<MusiciansPage />} />
          <Route path="settings" element={<JamSettingsPage />} />
          <Route path="me" element={<MyJamPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/jams" replace />} />
      </Route>
    </Routes>
  )
}
