'use client';

import { useMemo } from 'react';
import { MapPin } from 'lucide-react';

type Props = { latitude: number | string; longitude: number | string; className?: string };

export default function SchoolMapPreview({ latitude, longitude, className = '' }: Props) {
  const lat = Number(latitude), lon = Number(longitude), zoom = 15;
  const tiles = useMemo(() => {
    const n = 2 ** zoom;
    const x = (lon + 180) / 360 * n;
    const latRad = lat * Math.PI / 180;
    const y = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n;
    const cx = Math.floor(x), cy = Math.floor(y);
    const dx = (x - cx) * 256, dy = (y - cy) * 256;
    const result: { key: string; url: string; left: number; top: number }[] = [];
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      result.push({ key: ox + ':' + oy, url: 'https://tile.openstreetmap.org/' + zoom + '/' + (cx + ox) + '/' + (cy + oy) + '.png', left: 256 + ox * 256 - dx, top: 256 + oy * 256 - dy });
    }
    return result;
  }, [lat, lon]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return <div className={'grid min-h-40 place-items-center rounded-xl bg-slate-100 text-sm text-slate-500 ' + className}>No saved coordinates for this school.</div>;
  const mapUrl = 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=' + zoom + '/' + lat + '/' + lon;
  return <div className={'relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ' + className}>
    <a href={mapUrl} target="_blank" rel="noreferrer" aria-label="Open interactive OpenStreetMap" className="absolute inset-0 z-10 block">
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-md"><MapPin size={38} fill="#059669" color="white" strokeWidth={2.4}/></span>
      <span className="absolute bottom-2 right-2 rounded-lg bg-white/95 px-2 py-1 text-xs font-semibold text-slate-700 shadow">Open interactive map ↗</span>
    </a>
    <div className="relative h-72 overflow-hidden" aria-label="Map preview">
      {tiles.map(tile => <img key={tile.key} src={tile.url} alt="" loading="lazy" draggable={false} className="absolute h-64 w-64 max-w-none" style={{ left: tile.left, top: tile.top }} onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}/>)}
    </div>
    <div className="border-t bg-white px-3 py-2 text-xs text-slate-500">© OpenStreetMap contributors · Tap preview to open full map</div>
  </div>;
}
