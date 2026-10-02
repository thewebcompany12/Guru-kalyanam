'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { School, LayoutDashboard, ClipboardList, IndianRupee, BarChart3, ListTodo, Bell, Users, Package, Truck, PackageCheck, WalletCards, Settings, MapPin, FileText, TrendingUp, AlertTriangle, CalendarClock, Boxes, CheckSquare, MessageCircle, X, ChevronRight, Plus, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import GlobalSearch from '@/components/GlobalSearch';

const items = [
  ['/', 'Dashboard', LayoutDashboard], ['/work-queue', 'Work queue', ListTodo],
  ['/schools', 'Schools', School], ['/contacts', 'Contacts', Users], ['/visits', 'Visits', CheckSquare], ['/follow-ups', 'Follow-ups', CalendarClock], ['/map', 'Field map', MapPin],
  ['/orders', 'Orders', ClipboardList], ['/order-fulfilment', 'Order fulfilment monitor', Truck], ['/pipeline', 'Sales pipeline', TrendingUp], ['/templates', 'Order templates', FileText],
  ['/products', 'Products', Package], ['/inventory', 'Inventory', Boxes], ['/stock-movements', 'Stock movement ledger', Boxes], ['/suppliers', 'Suppliers', Users], ['/purchases', 'Purchases', Truck], ['/purchase-receiving', 'Purchase receiving tracker', PackageCheck], ['/procurement-cost-insights', 'Procurement cost insights', BarChart3],
  ['/receivables', 'School receivables', AlertTriangle], ['/statements', 'School statements', FileText], ['/supplier-payments', 'Supplier payments', WalletCards], ['/supplier-payment-vouchers', 'Supplier payment vouchers', FileText],
  ['/supplier-statements', 'Supplier statements', FileText], ['/supplier-performance', 'Supplier performance', TrendingUp], ['/expenses', 'Expenses', WalletCards],
  ['/deliveries', 'Deliveries', Truck], ['/payments', 'Payments', IndianRupee], ['/payment-receipts', 'Payment receipts', FileText], ['/invoices', 'GST invoices', FileText],
  ['/whatsapp', 'WhatsApp', MessageCircle], ['/reminders', 'Reminders', CheckSquare], ['/tasks', 'Tasks', CheckSquare], ['/notifications', 'Notifications', Bell],
  ['/reports', 'Reports', BarChart3], ['/school-collection-performance', 'School collection performance', TrendingUp], ['/insights', 'Monthly insights', TrendingUp], ['/timeline', 'Timeline', ClipboardList], ['/settings', 'Settings', Settings],
] as const;
const groups:[string,string[]][]=[
 ['OVERVIEW',['/','/work-queue']],['FIELD OPERATIONS',['/schools','/contacts','/visits','/follow-ups','/map']],
 ['SALES & ORDERS',['/orders','/order-fulfilment','/pipeline','/templates']],['CATALOG & SUPPLIERS',['/products','/inventory','/stock-movements','/suppliers','/purchases','/purchase-receiving']],
 ['MONEY & FULFILMENT',['/receivables','/statements','/supplier-payments','/supplier-payment-vouchers','/supplier-statements','/supplier-performance','/expenses','/deliveries','/payments','/invoices']],
 ['COMMUNICATION & TASKS',['/contacts','/whatsapp','/reminders','/tasks','/notifications']],['INSIGHTS & SETTINGS',['/reports','/insights','/timeline','/settings']]
];
const mobileItems=[['/','Home',LayoutDashboard],['/schools','Schools',School],['/orders','Orders',ClipboardList],['/payments','Money',IndianRupee],['/reports','Reports',BarChart3],['/work-queue','More',ListTodo]] as const;

export default function AppNav(){
 const pathname=usePathname();
 const [menuOpen,setMenuOpen]=useState(false);
 const activeFor=(href:string)=>pathname===href||(href!=='/'&&pathname.startsWith(href));
 return <>
  <aside className="app-desktop-nav">
   <Link href="/" className="brand-mark"><span className="brand-logo"><School size={21}/></span><span><b>Guru Kalyanam</b><small>School Supply Workspace</small></span></Link>
   <div className="nav-search"><GlobalSearch/></div>
   <div className="sidebar-quick-actions"><Link href="/orders" className="sidebar-primary-action"><Plus size={17}/><span>New order</span><ArrowUpRight size={15}/></Link><Link href="/payments" className="sidebar-secondary-action"><IndianRupee size={16}/><span>Record payment</span></Link></div>
   <div className="nav-section-heading"><span className="nav-label">YOUR WORKSPACE</span><span className="nav-count">{items.length}</span></div>
   <nav className="nav-list">{groups.map(([group,hrefs])=><section key={group} className="nav-group"><div className="nav-group-label">{group}</div>{items.filter(([href])=>hrefs.includes(href)).map(([href,label,Icon])=>{const active=activeFor(href);return <Link key={href} href={href} aria-current={active?'page':undefined} className={['nav-item',active?'nav-item-active':''].join(' ')}><span className="nav-item-icon"><Icon size={18}/></span><span className="nav-item-label">{label}</span>{active&&<ChevronRight className="nav-chevron" size={15}/>}</Link>})}</section>)}</nav>
   <div className="workspace-badge"><span className="workspace-dot"/><span><b>Workspace ready</b><small>All your operations, together</small></span></div>
  </aside>
  <header className="app-mobile-nav">
   <div className="mobile-topline">
    <Link href="/" className="mobile-brand"><span className="brand-logo"><School size={20}/></span><span><b>Guru Kalyanam</b><small>School Supply Workspace</small></span></Link>
    <div className="mobile-head-actions"><Link href="/notifications" className="mobile-notification" aria-label="Notifications"><Bell size={20}/></Link><button type="button" className="mobile-menu-button" onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen} aria-label={menuOpen?'Close navigation':'Open navigation'}>{menuOpen?<X size={21}/>:<span className="mobile-menu-dots">•••</span>}</button></div>
   </div>
   <div className="mobile-search"><GlobalSearch/></div>
  </header>
  {menuOpen&&<><button className="mobile-menu-backdrop" aria-label="Close navigation menu" onClick={()=>setMenuOpen(false)}/><nav className="mobile-menu-panel" aria-label="All app sections"><div className="mobile-menu-heading"><span>All sections</span><button type="button" onClick={()=>setMenuOpen(false)} aria-label="Close menu"><X size={19}/></button></div>{groups.map(([group,hrefs])=><section key={group}><div className="mobile-menu-group">{group}</div>{items.filter(([href])=>hrefs.includes(href)).map(([href,label,Icon])=><Link key={href} href={href} onClick={()=>setMenuOpen(false)} className={['mobile-menu-link',activeFor(href)?'mobile-menu-link-active':''].join(' ')}><Icon size={18}/><span>{label}</span><ChevronRight size={15}/></Link>)}</section>)}</nav></>}
  <nav className="mobile-bottom-nav" aria-label="Main navigation">{mobileItems.map(([href,label,Icon])=>{const active=activeFor(href);return <Link key={href} href={href} aria-current={active?'page':undefined} className={['mobile-dock-item',active?'mobile-dock-active':''].join(' ')}><span className="mobile-dock-icon"><Icon size={21} strokeWidth={active?2.5:2}/></span><span>{label}</span></Link>})}</nav>
 </>;
}
