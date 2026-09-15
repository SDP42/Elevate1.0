import "./App.css";
import Header from "./intro/Header";
import SkyBackdrop from "./components/SkyBackdrop";
import Intro from "./intro/Intro";
import "./intro/intro.css";
import "./sections.css";
import BoardingPass from "./components/BoardingPass";
import JetSection from "./intro/JetSection";
import SafetyCard from "./components/SafetyCard";
import Baggage from "./components/Baggage";
import RoutesMap from "./components/RoutesMap";
import Experience from "./components/Experience";
import Footer from "./components/Footer";
import BookFlight from "./components/BookFlight";
import SoundToggle from "./components/SoundToggle";
import CabinLab3D from "./components/CabinLab3D";
import {
  ScrollFlight,
  NowArriving,
  PlaneCursor,
  FlyOver,
  useRevealAll,
  useHoverTicks,
} from "./components/SiteChrome";

export default function App() {
  useRevealAll();
  useHoverTicks();

  return (
    <>
      <SkyBackdrop />
      <ScrollFlight />
      <Header />
      <main>
        <Intro />
        <JetSection />
        <RoutesMap />
        <BoardingPass />
        <CabinLab3D />
        <Experience />
        <SafetyCard />
        <Baggage />
      </main>
      <Footer />
      <BookFlight />
      <SoundToggle />
      <NowArriving />
      <FlyOver />
      <PlaneCursor />
    </>
  );
}
