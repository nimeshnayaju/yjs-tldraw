import { TDBinding, TDShape, TDUser, TldrawApp } from "@tldraw/tldraw";
import { useCallback, useEffect, useState } from "react";
import {
  awareness,
  doc,
  provider,
  undoManager,
  yBindings,
  yShapes
} from "../store";

export function useMultiplayerState(roomId: string) {
  const [app, setApp] = useState<TldrawApp>();
  const [loading, setLoading] = useState(true);

  const onMount = useCallback(
    (app: TldrawApp) => {
      app.loadRoom(roomId);
      app.pause();
      setApp(app);
    },
    [roomId]
  );

  const onChangePage = useCallback(
    (
      app: TldrawApp,
      shapes: Record<string, TDShape | undefined>,
      bindings: Record<string, TDBinding | undefined>
    ) => {
      undoManager.stopCapturing();
      doc.transact(() => {
        Object.entries(shapes).forEach(([id, shape]) => {
          if (!shape) {
            yShapes.delete(id);
          } else {
            yShapes.set(shape.id, shape);
          }
        });
        Object.entries(bindings).forEach(([id, binding]) => {
          if (!binding) {
            yBindings.delete(id);
          } else {
            yBindings.set(binding.id, binding);
          }
        });
      });
    },
    []
  );

  const onUndo = useCallback(() => {
    undoManager.undo();
  }, []);

  const onRedo = useCallback(() => {
    undoManager.redo();
  }, []);

  /**
   * Callback to update user's (self) presence
   */
  const onChangePresence = useCallback((app: TldrawApp, user: TDUser) => {
    if (!app.room) return;
    // room.({ id: app.room.userId, tdUser: user });
    awareness.setLocalStateField("tdUser", user);
  }, []);

  /**
   * Update app users whenever there is a change in the room users
   */
  useEffect(() => {
    const onChangeAwareness = () => {
      if (!app || !app.room) return;

      const others = Array.from(awareness.getStates().entries())
        .filter(([key, _]) => key !== awareness.clientID)
        .map(([_, state]) => state)
        .filter((user) => user.tdUser !== undefined);

      const ids = others.map((other) => other.tdUser.id as string);

      Object.values(app.room.users).forEach((user) => {
        if (user && !ids.includes(user.id) && user.id !== app.room?.userId) {
          app.removeUser(user.id);
        }
      });

      app.updateUsers(others.map((other) => other.tdUser).filter(Boolean));
    };

    awareness.on("change", onChangeAwareness);

    return () => awareness.off("change", onChangeAwareness);
  }, [app]);

  useEffect(() => {
    function handleDisconnect() {
      provider.disconnect();
    }

    window.addEventListener("beforeunload", handleDisconnect);

    function handleChanges() {
      if (!app) return;

      app.replacePageContent(
        Object.fromEntries(yShapes.entries()),
        Object.fromEntries(yBindings.entries()),
        {}
      );
    }

    async function setup() {
      yShapes.observeDeep(handleChanges);
      handleChanges();
      setLoading(false);
    }

    setup();

    return () => {
      window.removeEventListener("beforeunload", handleDisconnect);
      yShapes.unobserveDeep(handleChanges);
    };
  }, [app]);

  return {
    onMount,
    onChangePage,
    onUndo,
    onRedo,
    loading,
    onChangePresence
  };
}
