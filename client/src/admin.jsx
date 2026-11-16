import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api, money, fmtDate, qs } from './api.js';
import { Alert, Field, Spinner, useLoad } from './ui.jsx';

const Auth = createContext(null);
const useAuth = () => useContext(Auth);

export function AdminApp() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  useEffect(() => { api('GET', '/admin/me').then((r) => setUser(r.user), () => setUser(null)); }, []);
  if (user === undefined) return <main className="container"><Spinner /></main>;
  if (!user) return <Login onLogin={setUser} />;
  return (
    <Auth.Provider value={user}>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header admin">
        <span className="brand">Staff · Harbor View</span>
        <nav aria-label="Admin">
          <NavLink to="/admin" end>Dashboard</NavLink>
          <NavLink to="/admin/calendar">Calendar</NavLink>
          <NavLink to="/admin/bookings">Bookings</NavLink>
          {user.role === 'admin' && <NavLink to="/admin/room-types">Room types</NavLink>}
          <Link to="/">Guest site</Link>
          <button className="linkish" onClick={async () => { await api('POST', '/admin/logout'); setUser(null); }}>Sign out ({user.email})</button>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="container wide">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="bookings/new" element={<NewBooking />} />
          <Route path="bookings/:id" element={<BookingDetail />} />
          <Route path="room-types" element={user.role === 'admin' ? <RoomTypes /> : <Alert>Admins only.</Alert>} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </Auth.Provider>
  );
}

function Login({ onLogin }) {
  const [f, setF] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { onLogin((await api('POST', '/admin/login', f)).user); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return (
    <main className="container narrow" id="main">
      <h1>Staff sign in</h1>
      <form className="card" onSubmit={submit}>
        <Alert>{error}</Alert>
        <Field label="Email" name="email" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p><Link to="/">← Guest site</Link></p>
    </main>
  );
}

function Dashboard() {
  const [{ data, error, loading }] = useLoad(() => api('GET', '/admin/dashboard'), []);
  if (loading) return <Spinner />;
  if (error) return <Alert>{error.message}</Alert>;
  const List = ({ title, rows }) => (
    <section className="card"><h2>{title} ({rows.length})</h2>
      {rows.length === 0 ? <p className="muted">None today.</p> : (
        <ul className="plain">{rows.map((r) => <li key={r.id}><Link to={`/admin/bookings/${r.id}`}>{r.bookingCode}</Link> · {r.guestName} · room {r.roomNumber}</li>)}</ul>
      )}
    </section>
  );
  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted">{fmtDate(data.date)}</p>
      <div className="stats">
        <div className="card stat"><span className="big">{data.occupancyPercent}%</span> occupancy<br /><span className="muted">{data.occupiedRooms} of {data.sellableRooms} rooms tonight</span></div>
      </div>
      <div className="two-col"><List title="Arrivals" rows={data.arrivals} /><List title="Departures" rows={data.departures} /></div>
    </>
  );
}

