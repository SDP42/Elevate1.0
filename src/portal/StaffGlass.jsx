import { Glass, GlassSystemProvider } from "open-glass-ui";
import "open-glass-ui/styles.css";

export default function StaffGlass({children,label}) {
  return <GlassSystemProvider renderer="auto" theme={{appearance:"dark"}} toasts={false}>
    <Glass material="frosted" className="portal-card staff-glass" look={{rim:1.2,blur:.85}}>
      <section aria-label={label}>{children}</section>
    </Glass>
  </GlassSystemProvider>;
}
