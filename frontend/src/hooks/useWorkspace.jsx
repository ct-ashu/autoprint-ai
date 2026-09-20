import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { api } from "../services/api";
const Context = createContext(null);
export function WorkspaceProvider({ children }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const d = await api("/bootstrap");
      setData(d);
      setError("");
      return d;
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);
  return (
    <Context.Provider value={{ data, error, refresh }}>
      {children}
    </Context.Provider>
  );
}
export const useWorkspace = () => useContext(Context);
