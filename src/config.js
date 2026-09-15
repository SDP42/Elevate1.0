/* Drop the Unstop registration URL in here when it is live — every CTA on
   the site reads from this one constant. While it is empty, the buttons
   fall back to a "opening soon" state instead of linking nowhere. */
export const UNSTOP_URL = "";

export const EVENT = {
  name: "Elevate 1.0",
  format: "24-hour hackathon",
  dates: "10 & 11 October",
  organiser: "DJS NSDC",
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
  handle: "@djs.nsdc",
};

// gates open with registration and check-in on day one
export const EVENT_START = new Date("2026-10-10T09:00:00+05:30");