function CalendarPage() {
  const [from, setFrom] = useState('');
  const [{ data, error, loading }] = useLoad(() => api('GET', `/admin/calendar?${qs({ from, days: 14 })}`), [from]);
  const nav = useNavigate();
  return (
    <>
      <h1>Calendar</h1>
      <Field label="Start date" name="from" type="date" value={from || data?.from || ''} onChange={(e) => e.target.value && setFrom(e.target.value)} />
      {loading && <Spinner />}
      {error && <Alert>{error.message}</Alert>}
      {data && (
        <div className="cal-wrap" tabIndex={0} role="region" aria-label="Booking calendar, scrollable">
          <table className="cal">
            <thead><tr><th scope="col">Room</th>{data.dates.map((d) => <th scope="col" key={d}>{d.slice(5)}</th>)}</tr></thead>
            <tbody>
              {data.rooms.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.roomNumber}<br /><span className="muted small">{r.typeName}{r.status === 'out_of_order' ? ' · OOO' : ''}</span></th>
                  {r.days.map((c, i) => (
                    <td key={i} className={c.booked ? 'booked' : 'free'}>
                      {c.booked
                        ? <button className="cellbtn" onClick={() => nav(`/admin/bookings/${c.bookingId}`)} title={`${c.guestName} (${c.bookingCode})`}>{c.guestName.split(' ')[0]}<span className="sr-only"> booked, {c.bookingCode}</span></button>
                        : <span className="sr-only">free</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="legend"><span className="swatch booked" /> Booked <span className="swatch free" /> Free</p>
    </>
  );
}

function Bookings() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [{ data, error, loading }] = useLoad(() => api('GET', `/admin/bookings?${qs({ q, status })}`), [q, status]);
  return (
    <>
      <div className="row"><h1>Bookings</h1><Link className="btn primary" to="/admin/bookings/new">New booking</Link></div>
      <div className="form-grid">
        <Field label="Search code, name, email or phone" name="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Field label="Status" name="status">{(id) => (
          <select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </select>)}</Field>
      </div>
      {loading && <Spinner />}
      {error && <Alert>{error.message}</Alert>}
      {data && (data.bookings.length === 0 ? <p className="muted">No bookings match.</p> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th scope="col">Code</th><th scope="col">Guest</th><th scope="col">Room</th><th scope="col">Stay</th><th scope="col">Total</th><th scope="col">Status</th></tr></thead>
          <tbody>{data.bookings.map((b) => (
            <tr key={b.id}>
              <td><Link to={`/admin/bookings/${b.id}`}>{b.bookingCode}</Link></td>
              <td>{b.guest.name}</td><td>{b.roomType.name} · {b.roomNumber}</td>
              <td>{b.checkIn} → {b.checkOut}</td><td>{money(b.totalCents)}</td><td><span className={`pill ${b.status}`}>{b.status}</span></td>
            </tr>))}</tbody>
        </table></div>
      ))}
    </>
  );
}

function BookingDetail() {
  const { id } = useParams();
  const [{ data, error, loading }, reload] = useLoad(() => api('GET', `/admin/bookings/${id}`), [id]);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState({});
  const [confirming, setConfirming] = useState(false);
  if (loading) return <Spinner />;
  if (error) return <Alert>{error.message}</Alert>;
  const b = data.booking;
  const act = async (fn, ok) => {
    setMsg({});
    try { await fn(); await reload(); setEdit(null); setConfirming(false); setMsg({ ok }); }
    catch (err) { setMsg({ err: Object.values(err.fields || {}).join(' ') || err.message }); }
  };
  return (
    <>
      <p><Link to="/admin/bookings">← Bookings</Link></p>
      <h1>{b.bookingCode} <span className={`pill ${b.status}`}>{b.status}</span></h1>
      <Alert>{msg.err}</Alert><Alert kind="success">{msg.ok}</Alert>
      <div className="two-col">
        <section className="card">
          <h2>Details</h2>
          <dl className="summary">
            <dt>Guest</dt><dd>{b.guest.name}<br />{b.guest.email}<br />{b.guest.phone}</dd>
            <dt>Room</dt><dd>{b.roomType.name} · {b.roomNumber}</dd>
            <dt>Stay</dt><dd>{b.checkIn} → {b.checkOut} ({b.nights} nights, {b.guests} guests)</dd>
            <dt>Total</dt><dd>{money(b.totalCents)} (tax {money(b.taxCents)})</dd>
            <dt>Payment</dt><dd>{b.payment?.status}{b.payment?.cardLast4 ? ` · card ••••${b.payment.cardLast4}` : ''}</dd>
            {b.status === 'cancelled' && <><dt>Refunded</dt><dd>{money(b.refundCents)}</dd></>}
            <dt>Requests</dt><dd>{b.specialRequests || '—'}</dd>
            <dt>Source</dt><dd>{b.source}</dd>
          </dl>
        </section>
        {b.status === 'confirmed' && (
          <section className="card">
            <h2>Actions</h2>
            {edit ? (
              <form onSubmit={(e) => { e.preventDefault(); act(() => api('PUT', `/admin/bookings/${id}`, { ...edit, guests: Number(edit.guests) }), 'Booking updated.'); }}>
                <Field label="Check-in" name="checkIn" type="date" value={edit.checkIn} onChange={(e) => setEdit({ ...edit, checkIn: e.target.value })} />
                <Field label="Check-out" name="checkOut" type="date" value={edit.checkOut} onChange={(e) => setEdit({ ...edit, checkOut: e.target.value })} />
                <Field label="Guests" name="guests" type="number" min="1" value={edit.guests} onChange={(e) => setEdit({ ...edit, guests: e.target.value })} />
                <Field label="Phone" name="phone" value={edit.guest.phone} onChange={(e) => setEdit({ ...edit, guest: { ...edit.guest, phone: e.target.value } })} />
                <button className="btn primary">Save</button> <button type="button" className="btn" onClick={() => setEdit(null)}>Discard</button>
              </form>
            ) : (
              <p>
                <button className="btn" onClick={() => setEdit({ checkIn: b.checkIn, checkOut: b.checkOut, guests: b.guests, guest: { phone: b.guest.phone } })}>Modify</button>{' '}
                {!confirming
                  ? <button className="btn danger" onClick={() => setConfirming(true)}>Cancel booking</button>
                  : <span role="alertdialog" aria-label="Confirm cancellation">Cancel with full refund? <button className="btn danger" onClick={() => act(() => api('POST', `/admin/bookings/${id}/cancel`, {}), 'Booking cancelled and guest emailed.')}>Yes, cancel</button> <button className="btn" onClick={() => setConfirming(false)}>No</button></span>}
              </p>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function NewBooking() {
  const nav = useNavigate();
  const [{ data: types }] = useLoad(() => api('GET', '/admin/room-types'), []);
  const [f, setF] = useState({ roomTypeId: '', checkIn: '', checkOut: '', guests: '2', name: '', email: '', phone: '', specialRequests: '' });
  const [err, setErr] = useState({ msg: '', fields: {} });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setErr({ msg: '', fields: {} });
    try {
      const { booking } = await api('POST', '/admin/bookings', {
        roomTypeId: Number(f.roomTypeId), checkIn: f.checkIn, checkOut: f.checkOut, guests: Number(f.guests),
        guest: { name: f.name, email: f.email, phone: f.phone }, specialRequests: f.specialRequests,
      });
      nav(`/admin/bookings/${booking.id}`);
    } catch (er) { setErr({ msg: er.message, fields: er.fields || {} }); }
  }
  const fe = err.fields;
  return (
    <>
      <p><Link to="/admin/bookings">← Bookings</Link></p>
      <h1>New booking (phone / walk-in)</h1>
      <form className="card" onSubmit={submit} noValidate>
        <Alert>{err.msg}</Alert>
        <Field label="Room type" name="roomTypeId">{(id) => (
          <select id={id} value={f.roomTypeId} onChange={set('roomTypeId')} required>
            <option value="">Select…</option>
            {types?.roomTypes.filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{t.name} — {money(t.basePriceCents)}/night</option>)}
          </select>)}</Field>
        <div className="form-grid">
          <Field label="Check-in" name="checkIn" type="date" value={f.checkIn} onChange={set('checkIn')} error={fe.checkIn} />
          <Field label="Check-out" name="checkOut" type="date" value={f.checkOut} onChange={set('checkOut')} error={fe.checkOut} />
          <Field label="Guests" name="guests" type="number" min="1" value={f.guests} onChange={set('guests')} error={fe.guests} />
        </div>
        <Field label="Guest name" name="name" value={f.name} onChange={set('name')} error={fe.name} />
        <Field label="Guest email" name="email" type="email" value={f.email} onChange={set('email')} error={fe.email} />
        <Field label="Guest phone" name="phone" type="tel" value={f.phone} onChange={set('phone')} error={fe.phone} />
        <button className="btn primary">Create booking</button>
        <p className="muted small">Payment is recorded as offline (collected at the desk or by phone).</p>
      </form>
    </>
  );
}

function RoomTypes() {
  const [{ data, error, loading }, reload] = useLoad(() => api('GET', '/admin/room-types'), []);
  const [editing, setEditing] = useState(null); // null | 'new' | roomType
  const [msg, setMsg] = useState('');
  if (loading) return <Spinner />;
  if (error) return <Alert>{error.message}</Alert>;
  const run = async (fn) => { setMsg(''); try { await fn(); await reload(); } catch (e) { setMsg(e.message); } };
  return (
    <>
      <div className="row"><h1>Room types</h1><button className="btn primary" onClick={() => setEditing('new')}>Add room type</button></div>
      <Alert>{msg}</Alert>
      {editing && <RoomTypeForm initial={editing === 'new' ? null : editing} onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />}
      <div className="cards">
        {data.roomTypes.map((t) => (
          <section key={t.id} className="card">
            <h2>{t.name} {!t.isActive && <span className="pill cancelled">inactive</span>}</h2>
            <p>{money(t.basePriceCents)}/night · sleeps {t.maxGuests}</p>
            <p className="muted small">{t.amenities.join(', ')}</p>
            <h3>Rooms</h3>
            <ul className="plain">{t.rooms.map((r) => (
              <li key={r.id}>{r.roomNumber}{' '}
                <label className="inline"><span className="sr-only">Status of room {r.roomNumber}</span>
                  <select value={r.status} onChange={(e) => run(() => api('PUT', `/admin/rooms/${r.id}`, { status: e.target.value }))}>
                    <option value="clean">clean</option><option value="dirty">dirty</option><option value="out_of_order">out of order</option>
                  </select></label>
              </li>))}</ul>
            <AddRoom onAdd={(n) => run(() => api('POST', `/admin/room-types/${t.id}/rooms`, { roomNumber: n }))} />
            <p>
              <button className="btn" onClick={() => setEditing(t)}>Edit</button>{' '}
              <button className="btn" onClick={() => run(() => api('PUT', `/admin/room-types/${t.id}`, { isActive: !t.isActive }))}>{t.isActive ? 'Deactivate' : 'Activate'}</button>
            </p>
          </section>
        ))}
      </div>
    </>
  );
}

function AddRoom({ onAdd }) {
  const [n, setN] = useState('');
  return (
    <form className="row" onSubmit={(e) => { e.preventDefault(); if (n.trim()) { onAdd(n); setN(''); } }}>
      <Field label="New room number" name={`room-${Math.random().toString(36).slice(2, 7)}`} value={n} onChange={(e) => setN(e.target.value)} />
      <button className="btn">Add room</button>
    </form>
  );
}

function RoomTypeForm({ initial, onDone, onCancel }) {
  const [f, setF] = useState(initial ? { ...initial, price: (initial.basePriceCents / 100).toFixed(2), amenities: initial.amenities.join(', ') }
    : { name: '', description: '', maxGuests: 2, price: '', amenities: '', photoUrl: '' });
  const [err, setErr] = useState({ msg: '', fields: {} });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setErr({ msg: '', fields: {} });
    const body = {
      name: f.name, description: f.description, maxGuests: Number(f.maxGuests), basePriceCents: Math.round(Number(f.price) * 100),
      amenities: f.amenities.split(',').map((s) => s.trim()).filter(Boolean), photoUrl: f.photoUrl || '',
    };
    try { await api(initial ? 'PUT' : 'POST', initial ? `/admin/room-types/${initial.id}` : '/admin/room-types', body); onDone(); }
    catch (er) { setErr({ msg: er.fields && Object.keys(er.fields).length ? '' : er.message, fields: er.fields || {} }); }
  }
  const fe = err.fields;
  return (
    <form className="card" onSubmit={submit} noValidate aria-label={initial ? 'Edit room type' : 'Add room type'}>
      <h2>{initial ? `Edit ${initial.name}` : 'New room type'}</h2>
      <Alert>{err.msg}</Alert>
      <Field label="Name" name="name" value={f.name} onChange={set('name')} error={fe.name} />
      <Field label="Description" name="description" error={fe.description}>{(id) => <textarea id={id} rows="2" value={f.description} onChange={set('description')} />}</Field>
      <div className="form-grid">
        <Field label="Max guests" name="maxGuests" type="number" min="1" max="10" value={f.maxGuests} onChange={set('maxGuests')} error={fe.maxGuests} />
        <Field label="Nightly price (USD)" name="price" inputMode="decimal" value={f.price} onChange={set('price')} error={fe.basePriceCents} />
      </div>
      <Field label="Amenities (comma separated)" name="amenities" value={f.amenities} onChange={set('amenities')} />
      <Field label="Photo URL (https://… optional)" name="photoUrl" value={f.photoUrl} onChange={set('photoUrl')} error={fe.photoUrl} />
      <button className="btn primary">Save</button> <button type="button" className="btn" onClick={onCancel}>Cancel</button>
    </form>
  );
}
