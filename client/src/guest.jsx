import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiFailure, qs, money, fmtDate, todayIn, addDays } from './api.js';
import { Alert, Field, Spinner, useHotel, useLoad } from './ui.jsx';

const PriceTable = ({ q }) => (
  <table className="price">
    <caption className="sr-only">Price breakdown</caption>
    <tbody>
      <tr><th scope="row">{money(q.nightlyCents)} × {q.nights} night{q.nights > 1 ? 's' : ''}</th><td>{money(q.subtotalCents)}</td></tr>
      <tr><th scope="row">Taxes</th><td>{money(q.taxCents)}</td></tr>
      <tr className="total"><th scope="row">Total</th><td>{money(q.totalCents)}</td></tr>
    </tbody>
  </table>
);

const Photo = ({ type }) => (
  type.photoUrl
    ? <img src={type.photoUrl} alt={`${type.name} room`} loading="lazy" />
    : <div className="photo-ph" role="img" aria-label={`${type.name} room (photo coming soon)`}>{type.name}</div>
);

// ---------------- Home ----------------
export function Home() {
  const hotel = useHotel();
  const nav = useNavigate();
  const today = todayIn(hotel?.timezone || 'America/New_York');
  const [f, setF] = useState({ checkIn: '', checkOut: '', guests: '2' });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    const er = {};
    if (!f.checkIn) er.checkIn = 'Choose a check-in date.';
    if (!f.checkOut) er.checkOut = 'Choose a check-out date.';
    else if (f.checkIn && f.checkOut <= f.checkIn) er.checkOut = 'Check-out must be after check-in.';
    setErrors(er);
    if (!Object.keys(er).length) nav(`/results?${qs(f)}`);
  }

  return (
    <>
      <h1>Find your room</h1>
      <p className="lead">{hotel ? `${hotel.name}, ${hotel.address}` : 'Search availability for your dates.'}</p>
      <form onSubmit={submit} noValidate className="card form-grid">
        <Field label="Check-in" name="checkIn" type="date" min={today} value={f.checkIn} onChange={set('checkIn')} error={errors.checkIn} required />
        <Field label="Check-out" name="checkOut" type="date" min={f.checkIn ? addDays(f.checkIn, 1) : today} value={f.checkOut} onChange={set('checkOut')} error={errors.checkOut} required />
        <Field label="Guests" name="guests" type="number" min="1" max="10" value={f.guests} onChange={set('guests')} required />
        <button className="btn primary" type="submit">Search rooms</button>
      </form>
    </>
  );
}

