import { useLocation } from "react-router-dom";

/** Brief enter animation when the route changes. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="rg-page-enter">
      {children}
    </div>
  );
}
