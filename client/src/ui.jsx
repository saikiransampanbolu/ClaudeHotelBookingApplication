import { useEffect, useState } from 'react';
import { api } from './api.js';

/** Labelled input wired to its error message for screen readers. */
export function Field({ label, name, error, hint, children, ...props }) {
  const id = `f-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? children(id, error) : (
        <input id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...props} />
      )}
      {hint && !error && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-err`} className="error" role="alert">{error}</p>}
    </div>
  );
}

export const Alert = ({ children, kind = 'error' }) =>
  children ? <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div> : null;

export function useHotel() {
  const [hotel, setHotel] = useState(null);
  useEffect(() => { api('GET', '/hotel').then(setHotel).catch(() => {}); }, []);
  return hotel;
}

/** Simple async loader hook: {data, error, loading}. */
export function useLoad(fn, deps) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    setState({ loading: true });
    fn().then((data) => live && setState({ data }), (error) => live && setState({ error }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [state, () => fn().then((data) => setState({ data }))];
}

export const Spinner = () => <p role="status" className="muted">Loading…</p>;
