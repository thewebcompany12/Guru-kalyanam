'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Map, School, ClipboardList, Package, Truck, IndianRupee, CheckSquare, BarChart3, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase';

const items = [
  ['/', 'Dashboard', BarChart3], ['/schools', 'Schools', School], ['/visits', 'Visits', CheckSquare],
  ['/map', 'Map', Map], ['/orders', 'Orders', ClipboardList], ['/templates', 'Templates'], ['/products', 'Products', Package],
  ['/inventory', 'Inventory', Package], ['/deliveries', 'Deliveries', Truck], ['/payments', 'Payments', IndianRupee],
];

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = async () => { await createClient().auth.signOut(); router.push('/login'); router.refresh(); };
  return <>
    <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r min-h-screen p-5 flex-col sticky top-0">
      <Link href="/" className="text-xl font-bold mb-8">School Supply <span className="text-emerald-600">Ops</span></Link>
      <nav className="space-y-1">{items.map(([href,label,Icon]: any) =>
        <Link key={href} href={href} className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ' + (pathname===href || (href!=='/' && pathname.startsWith(href)) ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50')}>
          <Icon size={18}/>{label}
        </Link>)}</nav>
      <button onClick={signOut} className="mt-auto flex items-center gap-3 px-3 py-2.5 text-sm text-slate-500"><LogOut size={18}/>Sign out</button>
    </aside>
    <div className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-bold">School Supply <span className="text-emerald-600">Ops</span></Link>
      <div className="flex gap-2 overflow-x-auto max-w-[70%]">{items.slice(0,6).map(([href,label]: any) => <Link key={href} href={href} className="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs">{label}</Link>)}</div>
    </div>
  </>;
}
