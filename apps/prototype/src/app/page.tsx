import HomeMenu from "./HomeMenu";

// The landing home screen — a menu of options. "Play" leads to the territory
// game at /mapgame; the older base-game routes remain at /play, /rules, /wiki.
export default function Home() {
  return <HomeMenu />;
}
