import { TDUser } from "@tldraw/tldraw";
import * as React from "react";
import { awareness } from "../store";
import { User } from "../types";

export function useUser() {
  const [user, setUser] = React.useState<any>();

  // Set the initial user's state
  React.useEffect(() => {
    awareness.setLocalState({} as User);
    setUser(awareness.getLocalState());
  }, []);

  const updateUserPoint = React.useCallback((id: string, user: TDUser) => {
    awareness.setLocalStateField("tdUser", user);
    awareness.setLocalStateField("id", id);
    setUser(awareness.getLocalState());
  }, []);

  return { user, updateUserPoint };
}
