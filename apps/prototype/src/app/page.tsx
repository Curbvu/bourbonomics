import MapGameClient from "../mapgame/ui/MapGameClient";

// The territory game (Map Game) is the mainline product — it lives at the apex
// root. The older base-game landing (MainMenu + rulebook) remains reachable at
// /play, /rules and /wiki; /mapgame also still renders this same client.
export default function Home() {
  return <MapGameClient />;
}
