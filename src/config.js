/* Drop the Unstop registration URL in here when it is live — every CTA on
   the site reads from this one constant. While it is empty, the buttons
   fall back to a "opening soon" state instead of linking nowhere. */
export const UNSTOP_URL = "https://unstop.com/o/PMU41BH";

export const EVENT = {
  name: "Elevate 1.0",
  format: "24-hour hackathon",
  dates: "10 & 11 October",
  organiser: "DJS NSDC",
  partner: "Infomatrix",
  department: "Department of Artificial Intelligence & Data Science",
  college: "Dwarkadas J. Sanghvi College of Engineering",
  city: "Mumbai",
};

export const registrationOpen = () => UNSTOP_URL.trim().length > 0;

export const ORGANISER = {
  name: "DJS NSDC",
  blurb:
    "Organised by DJS NSDC, the official NSDC Student Chapter of DJSCE's AI & DS department — a community that supports Data Science learners of all ages, backgrounds and skills.",
  instagram: "https://www.instagram.com/djs.nsdc/",
  linkedin: "https://www.linkedin.com/company/djs-nsdc/",
  handle: "@djs.nsdc",
};

// venue pin, for the footer's "Location" link
export const VENUE_MAP_URL = "https://maps.app.goo.gl/sNT9rcGjo4L1356UA?g_st=aw";

// gates open with registration and check-in on day one
export const EVENT_START = new Date("2026-10-10T09:00:00+05:30");

// registration fee per team, per round
export const FEES = {
  online: "₹200",
  offline: "₹1,500",
};

export const CONTACTS = [
  { name: "Vrindaa Talwar", phone: "+91 94192 53635", tel: "+919419253635" },
  { name: "Swayam Panchal", phone: "+91 98335 07492", tel: "+919833507492" },
  { name: "Samarth Bhirud", phone: "+91 84089 17498", tel: "+918408917498" },
];

// sponsors — shown on the back of the boarding pass, one row of tiles
export const SPONSORS = [
  {
    role: "Learning Partner",
    name: "CodeCrafters",
    url: "https://codecrafters.io/",
    logo: "/codecrafters-logo.svg",
  },
  {
    role: "Domain Partner",
    name: ".xyz",
    url: "https://gen.xyz/",
    logo: "/xyz-logo-purple.png",
  },
];
