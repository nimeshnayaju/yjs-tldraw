import { TDBinding, TDShape, TDUser, TldrawApp } from "@tldraw/tldraw";
import { useCallback, useEffect, useRef } from "react";
import {
  awareness,
  doc,
  provider,
  undoManager,
  yBindings,
  yShapes
} from "../store";

export function useMultiplayerState(roomId: string) {
  const tldrawRef = useRef<TldrawApp>();

  const onMount = useCallback(
    (app: TldrawApp) => {
      app.loadRoom(roomId);
      app.pause();
      tldrawRef.current = app;

      app.replacePageContent(
        Object.fromEntries(yShapes.entries()),
        Object.fromEntries(yBindings.entries()),
        {}
      );
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
    awareness.setLocalStateField("tdUser", user);
  }, []);

  /**
   * Update app users whenever there is a change in the room users
   */
  useEffect(() => {
    const onChangeAwareness = () => {
      const tldraw = tldrawRef.current;

      if (!tldraw || !tldraw.room) return;

      const others = Array.from(awareness.getStates().entries())
        .filter(([key, _]) => key !== awareness.clientID)
        .map(([_, state]) => state)
        .filter((user) => user.tdUser !== undefined);

      const ids = others.map((other) => other.tdUser.id as string);

      Object.values(tldraw.room.users).forEach((user) => {
        if (user && !ids.includes(user.id) && user.id !== tldraw.room?.userId) {
          tldraw.removeUser(user.id);
        }
      });

      tldraw.updateUsers(others.map((other) => other.tdUser).filter(Boolean));
    };

    awareness.on("change", onChangeAwareness);

    return () => awareness.off("change", onChangeAwareness);
  }, []);

  useEffect(() => {
    function handleChanges() {
      const tldraw = tldrawRef.current;

      if (!tldraw) return;

      tldraw.replacePageContent(
        Object.fromEntries(yShapes.entries()),
        Object.fromEntries(yBindings.entries()),
        {}
      );
    }

    yShapes.observeDeep(handleChanges);

    return () => yShapes.unobserveDeep(handleChanges);
  }, []);

  useEffect(() => {
    function handleDisconnect() {
      provider.disconnect();
    }
    window.addEventListener("beforeunload", handleDisconnect);

    return () => window.removeEventListener("beforeunload", handleDisconnect);
  }, []);

  return {
    onMount,
    onChangePage,
    onUndo,
    onRedo,
    onChangePresence
  };
}
