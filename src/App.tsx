import { Tldraw, useFileSystem } from "@tldraw/tldraw";
import { useUsers } from "y-presence";
import { useMultiplayerState } from "./hooks/useMultiplayerState";
import "./styles.css";
import { awareness, roomID } from "./store";

function Editor({ roomId }: { roomId: string }) {
  const fileSystemEvents = useFileSystem();
  const { onMount, ...events } = useMultiplayerState(roomId);

  return (
    <Tldraw
      autofocus
      disableAssets
      showPages={false}
      onMount={onMount}
      {...fileSystemEvents}
      {...events}
    />
  );
}

function Info() {
  const users = useUsers(awareness);

  return (
    <div className="absolute p-md">
      <div className="flex space-between">
        <span>Number of connected users: {users.size}</span>
        <a
          className="color-dodgerblue"
          href="https://twitter.com/nayajunimesh"
          target="_blank"
          rel="noreferrer"
        >
          @nayajunimesh
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="tldraw">
      <Info />
      <Editor roomId={roomID} />
    </div>
  );
}
