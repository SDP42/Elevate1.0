import { useEffect, useId, useRef, useState } from 'react';
import { Glass, SdfFilterDefinition, getMaterialPreset, useGlassCapabilities, useSdfFilter } from 'open-glass-ui';

// Use the library's lens displacement on the backdrop, never on readable text.
export default function TeamLiquidGlass({ children, style, ...props }) {
  const surface = useRef(null);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [size, setSize] = useState({width:320,height:240});
  const capabilities = useGlassCapabilities();
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.round(entry.contentRect.width));
      const height = Math.max(1, Math.round(entry.contentRect.height));
      setSize(previous => previous.width===width && previous.height===height ? previous : {width,height});
    });
    if(surface.current) observer.observe(surface.current);
    return () => observer.disconnect();
  }, []);
  const filter = useSdfFilter({
    id:`team-lens-${id}`, ...size,
    geometry:{kind:'rounded-rect',...size,cornerRadius:22},
    material:{...getMaterialPreset('regular'),frost:.12,edgeStrength:1.2,thickness:.7},
    quality:'low',
  });
  const accessible = !capabilities.reducedTransparency && !capabilities.forcedColors;
  const refract = filter.ready && accessible && capabilities.backdropUrlSyntax && capabilities.svgFilterElements;
  const backdrop = refract ? `url(#${filter.filterId}) blur(7px) saturate(115%)` : 'blur(18px) saturate(115%)';
  return <Glass {...props} ref={surface} interactive renderer={refract ? 'sdf-svg' : 'css'}
    style={{background:accessible?'rgba(0,0,0,.80)':'#08090b',backdropFilter:accessible?backdrop:'none',WebkitBackdropFilter:accessible?backdrop:'none',...style}}>
    {refract && <SdfFilterDefinition filter={filter}/>}
    {children}
  </Glass>;
}