// ---------------- Results ----------------
export function Results() {
  const [sp] = useSearchParams();
  const stay = { checkIn: sp.get('checkIn') || '', checkOut: sp.get('checkOut') || '', guests: sp.get('guests') || '' };
  const [{ data, error, loading }] = useLoad(() => api('GET', `/rooms/search?${qs(stay)}`), [sp.toString()]);

  return (
    <>
      <h1>Available rooms</h1>
      <p className="muted"><Link to="/">← Change search</Link></p>
      {loading && <Spinner />}
      {error && <Alert>{Object.values(error.fields || {}).join(' ') || error.message}</Alert>}
      {data && (
        <>
          <p>{fmtDate(data.checkIn)} → {fmtDate(data.checkOut)} · {data.nights} night{data.nights > 1 ? 's' : ''} · {data.guests} guest{data.guests > 1 ? 's' : ''}</p>
          {data.results.length === 0 && <Alert kind="info">No rooms are available for those dates. Try different dates or fewer guests.</Alert>}
          <ul className="cards">
            {data.results.map((t) => (
              <li key={t.id} className="card room">
                <Photo type={t} />
                <div>
                  <h2>{t.name}</h2>
                  <p className="muted">Sleeps {t.maxGuests} · {t.availableRooms} left</p>
                  <p>{t.description}</p>
                  <p className="big">{money(t.quote.totalCents)} <span className="muted">total · {money(t.basePriceCents)}/night + taxes</span></p>
                  <Link className="btn primary" to={`/rooms/${t.id}?${qs(stay)}`}>View room<span className="sr-only"> {t.name}</span></Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ---------------- Room detail ----------------
export function RoomDetail() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const stay = { checkIn: sp.get('checkIn') || '', checkOut: sp.get('checkOut') || '', guests: sp.get('guests') || '' };
  const [{ data, error, loading }] = useLoad(() => api('GET', `/room-types/${id}?${qs(stay)}`), [id, sp.toString()]);
  const hotel = useHotel();
  if (loading) return <Spinner />;
  if (error) return <><Alert>{error.status === 404 ? 'That room is not available.' : error.message}</Alert><Link to="/">Back to search</Link></>;
  const t = data.roomType;
  const q = data.quote;
  return (
    <>
      <p className="muted"><Link to={`/results?${qs(stay)}`}>← Back to results</Link></p>
      <h1>{t.name}</h1>
      <div className="detail">
        <Photo type={t} />
        <div>
          <p>{t.description}</p>
          <h2>Amenities</h2>
          <ul className="chips">{t.amenities.map((a) => <li key={a}>{a}</li>)}</ul>
          <h2>Cancellation policy</h2>
          <p>{data.cancellationPolicy}</p>
          {hotel && <p className="muted">Check-in from {hotel.checkInTime}; check-out by {hotel.checkOutTime}.</p>}
        </div>
      </div>
      <section className="card" aria-labelledby="sum">
        <h2 id="sum">Your stay</h2>
        <p>{fmtDate(q.checkIn)} → {fmtDate(q.checkOut)} · {q.guests} guest{q.guests > 1 ? 's' : ''}</p>
        <PriceTable q={q.quote} />
        {q.available
          ? <Link className="btn primary" to={`/book/${t.id}?${qs(stay)}`}>Book this room</Link>
          : <Alert kind="info">Sorry, this room type is sold out for your dates.</Alert>}
      </section>
    </>
  );
}

// ---------------- Book (details → payment) ----------------
export function Book() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const stay = { checkIn: sp.get('checkIn') || '', checkOut: sp.get('checkOut') || '', guests: sp.get('guests') || '' };
  const [{ data, error, loading }] = useLoad(() => api('GET', `/room-types/${id}?${qs(stay)}`), [id, sp.toString()]);
  const [step, setStep] = useState(1);
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' });
  const [specialRequests, setSR] = useState('');
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <><Alert>{error.message}</Alert><Link to="/">Back to search</Link></>;
  const q = data.quote;

  function details(e) {
    e.preventDefault();
    const er = {};
    if (!guest.name.trim()) er.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(guest.email.trim())) er.email = 'Enter a valid email address.';
    if (!/^\+?[0-9 ()-]{7,20}$/.test(guest.phone.trim())) er.phone = 'Enter a valid phone number.';
    setErrors(er);
    if (!Object.keys(er).length) { setStep(2); setFormError(''); }
  }

  async function pay(e) {
    e.preventDefault();
    if (busy) return; // prevent double submit
    setBusy(true); setFormError(''); setErrors({});
    try {
      const { booking } = await api('POST', '/bookings', { roomTypeId: Number(id), ...stay, guest, specialRequests, card });
      setCard({ number: '', expiry: '', cvc: '' });
      nav('/confirmation', { state: { booking }, replace: true });
    } catch (err) {
      if (err instanceof ApiFailure) {
        setFormError(err.message);
        if (err.status === 400) { setErrors(err.fields); if (err.fields.name || err.fields.email || err.fields.phone) setStep(1); }
      }
      setBusy(false);
    }
  }

  return (
    <>
      <p className="muted"><Link to={`/rooms/${id}?${qs(stay)}`}>← Back to room</Link></p>
      <h1>Book {data.roomType.name}</h1>
      <ol className="steps" aria-label="Progress">
        <li aria-current={step === 1 ? 'step' : undefined}>1. Your details</li>
        <li aria-current={step === 2 ? 'step' : undefined}>2. Payment</li>
      </ol>
      <div className="two-col">
        {step === 1 ? (
          <form onSubmit={details} noValidate className="card">
            <h2>Your details</h2>
            <Field label="Full name" name="name" autoComplete="name" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} error={errors.name} required />
            <Field label="Email" name="email" type="email" autoComplete="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} error={errors.email} hint="Your confirmation is sent here." required />
            <Field label="Phone" name="phone" type="tel" autoComplete="tel" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} error={errors.phone} required />
            <Field label="Special requests (optional)" name="specialRequests" error={errors.specialRequests}>
              {(fid) => <textarea id={fid} rows="3" maxLength={500} value={specialRequests} onChange={(e) => setSR(e.target.value)} />}
            </Field>
            <button className="btn primary" type="submit">Continue to payment</button>
          </form>
        ) : (
          <form onSubmit={pay} noValidate className="card">
            <h2>Payment</h2>
            <Alert kind="info">Demo mode: use card 4242 4242 4242 4242, any future expiry, any 3-digit code. (4000 0000 0000 0002 is declined.)</Alert>
            <Alert>{formError}</Alert>
            <Field label="Card number" name="cardNumber" inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} required />
            <div className="form-grid">
              <Field label="Expiry (MM/YY)" name="expiry" autoComplete="cc-exp" placeholder="MM/YY" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} required />
              <Field label="Security code" name="cvc" inputMode="numeric" autoComplete="cc-csc" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} required />
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={() => setStep(1)}>Back</button>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Processing…' : `Pay ${money(q.quote.totalCents)}`}</button>
            </div>
          </form>
        )}
        <aside className="card" aria-label="Price summary">
          <h2>Summary</h2>
          <p>{fmtDate(q.checkIn)} → {fmtDate(q.checkOut)}<br />{q.guests} guest{q.guests > 1 ? 's' : ''}</p>
          <PriceTable q={q.quote} />
          <p className="muted small">{data.cancellationPolicy}</p>
        </aside>
      </div>
    </>
  );
}

