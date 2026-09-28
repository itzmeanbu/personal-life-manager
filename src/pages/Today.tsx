/**
 * Home and Today used to be two separate views of the same day. They're
 * merged now — Home (src/pages/Home.tsx) renders the Day Journey phase
 * flow AND the Day Brief cards/agenda together. This route just redirects
 * so any existing "/today" link still lands on the one unified page.
 */
import { Navigate } from 'react-router-dom';

export default function Today() {
  return <Navigate to="/" replace />;
}
