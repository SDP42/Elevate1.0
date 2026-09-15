import "./App.css";
import Nav from "./components/Nav";
import SkyBackdrop from "./components/SkyBackdrop";
import Hero from "./components/Hero";
import BoardingPass from "./components/BoardingPass";
import Rounds from "./components/Rounds";
import DepartureBoard from "./components/DepartureBoard";
import PrizeFleet from "./components/PrizeFleet";
import PrizeBoard from "./components/PrizeBoard";
import StatsBar from "./components/StatsBar";
import Tracks from "./components/Tracks";
import SafetyCard from "./components/SafetyCard";
import Baggage from "./components/Baggage";
import InstrumentPanel from "./components/InstrumentPanel";
import SeatMap from "./components/SeatMap";
import Timeline from "./components/Timeline";
import RoutesMap from "./components/RoutesMap";
import Experience from "./components/Experience";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import BookFlight from "./components/BookFlight";
import SoundToggle from "./components/SoundToggle";
import Preloader from "./components/Preloader";
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
      <Preloader />
      <SkyBackdrop />
      <ScrollFlight />
      <Nav />
      <main>
        <Hero />
        <CabinLab3D />
        <BoardingPass />
        <Rounds />
        <DepartureBoard />
        <PrizeFleet />
        <PrizeBoard />
        <StatsBar />
        <InstrumentPanel />
        <Tracks />
        <Timeline />
        <SafetyCard />
        <Baggage />
        <RoutesMap />
        <Experience />
        <SeatMap />
        <Contact />
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
