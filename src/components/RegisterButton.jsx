import { UNSTOP_URL, registrationOpen } from "../config";

export default function RegisterButton({ className = "", children }) {
  const label = children ?? "Register on Unstop";

  if (!registrationOpen()) {
    return (
      <button className={className} disabled title="Unstop link coming soon">
        Registration opening soon
      </button>
    );
  }

  return (
    <a
      className={className}
      href={UNSTOP_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}
