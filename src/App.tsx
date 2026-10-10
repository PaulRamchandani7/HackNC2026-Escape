import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Finale } from './pages/Finale.tsx'
import { Intro } from './pages/Intro.tsx'
import { Landing } from './pages/Landing.tsx'
import { Ship } from './pages/Ship.tsx'
import { Terminal } from './pages/Terminal.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/intro" element={<Intro />} />
        <Route path="/ship" element={<Ship />} />
        <Route path="/room/:room" element={<Terminal />} />
        <Route path="/finale" element={<Finale />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