// ---------------- Confirmation ----------------
export function Confirmation() {
  const { state } = useLocation();
  const b = state?.booking;
  if (!b) return <><h1>No booking to show</h1><p><Link to="/my-booking">Look up a booking</Link></p></>;
  return (
    <>
      <h1>Booking confirmed 🎉</h1>
      <Alert kind="success">A confirmation email has been sent to {b.guest.email}.</Alert>
      <div className="card">
        <p className="muted">Booking code</p>
        <p className="code" aria-label={`Booking code ${b.bookingCode.split('').join(' ')}`}>{b.bookingCode}</p>
        <BookingSummary b={b} />
      </div>
      <p><Link className="btn" to="/my-booking">Manage booking</Link> <Link className="btn" to="/">Book another stay</Link></p>
    </>
  );
}

function BookingSummary({ b }) {
  return (
    <>
      <dl className="summary">
        <dt>Room</dt><dd>{b.roomType.name}</dd>
        <dt>Check-in</dt><dd>{fmtDate(b.checkIn)} (from {b.checkInTime})</dd>
        <dt>Check-out</dt><dd>{fmtDate(b.checkOut)} (by {b.checkOutTime})</dd>
        <dt>Guests</dt><dd>{b.guests}</dd>
        <dt>Guest</dt><dd>{b.guest.name}</dd>
        <dt>Status</dt><dd><strong>{b.status}</strong></dd>
      </dl>
      <PriceTable q={{ nightlyCents: b.nightlyCents, nights: b.nights, subtotalCents: b.subtotalCents, taxCents: b.taxCents, totalCents: b.totalCents }} />
      {b.status === 'cancelled' && <p>Refunded: <strong>{money(b.refundCents)}</strong></p>}
    </>
  );
}

// ---------------- My booking ----------------
export function MyBooking() {
  const [f, setF] = useState({ code: '', email: '' });
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run(path) {
    setBusy(true); setError('');
    try { setBooking((await api('POST', path, f)).booking); setConfirming(false); }
    catch (err) { setError(err.message); setBooking(null); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h1>My booking</h1>
      <form onSubmit={(e) => { e.preventDefault(); run('/bookings/lookup'); }} className="card form-grid" noValidate>
        <Field label="Booking code" name="code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="HB-XXXXXXXX" autoCapitalize="characters" required />
        <Field label="Email used for booking" name="email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <button className="btn primary" disabled={busy}>Find booking</button>
      </form>
      <Alert>{error}</Alert>
      {booking && (
        <section className="card" aria-live="polite">
          <h2>{booking.bookingCode}</h2>
          <BookingSummary b={booking} />
          {booking.status === 'confirmed' && !confirming && <button className="btn danger" onClick={() => setConfirming(true)}>Cancel booking</button>}
          {confirming && (
            <div role="alertdialog" aria-labelledby="cc" className="confirm">
              <p id="cc"><strong>Cancel this booking?</strong> Refund depends on the policy shown at booking. This cannot be undone.</p>
              <button className="btn danger" disabled={busy} onClick={() => run('/bookings/cancel')}>Yes, cancel booking</button>{' '}
              <button className="btn" onClick={() => setConfirming(false)}>Keep booking</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
