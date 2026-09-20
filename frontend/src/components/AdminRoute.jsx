import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api } from "../services/api";

export default function AdminRoute() {
  const location = useLocation();
  const [access, setAccess] = useState({ path: "", status: "checking" });

  useEffect(() => {
    let active = true;
    api("/admin/session")
      .then((result) => {
        if (active) setAccess({
          path: location.pathname,
          status: result.authenticated ? "authenticated" : "unauthenticated",
        });
      })
      .catch(() => {
        if (active) setAccess({ path: location.pathname, status: "unauthenticated" });
      });
    return () => { active = false; };
  }, [location.pathname]);

  if (access.path !== location.pathname || access.status === "checking") {
    return (
      <div className="empty">
        <h3>Checking administrator access…</h3>
      </div>
    );
  }

  if (access.status === "unauthenticated") {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
