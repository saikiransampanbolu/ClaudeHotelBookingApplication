import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Home, Results, RoomDetail, Book, Confirmation, MyBooking } from './guest.jsx';
import { AdminApp } from './admin.jsx';

function ScrollAndTitle() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); document.getElementById('main')?.focus(); }, [pathname]);
  return null;
}

function GuestLayout({ children }) {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <Link to="/" className="brand">Harbor View Hotel</Link>
        <nav aria-label="Main">
          <NavLink to="/" end>Book</NavLink>
          <NavLink to="/my-booking">My booking</NavLink>
          <NavLink to="/admin">Staff</NavLink>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="container">{children}</main>
      <footer className="site-footer">Payments are simulated in this demo — no real card is charged.</footer>
    </>
  );
}

export default function App() {
  return (
    <>
      <ScrollAndTitle />
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={
          <GuestLayout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/results" element={<Results />} />
              <Route path="/rooms/:id" element={<RoomDetail />} />
              <Route path="/book/:id" element={<Book />} />
              <Route path="/confirmation" element={<Confirmation />} />
              <Route path="/my-booking" element={<MyBooking />} />
              <Route path="*" element={<><h1>Page not found</h1><p><Link to="/">Back to search</Link></p></>} />
            </Routes>
          </GuestLayout>
        } />
      </Routes>
    </>
  );
}
