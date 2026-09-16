import "./App.css";
import Header from "./intro/Header";
import SkyBackdrop from "./components/SkyBackdrop";
import Intro from "./intro/Intro";
import "./intro/intro.css";
import "./sections.css";
import BoardingPass from "./components/BoardingPass";
import JetSection from "./intro/JetSection";
import Faq from "./components/Faq";
import Footer from "./components/Footer";
import BookFlight from "./components/BookFlight";
import SoundToggle from "./components/SoundToggle";
import {
  ScrollFlight,
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
        <BoardingPass />
        <Faq />
      </main>
      <Footer />
      <BookFlight />
      <SoundToggle />
      <FlyOver />
      <PlaneCursor />
    </>
  );
}
