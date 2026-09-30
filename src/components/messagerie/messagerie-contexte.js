import { createContext, useContext } from "react";

export const MessagerieContext = createContext(null);

// null hors périmètre (parent, superadmin, backend Firebase) : les
// consommateurs n'affichent alors rien.
export const useMessagerie = () => useContext(MessagerieContext);
