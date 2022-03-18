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
import { User } from "../types";
import { useUser } from "./useUser";

/**
 * Undo/Redo doesn't work correctly, especially around TDBinding
 * This is inspired by the current implementation of multiplayer in the tldraw app
 * See https://github.com/tldraw/tldraw/blob/main/apps/www/hooks/useMultiplayerState.ts
 */
export function useMultiplayerState(roomId: string) {
  const [app, setApp] = useState<TldrawApp>();
  const [loading, setLoading] = useState(true);

  const { user: self, updateUserPoint } = useUser();

  const onMount = useCallback(
    (app: TldrawApp) => {
      app.loadRoom(roomId);
      window.app = app;
      app.pause();
      setApp(app);
    },
    [roomId]
  );

  const onChangePage = (
    app: TldrawApp,
    shapes: Record<string, TDShape | undefined>,
    bindings: Record<string, TDBinding | undefined>
  ) => {
    if (!(yShapes && yBindings)) return;
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
  };

  const onUndo = useCallback(() => {
    undoManager.undo();
  }, []);

  const onRedo = useCallback(() => {
    undoManager.redo();
  }, []);

  const onChangePresence = useCallback(
    (app: TldrawApp, user: TDUser) => {
      updateUserPoint(app.room!.userId, user);
    },
    [updateUserPoint]
  );

  useEffect(() => {
    function updateUsersState() {
      if (!app) return;
      const users = Array.from(
        awareness.getStates().values() as IterableIterator<User>
      );

      app.updateUsers(
        users
          .filter((user) => user.tdUser && user.id !== self.id)
          .map((user) => user.tdUser!)
          .filter(Boolean)
      );
    }

    updateUsersState();

    awareness.on("change", updateUsersState);
    return () => {
      awareness.off("change", updateUsersState);
    };
  }, [app, self]);

  useEffect(() => {
    function handleConnect() {
      app?.replacePageContent(
        Object.fromEntries(yShapes.entries()),
        Object.fromEntries(yBindings.entries())
      );
      setLoading(false);
    }

    function handleDisconnect() {
      provider.off("sync", handleConnect);
      provider.disconnect();
    }

    window.addEventListener("beforeunload", handleDisconnect);

    provider.on("sync", handleConnect);

    provider.connect();

    return () => {
      handleDisconnect();
      window.removeEventListener("beforeunload", handleDisconnect);
    };
  }, [app]);

  useEffect(() => {
    function handleChange() {
      app?.replacePageContent(
        Object.fromEntries(yShapes.entries()),
        Object.fromEntries(yBindings.entries())
      );
    }

    // Guessing that change in any binding involves change in the related shapes,
    // hence triggering a change in yShapes eventually
    yShapes.observeDeep(handleChange);

    return () => {
      yShapes.unobserveDeep(handleChange);
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
