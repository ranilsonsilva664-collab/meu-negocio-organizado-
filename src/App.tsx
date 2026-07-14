import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "./utils/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { AdminPanel } from "./AdminPanel";

type ID = string;

type Transaction = {
  id: ID;
  type: "entrada" | "saida";
  amount: number;
  category: string;
  description: string;
  date: string;
  paymentMethod?: string;
};

type Product = {
  id: ID;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  sku?: string;
};

type Client = {
  id: ID;
  name: string;
  phone: string;
  email: string;
  notes?: string;
  totalSpent: number;
  orderCount: number;
  lastPurchase?: string;
};

type SaleItem = { productId: ID; qty: number; unitPrice: number };
type Sale = { id: ID; date: string; clientId?: ID; items: SaleItem[]; total: number; };

type Goal = {
  monthlyRevenue: number;
  annualRevenue: number;
  monthlyProfit: number;
  monthlySales: number;
};

type BusinessSettings = {
  companyName: string;
  segment: string;
  cnpj?: string;
  phone?: string;
  address?: string;
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactBRL = (n:number) => n >= 1000 ? `R$ ${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : BRL.format(n);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const uid = () => Math.random().toString(36).slice(2,9);

const SEED_PRODUCTS: Product[] = [];
const SEED_CLIENTS: Client[] = [];
const SEED_TRANSACTIONS: Transaction[] = [];
const SEED_SALES: Sale[] = [];



function useLocalState<T>(uid: string, key:string, initial: T){
  const [state, setState] = useState<T>(initial);

  useEffect(() => {
    if (!uid) return;
    const docRef = doc(db, "mno_data", `${uid}_${key}`);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setState(docSnap.data().value as T);
      } else {
        setDoc(docRef, { value: initial }).catch(()=>{});
        setState(initial);
      }
    });
    return () => unsubscribe();
  }, [uid, key]); 

  const setFirebaseState = (newValueOrFunction: any) => {
    if (!uid) return;
    setState((prev: any) => {
      const newValue = typeof newValueOrFunction === "function" ? newValueOrFunction(prev) : newValueOrFunction;
      setDoc(doc(db, "mno_data", `${uid}_${key}`), { value: newValue }).catch(console.error);
      return newValue;
    });
  };

  return [state, setFirebaseState] as const;
}

const SEGMENTS = [
  {label:"Hamburgueria", icon:"🍔"},
  {label:"Açaiteria", icon:"💜"},
  {label:"Pizzaria", icon:"🍕"},
  {label:"Lanchonete", icon:"🥪"},
  {label:"Salão", icon:"💇‍♀️"},
  {label:"Barbearia", icon:"✂️"},
  {label:"Loja de Roupas", icon:"👕"},
  {label:"Outro comércio", icon:"🏪"},
];

const categories = ["Vendas","Serviços","Insumos","Marketing","Embalagens","Aluguel","Funcionários","Impostos","Outros"];

function useThemeState() {
  const [theme, setTheme] = useState<"light"|"dark">((localStorage.getItem("mno_theme") as "light"|"dark") || "light");
  const update = (t: "light"|"dark") => {
    localStorage.setItem("mno_theme", t);
    setTheme(t);
  };
  return [theme, update] as const;
}

export function MainApp({ uid, onLogout, theme, setTheme }: { uid: string, onLogout: ()=>void, theme: "light"|"dark", setTheme: (t:"light"|"dark")=>void }){
  const [settings, setSettings] = useLocalState<BusinessSettings>(uid, "mno_settings_v1", {
    companyName: "Sabor Urbano Grill",
    segment: "Hamburgueria",
  });

  const [products, setProducts] = useLocalState<Product[]>(uid, "mno_products_v2", SEED_PRODUCTS);
  const [clients, setClients] = useLocalState<Client[]>(uid, "mno_clients_v2", SEED_CLIENTS);
  const [transactions, setTransactions] = useLocalState<Transaction[]>(uid, "mno_tx_v2", SEED_TRANSACTIONS);
  const [sales, setSales] = useLocalState<Sale[]>(uid, "mno_sales_v2", SEED_SALES);
  const [goals, setGoals] = useLocalState<Goal>(uid, "mno_goals_v1", {
    monthlyRevenue: 24000,
    annualRevenue: 320000,
    monthlyProfit: 7000,
    monthlySales: 420,
  });

  const [route, setRoute] = useState<"dashboard"|"vendas"|"financeiro"|"produtos"|"estoque"|"clientes"|"metas"|"config">("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(()=>{
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return (
    <div className={`min-h-screen font-[Plus_Jakarta_Sans] ${
      theme === "dark" ? "bg-[#0b111d] text-zinc-100" : "bg-[#f7f9fd] text-zinc-900"
    }`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif; }
        .soft-shadow { box-shadow: 0 12px 40px rgba(18, 38, 63, .08); }
        .card-border { border: 1px solid ${theme==="dark" ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.08)"}; }
        .glass { backdrop-filter: blur(10px); }
        ::-webkit-scrollbar { width: 10px; height:10px; }
        ::-webkit-scrollbar-thumb { background: rgba(37,99,235,.35); border-radius: 999px; }
        .hide-scrollbar::-webkit-scrollbar{ display: none;}
        .hide-scrollbar{ -ms-overflow-style:none; scrollbar-width:none;}
      `}</style>

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className={`hidden lg:flex w-[270px] shrink-0 flex-col ${theme==="dark" ? "bg-[#0e1624] border-white/[.07]" : "bg-white border-zinc-200"} border-r sticky top-0 h-screen`}>
          <div className="px-6 pt-7 pb-6">
            <div className="flex items-center">
              <img src="https://res.cloudinary.com/dmxeqe939/image/upload/v1784040120/ChatGPT_Image_14_de_jul._de_2026_11_41_04_c91pag.png" alt="Logo" className="h-12 w-auto object-contain rounded-xl" />
            </div>

          </div>
          <nav className="px-3 space-y-1">
            {[
              {key:"dashboard", label:"Dashboard", icon: "🏠"},
              {key:"vendas", label:"Caixa (PDV)", icon: "🛒"},
              {key:"financeiro", label:"Financeiro", icon: "💰"},
              {key:"produtos", label:"Produtos", icon: "📦"},
              {key:"estoque", label:"Estoque", icon: "📊"},
              {key:"clientes", label:"Clientes", icon: "👥"},
              {key:"metas", label:"Metas", icon: "🎯"},
              {key:"config", label:"Configurações", icon: "⚙️"},
            ].map((i:any)=>(
              <button key={i.key} onClick={()=>setRoute(i.key)}
                className={`w-full flex items-center gap-3 px-3 py-[11px] rounded-xl text-[14.5px] transition
                ${route===i.key
                  ? (theme==="dark" ? "bg-[#142034] text-white" : "bg-[#eef4ff] text-[#1e42b8]")
                  : (theme==="dark" ? "hover:bg-white/[.05] text-zinc-300" : "hover:bg-zinc-50 text-zinc-700")}
                `}>
                <span className="text-[18px] w-6 text-center">{i.icon}</span>
                <span className="font-[600]">{i.label}</span>
              </button>
            ))}
          </nav>
          <div className={`mt-auto p-4 border-t ${theme==="dark"?"border-white/[.06]":"border-zinc-200"}`}>
            <div className={`rounded-2xl p-4 card-border soft-shadow ${theme==="dark"?"bg-[#0c1423]":"bg-[#f9fbff]"}`}>
              <div className="text-[11px] text-zinc-500 font-[600]">Seu segmento</div>
              <div className="mt-1 font-[700]">{settings.segment}</div>
              <div className={`mt-2 text-[12px] ${theme==="dark"?"text-zinc-400":"text-zinc-600"}`}>{settings.companyName}</div>
            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-[12px] text-zinc-500">Tema</span>
              <button onClick={()=>setTheme(theme==="light"?"dark":"light")}
                className={`px-3 py-1.5 rounded-full text-[11.5px] font-[700] border transition ${theme==="dark" ? "border-white/[.12] hover:bg-white/[.06]":"border-zinc-300 hover:bg-zinc-50"}`}>
                {theme==="light" ? "🌙 Escuro" : "☀️ Claro"}
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Top bar */}
          <header className={`sticky top-0 z-30 ${theme==="dark"?"bg-[#0b111d]/88 border-white/[.07]":"bg-[#f7f9fd]/88 border-zinc-200"} border-b glass`}>
            <div className="px-4 sm:px-7 h-[68px] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button className="lg:hidden px-3 py-2 rounded-xl border text-[13px] font-[600]"
                  onClick={()=>setMobileNavOpen(true)}>
                  ☰ Menu
                </button>
                <div>
                  <div className="text-[12px] text-zinc-500">Bem-vindo(a) de volta</div>
                  <div className="text-[17px] sm:text-[18px] font-[800] tracking-[-0.011em]">
                    {settings.companyName}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">

                <button onClick={onLogout}
                  className="px-3 sm:px-4 py-2 rounded-xl text-[13px] font-[700] bg-[#2563EB] text-white hover:bg-[#1d4fd6] transition">
                  Sair
                </button>
              </div>
            </div>
          </header>

          <div className="px-4 sm:px-7 lg:px-9 py-6 sm:py-9 space-y-8">
            {route==="vendas" && (
              <PdvView
                theme={theme}
                products={products}
                clients={clients}
                setProducts={setProducts}
                setTransactions={setTransactions}
                setSales={setSales}
                setClients={setClients}
              />
            )}
            {route==="dashboard" && (
              <DashboardView
                theme={theme}
                products={products}
                sales={sales}
                clients={clients}
                transactions={transactions}
              />
            )}
            {route==="financeiro" && (
              <FinanceiroView
                theme={theme}
                transactions={transactions}
                setTransactions={setTransactions}
              />
            )}
            {route==="produtos" && (
              <ProdutosView
                theme={theme}
                products={products}
                setProducts={setProducts}
                sales={sales}
              />
            )}
            {route==="estoque" && (
              <EstoqueView
                theme={theme}
                products={products}
                setProducts={setProducts}
              />
            )}
            {route==="clientes" && (
              <ClientesView
                theme={theme}
                clients={clients}
                setClients={setClients}
              />
            )}
            {route==="metas" && (
              <MetasView
                theme={theme}
                goals={goals}
                setGoals={setGoals}
                sales={sales}
                transactions={transactions}
              />
            )}
            {route==="config" && (
              <ConfigView
                theme={theme}
                setTheme={setTheme}
                settings={settings}
                setSettings={setSettings}
              />
            )}
          </div>

          <footer className={`px-4 sm:px-7 lg:px-9 pb-10 text-[12px] ${theme==="dark"?"text-zinc-500":"text-zinc-500"}`}>
            Meu Negócio Organizado — Sistema para pequenos negócios. Dados salvos em nuvem para sua segurança.
          </footer>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setMobileNavOpen(false)} />
          <div className={`absolute top-0 left-0 w-[300px] h-[100dvh] ${theme==="dark"?"bg-[#0e1624]":"bg-white"} shadow-xl p-4 overflow-y-auto pb-12`}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-[800]">Menu</div>
              <button onClick={()=>setMobileNavOpen(false)} className="text-sm px-3 py-1.5 rounded-lg border">Fechar</button>
            </div>
            <div className="space-y-1">
              {[
                {key:"dashboard", label:"Dashboard", icon: "🏠"},
                {key:"vendas", label:"Caixa (PDV)", icon: "🛒"},
                {key:"financeiro", label:"Financeiro", icon: "💰"},
                {key:"produtos", label:"Produtos", icon: "📦"},
                {key:"estoque", label:"Estoque", icon: "📊"},
                {key:"clientes", label:"Clientes", icon: "👥"},
                {key:"metas", label:"Metas", icon: "🎯"},
                {key:"config", label:"Configurações", icon: "⚙️"},
              ].map((i:any) => (
                <button key={i.key} onClick={()=>{ setRoute(i.key); setMobileNavOpen(false);}}
                  className={`w-full flex items-center gap-3 px-3 py-[11px] rounded-xl text-[14.5px] ${route===i.key ? (theme==="dark"?"bg-[#142034] text-white":"bg-[#eef4ff] text-[#1d41b2]") : ""}`}>
                  <span className="w-6 text-center">{i.icon}</span><span className="font-[600]">{i.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function LoginScreen({ theme, setTheme }:{ theme:"light"|"dark"; setTheme:(t:"light"|"dark")=>void}){
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  const handleLogin = async () => {
    if (!email || !pass) return;
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e: any) {
      setError("Email ou senha incorretos.");
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${theme==="dark" ? "bg-[#0b111d] text-zinc-100" : "bg-[#f2f5fb] text-zinc-900"}`} 
      style={{ fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full blur-3xl opacity-[.16]" style={{background:"radial-gradient(60% 60% at 50% 50%, #2563EB, transparent)"}}/>
        <div className="absolute -bottom-32 -left-24 w-[520px] h-[520px] rounded-full blur-3xl opacity-[.14]" style={{background:"radial-gradient(60% 60% at 50% 50%, #22C55E, transparent)"}}/>
      </div>
      <div className={`relative w-full max-w-[980px] mx-4 grid grid-cols-1 lg:grid-cols-2 gap-6`}>
        <div className={`hidden lg:flex flex-col justify-between rounded-[28px] p-10 card-border soft-shadow ${theme==="dark"?"bg-[#0f1829]":"bg-white"}`}>
          <div>
            <div className="flex items-center mb-5">
              <img src="https://res.cloudinary.com/dmxeqe939/image/upload/v1784040120/ChatGPT_Image_14_de_jul._de_2026_11_41_04_c91pag.png" alt="Logo" className="h-16 w-auto object-contain rounded-xl" />
            </div>
            <p className={`${theme==="dark"?"text-zinc-300":"text-zinc-600"} text-[15px] leading-relaxed`}>
              O sistema para hamburguerias, açaiterias, pizzarias, lanchonetes, salões, barbearias e pequenos comércios crescerem com organização financeira real.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-7">
              {[
                {k:"Faturamento do Mês", v:"R$ 21.430"},
                {k:"Lucro do Mês", v:"R$ 7.820"},
                {k:"Vendas", v:"+312"},
                {k:"Crescimento", v:"+17,4%"},
              ].map(i=>(
                <div key={i.k} className={`rounded-2xl p-4 card-border ${theme==="dark"?"bg-[#0c1424]":"bg-[#f7f9fe]"}`}>
                  <div className="text-[11px] text-zinc-500 font-[600]">{i.k}</div>
                  <div className="text-[18px] font-[800] mt-1">{i.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[12px] text-zinc-500">Visual premium • Multi-Tenant • Dados em Nuvem</div>
        </div>

        <div className={`rounded-[28px] card-border soft-shadow ${theme==="dark"?"bg-[#0f1829]":"bg-white"} p-6 sm:p-9`}>
          <div className="flex items-center justify-between">
            <div className="text-[22px] font-[800] tracking-[-0.012em]">Entrar</div>
            <button onClick={()=>setTheme(theme==="light"?"dark":"light")}
              className="text-[12px] px-3 py-1.5 rounded-full border border-zinc-300/70">
              {theme==="light"?"🌙 escuro":"☀️ claro"}
            </button>
          </div>
          <p className={`mt-2 text-[13.5px] ${theme==="dark"?"text-zinc-400":"text-zinc-600"}`}>
            Acesse a sua conta exclusiva.
          </p>

          {(!isStandalone && (installPrompt || isIos)) && (
            <div className={`mt-4 p-4 rounded-xl border flex flex-col gap-3 ${theme==="dark"?"bg-[#142036] border-[#2b3e66]":"bg-[#eff4ff] border-[#bfd3ff]"}`}>
              <div className="flex items-center gap-3">
                <img src="https://res.cloudinary.com/dmxeqe939/image/upload/v1784040120/ChatGPT_Image_14_de_jul._de_2026_11_41_04_c91pag.png" alt="Logo" className="h-10 w-auto object-contain shrink-0 rounded-xl" />
                <div>
                  <div className="font-[800] text-[14px]">Instale o App</div>
                  <div className="text-[12px] opacity-80 leading-tight">
                    {isIos ? "Para instalar no iPhone, toque em Compartilhar no Safari e 'Adicionar à Tela de Início'." : "Adicione à tela inicial para acesso rápido e experiência de aplicativo nativo."}
                  </div>
                </div>
              </div>
              {!isIos && installPrompt && (
                <button onClick={handleInstall} className="w-full py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-[13px] font-[700] rounded-lg transition">
                  Instalar Aplicativo
                </button>
              )}
            </div>
          )}

          <div className="mt-7 space-y-4">
            {error && <div className="text-red-500 text-sm font-bold bg-red-100 p-3 rounded-xl">{error}</div>}
            <div>
              <label className="text-[12px] font-[600] text-zinc-500">E-mail</label>
              <input value={email} onChange={e=>setEmail(e.target.value)}
                className={`mt-1 w-full rounded-xl px-4 py-3 text-[15px] outline-none card-border ${theme==="dark" ? "bg-[#0d1424] text-zinc-100 placeholder-zinc-500" : "bg-white"} focus:ring-4 focus:ring-[#2563eb]/15`} 
                placeholder="voce@negocio.com" />
            </div>
            <div>
              <label className="text-[12px] font-[600] text-zinc-500">Senha</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className={`mt-1 w-full rounded-xl px-4 py-3 text-[15px] outline-none card-border ${theme==="dark" ? "bg-[#0d1424] text-zinc-100" : "bg-white"} focus:ring-4 focus:ring-[#2563eb]/15`}
                placeholder="••••••••" />
            </div>
            <button
              disabled={loading}
              onClick={handleLogin}
              className="w-full mt-4 bg-[#2563EB] hover:bg-[#1e4fd4] text-white py-3.5 rounded-xl font-[800] tracking-[-0.01em] text-[15px] transition shadow-lg shadow-blue-600/20"
            >
              {loading ? "Entrando..." : "Entrar no meu negócio"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6 text-center">
            {[
              ["Hamburgueria","🍔"],
              ["Açaiteria","💜"],
              ["Pizzaria","🍕"],
              ["Lanchonete","🥪"],
              ["Salão/Barbearia","✂️"],
              ["Roupas/Comércio","👕"],
            ].map(([l,ic])=>(
              <div key={l} className={`py-2.5 rounded-xl card-border text-[12px] ${theme==="dark"?"bg-[#0c1424]":"bg-[#f7f9fe]"}`}>
                <div className="text-[18px]">{ic}</div>
                <div className="mt-1 font-[600]">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* DASHBOARD */

function DashboardView({ theme, products, sales, clients, transactions }:{
  theme:"light"|"dark"; products:Product[]; sales:Sale[]; clients:Client[]; transactions:Transaction[];
}){
  // KPI
  const now = new Date();
  const todayStr = todayISO();
  const monthStr = todayStr.slice(0,7);

  const salesToday = transactions.filter(t=>t.date===todayStr && t.type==="entrada").reduce((a,t)=>a+t.amount,0);
  const salesMonth = transactions.filter(t=>t.date.startsWith(monthStr) && t.type==="entrada").reduce((a,t)=>a+t.amount,0);

  const receitasMes = transactions.filter(t=>t.date.startsWith(monthStr) && t.type==="entrada").reduce((a,t)=>a+t.amount,0);
  const despesasMes = transactions.filter(t=>t.date.startsWith(monthStr) && t.type==="saida").reduce((a,t)=>a+t.amount,0);
  const lucroMes = receitasMes - despesasMes;

  const receitasHoje = transactions.filter(t=>t.date===todayStr && t.type==="entrada").reduce((a,t)=>a+t.amount,0);
  const despesasHoje = transactions.filter(t=>t.date===todayStr && t.type==="saida").reduce((a,t)=>a+t.amount,0);
  const lucroHoje = receitasHoje - despesasHoje;

  const vendasCountMes = transactions.filter(t=>t.date.startsWith(monthStr) && t.type==="entrada").length;

  const lastMonthSales = (() => {
    const prev = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const key = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,"0")}`;
    return transactions.filter(t=>t.date.startsWith(key) && t.type==="entrada").reduce((a,t)=>a+t.amount,0);
  })();

  const growthPct = lastMonthSales>0 ? ((salesMonth-lastMonthSales)/lastMonthSales*100) : 0;

  // charts
  const last30Days = Array.from({length: 30}).map((_,i)=>{
    const d = new Date();
    d.setDate(d.getDate() - (29-i));
    const iso = d.toISOString().slice(0,10);
    const total = transactions.filter(t=>t.date===iso && t.type==="entrada").reduce((a,t)=>a+t.amount,0);
    return { day: d.toLocaleDateString("pt-BR", { day: "2-digit", month:"2-digit"}), vendas: +total.toFixed(0) };
  });

  const lucroEvo = (() => {
    // build last 12 weeks profit
    const weeks: { name:string; lucro:number }[] = [];
    for(let w=11; w>=0; w--){
      const start = new Date(); start.setDate(start.getDate() - (w*7+6));
      const end = new Date(); end.setDate(end.getDate() - (w*7));
      const inRange = (iso:string)=>{
        const t = new Date(iso).getTime();
        return t>=start.getTime() && t<=end.getTime();
      };
      const rec = transactions.filter(t=>inRange(t.date)&&t.type==="entrada").reduce((a,t)=>a+t.amount,0);
      const desp = transactions.filter(t=>inRange(t.date)&&t.type==="saida").reduce((a,t)=>a+t.amount,0);
      weeks.push({ name: `Sem ${12-w}`, lucro: Math.max(0, rec-desp) });
    }
    return weeks;
  })();

  // top products
  const prodMap = new Map(products.map(p=>[p.id, p]));
  const prodSales = new Map<string, {qty:number, revenue:number, name:string}>();
  sales.forEach(s=>{
    s.items.forEach(i=>{
      const cur = prodSales.get(i.productId) || { qty:0, revenue:0, name: prodMap.get(i.productId)?.name || i.productId };
      cur.qty += i.qty; cur.revenue += i.qty*i.unitPrice;
      prodSales.set(i.productId, cur);
    });
  });
  const topProducts = Array.from(prodSales.entries()).map(([id,v])=>({id, ...v})).sort((a,b)=>b.qty-a.qty).slice(0,5);

  // insights
  const mostProfitable = products.length > 0 ? products
    .map(p=>({ ...p, lucro: +(p.price-p.cost).toFixed(2), margem: p.cost>0 ? Math.round((p.price-p.cost)/p.price*100) : 0}))
    .sort((a,b)=>b.lucro-a.lucro)[0] : null;

  const bestDay = (() => {
    const agg = new Map<string, number>();
    transactions.filter(t=>t.type==="entrada").forEach(t=>agg.set(t.date, (agg.get(t.date)||0)+t.amount));
    let best = { date:"", total:0 };
    agg.forEach((v,k)=>{ if(v>best.total) best={date:k,total:v};});
    return best;
  })();

  return (
    <div className="space-y-8">
      {/* growth callout */}
      <div className={`rounded-[22px] card-border soft-shadow px-5 sm:px-7 py-5 flex items-center justify-between ${theme==="dark" ? "bg-[#0e1626]" : "bg-white"}`}>
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-[#e9fbef] text-[#14854a] px-3 py-2 font-[800] text-[12px]">+{growthPct.toFixed(1).replace(".",",")}%</div>
          <div>
            <div className="text-[15.5px] sm:text-[17px] font-[800] tracking-[-0.01em]">Seu negócio cresceu {growthPct.toFixed(1).replace(".",",")}% este mês.</div>
            <div className={`text-[13px] ${theme==="dark"?"text-zinc-400":"text-zinc-600"}`}>Continue acelerando com combos estratégicos e divulgação local.</div>
          </div>
        </div>

      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <KpiCard theme={theme} label="Faturamento do Dia" value={BRL.format(salesToday)} sub="Hoje" tone="blue" />
        <KpiCard theme={theme} label="Lucro do Dia" value={BRL.format(lucroHoje)} sub="Receitas - Despesas" tone="green" />
        <KpiCard theme={theme} label="Faturamento do Mês" value={BRL.format(salesMonth)} sub={`${monthStr.slice(5,7)}/${monthStr.slice(0,4)}`} tone="blue" />
        <KpiCard theme={theme} label="Lucro do Mês" value={BRL.format(lucroMes)} sub="Receitas - Despesas" tone="green" />
        <KpiCard theme={theme} label="Vendas (mês)" value={`${vendasCountMes}`} sub="Lançamentos" tone="default" />
        <KpiCard theme={theme} label="Clientes cadastrados" value={`${clients.length}`} sub="Base ativa" tone="default" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className={`xl:col-span-2 rounded-[22px] card-border soft-shadow p-5 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-[800]">Vendas dos últimos 30 dias</div>
            <div className="text-[12px] text-zinc-500">Atualizado em tempo real</div>
          </div>
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last30Days} margin={{ left:-10, right:10, top:10, bottom:0}}>
                <defs>
                  <linearGradient id="saleG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme==="dark"?"#243049":"#e6e9f2"} vertical={false}/>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: theme==="dark"?"#9aa6bf":"#5b6b88" }}/>
                <YAxis tickFormatter={(v)=> compactBRL(v)} tick={{ fontSize: 11, fill: theme==="dark"?"#9aa6bf":"#5b6b88"}}/>
                <Tooltip formatter={(v:any)=>BRL.format(Number(v))} />
                <Area type="monotone" dataKey="vendas" stroke="#2563EB" strokeWidth={2.3} fill="url(#saleG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`rounded-[22px] card-border soft-shadow p-5 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
          <div className="font-[800] mb-3">Evolução do lucro</div>
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lucroEvo}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme==="dark"?"#243049":"#e6e9f2"} vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme==="dark"?"#9aa6bf":"#5b6b88" }}/>
                <YAxis tickFormatter={(v)=> compactBRL(v)} tick={{ fontSize: 11, fill: theme==="dark"?"#9aa6bf":"#5b6b88"}}/>
                <Tooltip formatter={(v:any)=>BRL.format(Number(v))}/>
                <Bar dataKey="lucro" radius={[8,8,0,0]} fill="#22C55E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top products + Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className={`xl:col-span-2 rounded-[22px] card-border soft-shadow p-5 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
          <div className="flex items-center justify-between">
            <div className="font-[800]">Produtos mais vendidos</div>
            <div className="text-[12px] text-zinc-500">Últimos 30 dias</div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {topProducts.map(tp=>(
              <div key={tp.id} className={`rounded-xl px-4 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-[#fbfcff]"}`}>
                <div className="text-[13px] text-zinc-500">#{tp.id}</div>
                <div className="font-[700] text-[15px] line-clamp-1">{tp.name}</div>
                <div className="flex items-center justify-between mt-2 text-[13px]">
                  <span className="text-zinc-500">Qtd vendida</span>
                  <span className="font-[800]">{tp.qty}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-zinc-500">Receita</span>
                  <span className="font-[700] text-[#2563EB]">{BRL.format(tp.revenue)}</span>
                </div>
              </div>
            ))}
            {topProducts.length===0 && <div className="text-sm text-zinc-500">Sem vendas registradas ainda.</div>}
          </div>
        </div>

        <div className={`rounded-[22px] card-border soft-shadow p-5 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
          <div className="font-[800] mb-2">Insights do Negócio</div>
          <div className="space-y-3 mt-3">
            <InsightPill label="Mais lucrativo" value={`${mostProfitable?.name || "-"}`} sub={`Lucro/unid: ${mostProfitable ? BRL.format(mostProfitable.lucro) : "-"}`} />
            <InsightPill label="Mais vendido" value={topProducts[0]?.name || "-"} sub={topProducts[0] ? `${topProducts[0].qty} unid · ${BRL.format(topProducts[0].revenue)}` : "-"} />
            <InsightPill label="Melhor dia" value={bestDay.date ? new Date(bestDay.date+"T12:00").toLocaleDateString("pt-BR") : "-"} sub={BRL.format(bestDay.total)} />
            <InsightPill label="Média diária" value={BRL.format(salesMonth/ Math.max(1, new Date().getDate()))} sub="Faturamento médio/mês atual" />
            <InsightPill label="Projeção lucro mensal" value={BRL.format(Math.max(0, lucroMes*1.15))} sub="Base otimista +15%" />
          </div>
        </div>
      </div>

      {/* Calculadora Inteligente */}
      <ProfitCalculator theme={theme} products={products}/>
    </div>
  );
}

function KpiCard({ theme, label, value, sub, tone="default" }:{
  theme:"light"|"dark"; label:string; value:string; sub:string; tone?: "blue"|"green"|"default"
}){
  const toneClasses =
    tone==="blue" ? "from-[#eef4ff] to-[#f7fbff]"
    : tone==="green" ? "from-[#e9fbef] to-[#f5fff8]"
    : theme==="dark" ? "from-[#0f1a2b] to-[#0d1726]" : "from-white to-[#fcfdff]";
  const valueTone =
    tone==="blue" ? "text-[#1d4fd7]"
    : tone==="green" ? "text-[#11934a]"
    : theme==="dark" ? "text-white" : "text-zinc-900";
  return (
    <div className={`rounded-[20px] card-border soft-shadow p-5 bg-gradient-to-b ${toneClasses} ${theme==="dark" && tone==="default" ? "" : ""}`}>
      <div className={`text-[12px] font-[700] tracking-wider uppercase ${theme==="dark" && tone==="default" ? "text-zinc-400":"text-zinc-500"}`}>{label}</div>
      <div className={`text-[26px] sm:text-[27px] font-[800] tracking-[-0.015em] mt-3 ${valueTone}`}>{value}</div>
      <div className={`text-[12.5px] ${theme==="dark"?"text-zinc-400":"text-zinc-600"} mt-1`}>{sub}</div>
    </div>
  );
}

function InsightPill({label, value, sub}:{label:string; value:string; sub:string}){
  return (
    <div className="rounded-xl card-border px-4 py-3">
      <div className="text-[11px] font-[700] text-zinc-500 tracking-wide">{label.toUpperCase()}</div>
      <div className="font-[700]">{value}</div>
      <div className="text-[12px] text-zinc-500">{sub}</div>
    </div>
  );
}

/* CALCULADORA */
function ProfitCalculator({theme, products}:{theme:"light"|"dark", products:Product[]}){
  const [cost, setCost] = useState(9.8);
  const [marginTarget, setMarginTarget] = useState(55);
  const [fee, setFee] = useState(5); // taxa %
  const [tax, setTax] = useState(4); // impostos %
  const priceSuggestion = useMemo(()=>{
    const c = Math.max(0, cost);
    const markup = Math.max(1, marginTarget) / 100;
    const fixedFees = (fee + tax) / 100;
    const base = c / (1 - fixedFees - 0.000001);
    const selling = base / (1 - markup);
    return +(selling).toFixed(2);
  }, [cost, marginTarget, fee, tax]);
  const lucro = +(priceSuggestion - cost - priceSuggestion*(fee+tax)/100).toFixed(2);
  const margemFinal = priceSuggestion>0 ? Math.round(lucro/priceSuggestion*100) : 0;

  return (
    <div className={`rounded-[22px] card-border soft-shadow p-6 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-[800] text-[18px]">Calculadora Inteligente de Lucro</div>
          <div className={`text-[13px] ${theme==="dark"?"text-zinc-400":"text-zinc-600"}`}>Preço ideal, margem líquida e meta de markup ao vivo.</div>
        </div>
        <div className={`text-[12px] px-3 py-1.5 rounded-full card-border ${theme==="dark"?"bg-[#0b1322]":"bg-[#f6f8ff]"}`}>Markup • Taxas • Impostos</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-5">
        {[
          {label:"Custo do produto", value:cost, set:setCost, step:0.1, min:0},
          {label:"Meta de margem (%)", value:marginTarget, set:setMarginTarget, step:1, min:1, max:90},
          {label:"Taxa canal / cartão (%)", value:fee, set:setFee, step:0.5, min:0, max:20},
          {label:"Impostos (%)", value:tax, set:setTax, step:0.5, min:0, max:30},
        ].map(inp => (
          <div key={inp.label} className="space-y-2">
            <div className="text-[12px] text-zinc-500 font-[600]">{inp.label}</div>
            <input type="number" value={inp.value} min={inp.min} max={inp.max}
              step={inp.step}
              onChange={e=>inp.set(+e.target.value)}
              className={`w-full rounded-xl px-3.5 py-3 text-[15px] card-border outline-none ${theme==="dark"?"bg-[#0c1425]":"bg-white"}`}/>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        <div className="rounded-2xl p-4 card-border bg-gradient-to-b from-[#f5f8ff] to-white">
          <div className="text-[11px] font-[700] tracking-wide text-[#3450ad]">VALOR IDEAL DE VENDA</div>
          <div className="text-[26px] font-[800] tracking-[-0.015em] text-[#1d41b8] mt-1">{BRL.format(priceSuggestion)}</div>
          <div className="text-[12px] text-zinc-600 mt-1">Recomendado para atingir a margem alvo.</div>
        </div>
        <div className="rounded-2xl p-4 card-border bg-gradient-to-b from-[#eefaf3] to-white">
          <div className="text-[11px] font-[700] tracking-wide text-[#16844c]">LUCRO ESTIMADO</div>
          <div className="text-[26px] font-[800] tracking-[-0.015em] text-[#128049] mt-1">{BRL.format(lucro)}</div>
          <div className="text-[12px] text-zinc-600 mt-1">Líquido após taxas e impostos.</div>
        </div>
        <div className="rounded-2xl p-4 card-border bg-gradient-to-b from-white to-[#fcfdff]">
          <div className="text-[11px] font-[700] tracking-wide text-zinc-600">MARGEM LÍQUIDA</div>
          <div className="text-[26px] font-[800] tracking-[-0.015em] mt-1">{margemFinal}%</div>
          <div className="text-[12px] text-zinc-600 mt-1">Lucro / Preço de venda.</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-6 gap-2 text-[12px]">
        {products.slice(0,6).map(p=>(
          <button key={p.id} onClick={()=>setCost(p.cost)}
            className="px-3 py-2 rounded-xl card-border hover:bg-zinc-50">
            <div className="font-[700] truncate">{p.name}</div>
            <div className="text-zinc-500">Custo {BRL.format(p.cost)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* FINANCEIRO */

function FinanceiroView({ theme, transactions, setTransactions }:{
  theme:"light"|"dark";
  transactions:Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
}){
  const [filter, setFilter] = useState<"hoje"|"semana"|"mes"|"ano">("mes");
  const [tipo, setTipo] = useState<"todas"|"entrada"|"saida">("todas");
  const [q, setQ] = useState("");

  const now = new Date();
  const within = (iso:string)=>{
    if(filter==="hoje"){
      return iso === todayISO();
    }
    const [y, m, d] = iso.split("-").map(Number);
    const dateObj = new Date(y, m-1, d);
    if(filter==="semana"){
      const diff = (now.getTime() - dateObj.getTime()) / (1000*3600*24);
      return diff >= 0 && diff < 7;
    }
    if(filter==="mes"){
      return dateObj.getMonth()===now.getMonth() && dateObj.getFullYear()===now.getFullYear();
    }
    return dateObj.getFullYear()===now.getFullYear();
  };

  const filtered = transactions.filter(t=>{
    if(tipo!=="todas" && t.type!==tipo) return false;
    if(!within(t.date)) return false;
    if(q && !(`${t.description} ${t.category}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const totalReceitas = filtered.filter(t=>t.type==="entrada").reduce((a,t)=>a+t.amount,0);
  const totalDespesas = filtered.filter(t=>t.type==="saida").reduce((a,t)=>a+t.amount,0);
  const lucroLiquido = totalReceitas - totalDespesas;

  const dailyCash = useMemo(()=>{
    // last 14 days
    const days = Array.from({length:14}).map((_,i)=>{
      const d = new Date(); d.setDate(d.getDate() - (13-i));
      const iso = d.toISOString().slice(0,10);
      const r = filtered.filter(t=>t.date===iso && t.type==="entrada").reduce((a,t)=>a+t.amount,0);
      const s = filtered.filter(t=>t.date===iso && t.type==="saida").reduce((a,t)=>a+t.amount,0);
      return { d: iso.slice(5), entrada: r, saida: s, saldo: r-s };
    });
    return days;
  }, [filtered]);

  // modal form
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Transaction>({
    id:"", amount:0, category:"Vendas", date: todayISO(), description:"", type:"entrada", paymentMethod:"Pix"
  });

  const addTx = () => {
    if(!form.amount || !form.description) return;
    setTransactions(p=>[{...form, id: uid()}, ...p]);
    setOpen(false);
    setForm({ id:"", amount:0, category:"Vendas", date: todayISO(), description:"", type:"entrada", paymentMethod:"Pix" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[20px] font-[800]">Financeiro</div>
        <div className="flex flex-wrap gap-2">
          {(["hoje","semana","mes","ano"] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`px-3 py-2 rounded-xl text-[13px] font-[700] card-border ${filter===f ? "bg-[#2563EB] text-white border-[#2563EB]" : (theme==="dark"?"bg-[#0f192d]":"bg-white")}`}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
          <button onClick={()=>setOpen(true)} className="px-4 py-2 rounded-xl bg-[#22C55E] text-white font-[800]">+ Lançamento</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryTile theme={theme} label="Total de Receitas" value={BRL.format(totalReceitas)} positive />
        <SummaryTile theme={theme} label="Total de Despesas" value={BRL.format(totalDespesas)} />
        <SummaryTile theme={theme} label="Lucro Líquido" value={BRL.format(lucroLiquido)} big positive={lucroLiquido>=0} />
        <SummaryTile theme={theme} label="Fluxo de Caixa" value={(lucroLiquido>=0?"+":"") + BRL.format(lucroLiquido)} />
      </div>

      <div className={`rounded-[22px] card-border soft-shadow ${theme==="dark"?"bg-[#0e1626]":"bg-white"} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-[800]">Fluxo de Caixa</div>
          <div className="flex items-center gap-2">
            {(["todas","entrada","saida"] as const).map(t=>(
              <button key={t} onClick={()=>setTipo(t)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-[700] border ${tipo===t ? "border-[#2563EB] text-[#2563EB] bg-[#eef4ff]":"border-zinc-300"}`}>
                {t==="todas"?"Todos": t==="entrada"?"Entradas":"Saídas"}
              </button>
            ))}
            <input placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)}
              className={`px-3 py-[7px] rounded-xl text-[13px] card-border ${theme==="dark"?"bg-[#0d1425]":"bg-white"}`} />
          </div>
        </div>
        <div className="h-[290px] mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyCash}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme==="dark"?"#243049":"#e6e9f2"} vertical={false}/>
              <XAxis dataKey="d" tick={{ fontSize: 11, fill: theme==="dark" ? "#a6b1cc":"#64748b"}}/>
              <YAxis tickFormatter={v=>compactBRL(Number(v))} tick={{ fontSize: 11, fill: theme==="dark" ? "#a6b1cc":"#64748b"}} />
              <Tooltip formatter={(v:any)=>BRL.format(Number(v))}/>
              <Bar dataKey="entrada" fill="#22C55E" radius={[6,6,0,0]} name="Entrada"/>
              <Bar dataKey="saida" fill="#ee4e4e" radius={[6,6,0,0]} name="Saída"/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-auto mt-4">
          <table className="w-full text-[13.5px]">
            <thead className={`${theme==="dark"?"text-zinc-400":"text-zinc-500"}`}>
              <tr className="border-b border-zinc-200/70">
                <th className="text-left py-2">Data</th>
                <th className="text-left py-2">Descrição</th>
                <th className="text-left py-2">Categoria</th>
                <th className="text-left py-2">Tipo</th>
                <th className="text-right py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx=>(
                <tr key={tx.id} className="border-b border-zinc-100/80">
                  <td className="py-2.5">{new Date(tx.date+"T12:00").toLocaleDateString("pt-BR")}</td>
                  <td className="py-2.5">{tx.description} {tx.paymentMethod && <span className="text-zinc-500 text-[11px]">• {tx.paymentMethod}</span>}</td>
                  <td className="py-2.5">{tx.category}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-1 text-[11px] font-[700] rounded-full ${tx.type==="entrada" ? "bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>{tx.type}</span>
                  </td>
                  <td className="py-2.5 text-right font-[700]">{(tx.type==="saida"?"-":"") + BRL.format(tx.amount)}</td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td colSpan={5} className="py-8 text-center text-zinc-500">Sem lançamentos neste filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal theme={theme} onClose={()=>setOpen(false)} title="Novo lançamento financeiro">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Tipo</label>
              <select value={form.type} onChange={e=>setForm({...form, type:e.target.value as any})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}>
                <option value="entrada">Entrada / Receita</option>
                <option value="saida">Saída / Despesa</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Data</label>
              <input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}/>
            </div>
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Valor (R$)</label>
              <input type="number" step="0.01" value={form.amount||""} onChange={e=>setForm({...form, amount:+e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}/>
            </div>
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Categoria</label>
              <select value={form.category} onChange={e=>setForm({...form, category:e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}>
                {categories.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[12px] text-zinc-500 font-[600]">Descrição</label>
              <input value={form.description} onChange={e=>setForm({...form, description:e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`} placeholder="Ex.: Vendas balcão"/>
            </div>
            {form.type==="entrada" && (
              <div className="md:col-span-2">
                <label className="text-[12px] text-zinc-500 font-[600]">Forma de pagamento</label>
                <input value={form.paymentMethod||""} onChange={e=>setForm({...form, paymentMethod:e.target.value})}
                  className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`} placeholder="Pix, Cartão, Dinheiro..."/>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={()=>setOpen(false)} className="px-4 py-2 rounded-xl card-border">Cancelar</button>
            <button onClick={addTx} className="px-4 py-2 rounded-xl bg-[#2563EB] text-white font-[700]">Salvar lançamento</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryTile({theme, label, value, big, positive}:{theme:"light"|"dark"; label:string; value:string; big?:boolean; positive?:boolean;}){
  return (
    <div className={`rounded-[18px] card-border soft-shadow p-4 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
      <div className="text-[11px] font-[700] text-zinc-500 tracking-wide">{label.toUpperCase()}</div>
      <div className={`mt-2 font-[800] tracking-[-0.012em] ${big?"text-[26px]":"text-[22px]"} ${positive ? "text-[#128049]":""}`}>{value}</div>
    </div>
  );
}

/* PRODUTOS */

function ProdutosView({ theme, products, setProducts, sales }:{
  theme:"light"|"dark"; products:Product[]; setProducts:React.Dispatch<React.SetStateAction<Product[]>>; sales:Sale[];
}){
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Todas");
  const cats = ["Todas", ...Array.from(new Set(products.map(p=>p.category)))];

  const list = products.filter(p=>{
    const okQ = !query || p.name.toLowerCase().includes(query.toLowerCase());
    const okC = cat==="Todas" || p.category===cat;
    return okQ && okC;
  }).map(p=>{
    const lucro = +(p.price - p.cost).toFixed(2);
    const margem = p.price>0 ? Math.round(lucro/p.price*100) : 0;
    return {...p, lucro, margem };
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Product>({ id:"", name:"", category:"Hamburgueria", cost:0, price:0, stock:0, minStock:5, sku:"" });

  const save = ()=>{
    if(!form.name || form.price<=0) return;
    if(editing){
      setProducts(ps=>ps.map(p=> p.id===editing.id ? {...form, id:editing.id} : p));
    } else {
      setProducts(ps=>[{...form, id: uid()}, ...ps]);
    }
    setOpen(false); setEditing(null);
    setForm({ id:"", name:"", category:"Hamburgueria", cost:0, price:0, stock:0, minStock:5, sku:"" });
  };

  // vendido
  const soldMap = useMemo(()=>{
    const m = new Map<string, number>();
    sales.forEach(s=> s.items.forEach(i=> m.set(i.productId, (m.get(i.productId)||0)+i.qty)));
    return m;
  }, [sales]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[20px] font-[800]">Produtos</div>
        <div className="flex flex-wrap gap-2">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto..." className={`px-3 py-2 rounded-xl text-[13px] card-border w-[220px] ${theme==="dark"?"bg-[#0f182d]":"bg-white"}`}/>
          <select value={cat} onChange={e=>setCat(e.target.value)} className={`px-3 py-2 rounded-xl text-[13px] card-border ${theme==="dark"?"bg-[#0f182d]":"bg-white"}`}>
            {cats.map(c=> <option key={c}>{c}</option>)}
          </select>
          <button onClick={()=>setOpen(true)} className="px-4 py-2 rounded-xl bg-[#2563EB] text-white font-[800]">+ Novo produto</button>
        </div>
      </div>

      <div className={`rounded-[22px] card-border soft-shadow ${theme==="dark"?"bg-[#0e1626]":"bg-white"} overflow-auto`}>
        <table className="w-full text-[13.8px]">
          <thead className={`${theme==="dark"?"text-zinc-400":"text-zinc-500"}`}>
            <tr className="border-b">
              <th className="text-left py-3 px-4">Produto</th>
              <th className="text-left py-3">Categoria</th>
              <th className="text-right py-3">Custo</th>
              <th className="text-right py-3">Venda</th>
              <th className="text-right py-3">Lucro/un</th>
              <th className="text-right py-3">Margem</th>
              <th className="text-right py-3">Estoque</th>
              <th className="text-right py-3">Vendido</th>
              <th className="text-right py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map(p=>(
              <tr key={p.id} className="border-b last:border-0 border-zinc-100/80">
                <td className="py-3 px-4 font-[700]">{p.name}</td>
                <td className="py-3">{p.category}</td>
                <td className="py-3 text-right">{BRL.format(p.cost)}</td>
                <td className="py-3 text-right text-[#1c46bc] font-[700]">{BRL.format(p.price)}</td>
                <td className="py-3 text-right text-[#128049] font-[700]">{BRL.format(p.lucro)}</td>
                <td className="py-3 text-right">{p.margem}%</td>
                <td className="py-3 text-right">{p.stock}</td>
                <td className="py-3 text-right">{soldMap.get(p.id)||0}</td>
                <td className="py-3 text-right px-4">
                  <button onClick={()=>{ setEditing(p); setForm(p); setOpen(true); }}
                    className="text-[12px] px-3 py-1.5 rounded-lg card-border">Editar</button>
                </td>
              </tr>
            ))}
            {list.length===0 && <tr><td colSpan={9} className="py-10 text-center text-zinc-500">Nenhum produto encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal theme={theme} onClose={()=>{setOpen(false); setEditing(null);}} title={editing? "Editar produto":"Novo produto"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[12px] text-zinc-500 font-[600]">Nome do produto</label>
              <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}/>
            </div>
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Categoria</label>
              <input value={form.category} onChange={e=>setForm({...form, category:e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}/>
            </div>
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">SKU (opcional)</label>
              <input value={form.sku||""} onChange={e=>setForm({...form, sku:e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}/>
            </div>
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Custo (R$)</label>
              <input type="number" step="0.01" value={form.cost||""} onChange={e=>setForm({...form, cost:+e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}/>
            </div>
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Preço de venda (R$)</label>
              <input type="number" step="0.01" value={form.price||""} onChange={e=>setForm({...form, price:+e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}/>
            </div>
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Quantidade em estoque</label>
              <input type="number" value={form.stock} onChange={e=>setForm({...form, stock:+e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}/>
            </div>
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Estoque mínimo</label>
              <input type="number" value={form.minStock} onChange={e=>setForm({...form, minStock:+e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}/>
            </div>
            <div className="md:col-span-2 flex items-center justify-between">
              <div className="text-[13px] text-zinc-600">
                Lucro estimado: <b className="text-[#128049]">{BRL.format(Math.max(0, form.price-form.cost))}</b> • Margem: <b>{form.price>0 ? Math.round((form.price-form.cost)/form.price*100) : 0}%</b>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>{setOpen(false); setEditing(null);}} className="px-4 py-2 rounded-xl card-border">Cancelar</button>
                <button onClick={save} className="px-4 py-2 rounded-xl bg-[#2563EB] text-white font-[700]">Salvar</button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ESTOQUE */

function EstoqueView({ theme, products, setProducts }:{
  theme:"light"|"dark";
  products:Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}){
  const low = products.filter(p=> p.stock <= p.minStock);
  const near = products.filter(p=> p.stock > p.minStock && p.stock <= p.minStock*1.5);

  const adjust = (id:string, delta:number)=>{
    setProducts(ps=> ps.map(p=> p.id===id ? {...p, stock: Math.max(0, p.stock+delta)} : p));
  };

  return (
    <div className="space-y-6">
      <div className="text-[20px] font-[800]">Estoque</div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`rounded-[18px] card-border p-4 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
          <div className="text-[12px] text-zinc-500 font-[600]">Alertas</div>
          <div className="text-[26px] font-[800] text-amber-600">{low.length}</div>
          <div className="text-[12px] text-zinc-600">produtos em estoque baixo</div>
        </div>
        <div className={`rounded-[18px] card-border p-4 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
          <div className="text-[12px] text-zinc-500 font-[600]">Próximos de acabar</div>
          <div className="text-[26px] font-[800]">{near.length}</div>
          <div className="text-[12px] text-zinc-600">Atenção para reposição</div>
        </div>
        <div className={`rounded-[18px] card-border p-4 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
          <div className="text-[12px] text-zinc-500 font-[600]">Itens ativos</div>
          <div className="text-[26px] font-[800]">{products.length}</div>
          <div className="text-[12px] text-zinc-600">SKUs cadastrados</div>
        </div>
      </div>

      {low.length > 0 && (
        <div className={`rounded-[18px] card-border p-4 ${theme==="dark"?"bg-[#1a1320]":"bg-amber-50"} border-amber-200`}>
          <div className="font-[800]">⚠️ Estoque Baixo</div>
          <div className="text-[13px] mt-1">Alguns itens precisam de reposição urgente:</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-[13px]">
            {low.map(p=>(
              <div key={p.id} className="rounded-xl px-3 py-2 card-border bg-white/60">
                <div className="font-[700]">{p.name}</div>
                <div className="text-amber-700">Estoque: {p.stock} (mín. {p.minStock})</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`rounded-[22px] card-border soft-shadow ${theme==="dark"?"bg-[#0e1626]":"bg-white"} p-5`}>
        <div className="font-[800] mb-3">Movimentação de estoque</div>
        <div className="space-y-3 max-h-[520px] overflow-auto pr-2 hide-scrollbar">
          {products.map(p=>(
            <div key={p.id} className="flex items-center justify-between py-3 border-b border-zinc-100/80">
              <div>
                <div className="font-[700]">{p.name}</div>
                <div className="text-[12px] text-zinc-500">{p.category} • SKU {p.sku||"-"}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`font-[800] ${p.stock<=p.minStock ? "text-amber-600":""}`}>{p.stock} un</div>
                  <div className="text-[11px] text-zinc-500">mín {p.minStock}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>adjust(p.id, -1)} className="px-3 py-1.5 rounded-lg card-border">-1</button>
                  <button onClick={()=>adjust(p.id, +5)} className="px-3 py-1.5 rounded-lg card-border bg-[#f6faff]">+5</button>
                  <button onClick={()=>adjust(p.id, +20)} className="px-3 py-1.5 rounded-lg card-border bg-emerald-50">+20</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* CLIENTES */

function ClientesView({ theme, clients, setClients }:{
  theme:"light"|"dark"; clients:Client[]; setClients:React.Dispatch<React.SetStateAction<Client[]>>;
}){
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Client>({ id:"", name:"", phone:"", email:"", totalSpent:0, orderCount:0, notes:"" });

  const save = ()=>{
    if(!form.name) return;
    setClients(cs=>[{...form, id: uid()}, ...cs]);
    setOpen(false);
    setForm({ id:"", name:"", phone:"", email:"", totalSpent:0, orderCount:0, notes:"" });
  };

  const filtered = clients.filter(c=> !q || `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[20px] font-[800]">Clientes</div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Busca rápida..."
            className={`px-3 py-2 rounded-xl text-[13px] card-border w-[220px] ${theme==="dark"?"bg-[#0f182d]":"bg-white"}`} />
          <button onClick={()=>setOpen(true)} className="px-4 py-2 rounded-xl bg-[#2563EB] text-white font-[800]">+ Novo cliente</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c=>(
          <div key={c.id} className={`rounded-[18px] card-border soft-shadow p-4 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
            <div className="font-[800]">{c.name}</div>
            <div className="text-[13px] text-zinc-500">{c.phone} • {c.email}</div>
            <div className="flex items-center justify-between mt-3 text-[13px]">
              <div>Última compra</div>
              <div className="font-[600]">{c.lastPurchase ? new Date(c.lastPurchase+"T12:00").toLocaleDateString("pt-BR") : "-"}</div>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <div>Qtd compras</div>
              <div className="font-[600]">{c.orderCount}</div>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <div>Valor total gasto</div>
              <div className="font-[700] text-[#1d46b9]">{BRL.format(c.totalSpent)}</div>
            </div>
            {c.notes && <div className="mt-2 text-[12px] text-zinc-600">{c.notes}</div>}
            
            {c.phone && (
              <button onClick={() => window.open(`https://wa.me/55${c.phone.replace(/\D/g,'')}`, '_blank')}
                className="mt-4 w-full py-2 rounded-xl flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-[700] text-[13px] transition">
                <span>💬</span> WhatsApp
              </button>
            )}
          </div>
        ))}
        {filtered.length===0 && <div className={`rounded-[18px] card-border p-6 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>Nenhum cliente encontrado.</div>}
      </div>

      {open && (
        <Modal theme={theme} title="Novo cliente" onClose={()=>setOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Nome</label>
              <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`} />
            </div>
            <div>
              <label className="text-[12px] text-zinc-500 font-[600]">Telefone</label>
              <input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`} />
            </div>
            <div className="md:col-span-2">
              <label className="text-[12px] text-zinc-500 font-[600]">E-mail</label>
              <input value={form.email} onChange={e=>setForm({...form, email:e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`} />
            </div>
            <div className="md:col-span-2">
              <label className="text-[12px] text-zinc-500 font-[600]">Observações</label>
              <textarea value={form.notes||""} onChange={e=>setForm({...form, notes:e.target.value})}
                className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`} rows={3}/>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={()=>setOpen(false)} className="px-4 py-2 rounded-xl card-border">Cancelar</button>
            <button onClick={save} className="px-4 py-2 rounded-xl bg-[#2563EB] text-white font-[700]">Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* METAS */

function MetasView({ theme, goals, setGoals, sales, transactions }:{
  theme:"light"|"dark";
  goals:Goal; setGoals:React.Dispatch<React.SetStateAction<Goal>>;
  sales:Sale[]; transactions:Transaction[];
}){
  const monthStr = todayISO().slice(0,7);
  const revenueMonth = sales.filter(s=>s.date.startsWith(monthStr)).reduce((a,s)=>a+s.total,0);
  const salesCount = sales.filter(s=>s.date.startsWith(monthStr)).length;
  const profitMonth = (() => {
    const rec = transactions.filter(t=>t.date.startsWith(monthStr)&&t.type==="entrada").reduce((a,t)=>a+t.amount,0);
    const desp = transactions.filter(t=>t.date.startsWith(monthStr)&&t.type==="saida").reduce((a,t)=>a+t.amount,0);
    return rec-desp;
  })();
  const yearStr = monthStr.slice(0,4);
  const revenueYear = sales.filter(s=>s.date.startsWith(yearStr)).reduce((a,s)=>a+s.total,0);

  const items = [
    { label:"Meta de faturamento mensal", current: revenueMonth, target: goals.monthlyRevenue },
    { label:"Meta de lucro mensal", current: profitMonth, target: goals.monthlyProfit },
    { label:"Meta de vendas (pedidos/mês)", current: salesCount, target: goals.monthlySales, isCount:true },
    { label:"Meta anual", current: revenueYear, target: goals.annualRevenue },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-[20px] font-[800]">Metas</div>
        <div className={`text-[12px] px-3 py-1.5 rounded-full card-border ${theme==="dark"?"bg-[#0d1425]":"bg-white"}`}>Acompanhe o progresso em tempo real</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {items.map((it, idx)=> {
          const pct = Math.min(100, Math.round((it.current/Math.max(1,it.target))*100));
          return (
            <div key={idx} className={`rounded-[18px] card-border soft-shadow p-5 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
              <div className="flex items-center justify-between">
                <div className="font-[800]">{it.label}</div>
                <div className={`text-[12px] font-[800] ${pct>=75 ? "text-[#128049]": pct>=40 ? "text-[#c88700]":"text-[#d63a3a]"}`}>{pct}%</div>
              </div>
              <div className="mt-3 h-3 w-full rounded-full bg-zinc-200/80 overflow-hidden">
                <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${pct}%`, transition: "width .6s ease" }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[13px] text-zinc-600">
                <span>Atual: <b className="text-zinc-900 dark:text-zinc-100">{it.isCount ? Math.round(it.current) : BRL.format(it.current)}</b></span>
                <span>Meta: <b>{it.isCount ? Math.round(it.target) : BRL.format(it.target)}</b></span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`rounded-[18px] card-border soft-shadow p-5 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
        <div className="font-[800] mb-3">Definir metas</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <NumberField label="Meta mensal (faturamento)" value={goals.monthlyRevenue} onChange={v=>setGoals(g=>({...g, monthlyRevenue:v}))}/>
          <NumberField label="Meta anual" value={goals.annualRevenue} onChange={v=>setGoals(g=>({...g, annualRevenue:v}))}/>
          <NumberField label="Meta de lucro mensal" value={goals.monthlyProfit} onChange={v=>setGoals(g=>({...g, monthlyProfit:v}))}/>
          <NumberField label="Meta de vendas (pedidos)" value={goals.monthlySales} onChange={v=>setGoals(g=>({...g, monthlySales:v}))} isCount/>
        </div>
        <div className="text-[12px] text-zinc-500 mt-3">Exemplo: Meta R$10.000 • Atual R$7.500 • Progresso 75%</div>
      </div>

      {/* Mini pie chart com participação */}
      <div className={`rounded-[18px] card-border soft-shadow p-5 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
        <div className="font-[800] mb-2">Distribuição por meta</div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={[
                {name:"Faturamento", value: Math.max(1, revenueMonth)},
                {name:"Lucro", value: Math.max(1, profitMonth)},
                {name:"Vendas", value: Math.max(1, salesCount*40)},
              ]} dataKey="value" nameKey="name" outerRadius={90} innerRadius={52} paddingAngle={3}>
                <Cell fill="#2563EB"/>
                <Cell fill="#22C55E"/>
                <Cell fill="#f59e0b"/>
              </Pie>
              <Tooltip formatter={(v:any)=> typeof v==="number" ? (v>400? BRL.format(Number(v)) : v) : v}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, isCount }:{
  label:string; value:number; onChange:(n:number)=>void; isCount?:boolean;
}){
  return (
    <div>
      <label className="text-[12px] text-zinc-500 font-[600]">{label}</label>
      <input type="number" value={value}
        onChange={e=>onChange(+e.target.value)}
        className="mt-1 w-full rounded-xl px-3 py-3 card-border bg-white" />
      <div className="text-[11px] text-zinc-500 mt-1">{isCount ? "Quantidade" : "Em R$"}</div>
    </div>
  );
}

/* CONFIGURAÇÕES */

function ConfigView({ theme, setTheme, settings, setSettings }:{
  theme:"light"|"dark";
  setTheme:(t:"light"|"dark")=>void;
  settings:BusinessSettings;
  setSettings:React.Dispatch<React.SetStateAction<BusinessSettings>>;
}){
  return (
    <div className="space-y-6">
      <div className="text-[20px] font-[800]">Configurações</div>

      <div className={`rounded-[22px] card-border soft-shadow p-5 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
        <div className="font-[800] mb-4">Dados do negócio</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] text-zinc-500 font-[600]">Nome da empresa</label>
            <input value={settings.companyName}
              onChange={e=>setSettings(s=>({...s, companyName:e.target.value}))}
              className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`} />
          </div>
          <div>
            <label className="text-[12px] text-zinc-500 font-[600]">Segmento</label>
            <select value={settings.segment}
              onChange={e=>setSettings(s=>({...s, segment:e.target.value}))}
              className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`}>
              {SEGMENTS.map(s=> <option key={s.label}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] text-zinc-500 font-[600]">CNPJ (opcional)</label>
            <input value={settings.cnpj||""}
              onChange={e=>setSettings(s=>({...s, cnpj:e.target.value}))}
              className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <label className="text-[12px] text-zinc-500 font-[600]">Telefone</label>
            <input value={settings.phone||""}
              onChange={e=>setSettings(s=>({...s, phone:e.target.value}))}
              className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`} placeholder="(11) 90000-0000" />
          </div>
          <div className="md:col-span-2">
            <label className="text-[12px] text-zinc-500 font-[600]">Endereço</label>
            <input value={settings.address||""}
              onChange={e=>setSettings(s=>({...s, address:e.target.value}))}
              className={`mt-1 w-full rounded-xl px-3 py-3 card-border ${theme==="dark"?"bg-[#0b1322]":"bg-white"}`} placeholder="Rua, número, bairro, cidade" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-[700]">Tema</div>
            <div className="text-[13px] text-zinc-500">Claro e escuro • preferência salva</div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setTheme("light")}
              className={`px-4 py-2 rounded-xl card-border ${theme==="light" ? "bg-[#eef4ff] text-[#1e41ba] border-[#bfd3ff]":""}`}>Claro</button>
            <button onClick={()=>setTheme("dark")}
              className={`px-4 py-2 rounded-xl card-border ${theme==="dark" ? "bg-[#1a2438] text-white border-[#2b3e66]":""}`}>Escuro</button>
          </div>
        </div>

        <div className="mt-6 text-[12px] text-zinc-500">
          Logotipo: disponível na versão Pro (envio de imagem). Nesta demo, o logotipo é gerado automaticamente com as iniciais.
        </div>
      </div>

      <div className={`rounded-[22px] card-border soft-shadow p-5 ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`}>
        <div className="font-[800] mb-2">Sobre o sistema</div>
        <div className="text-[13.5px] text-zinc-600">
          Meu Negócio Organizado é um sistema focado em pequenos empreendedores: hamburguerias, açaiterias, pizzarias, lanchonetes, salões, barbearias e lojas.
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [theme, setTheme] = useThemeState();
  const [user, setUser] = useState<any>(undefined); // undefined = loading, null = unauthenticated
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const adminEmail = "admin@seunegocio.com"; // Configure admin email here

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        if (u.email === adminEmail) {
          setIsAdmin(true);
          setIsRevoked(false);
          setUser(u);
        } else {
          // Check access list
          const docSnap = await getDoc(doc(db, "mno_admin_clients", u.uid));
          if (docSnap.exists() && docSnap.data().active === true) {
            setIsAdmin(false);
            setIsRevoked(false);
            setUser(u);
          } else {
            setIsRevoked(true);
            setUser(null);
            auth.signOut();
          }
        }
      } else {
        setUser(null);
      }
    });
    return () => unsub();
  }, []);

  if (user === undefined) return <div className="h-screen bg-[#f2f5fb]" />; // Loading screen
  
  if (isRevoked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f2f5fb]">
        <div className="p-10 bg-white rounded-3xl shadow-xl text-center max-w-sm border border-zinc-200">
          <div className="text-[40px] mb-4">⛔</div>
          <h2 className="text-xl font-bold mb-2">Acesso Revogado</h2>
          <p className="text-zinc-600 mb-6">O seu acesso a este sistema foi desativado pelo administrador.</p>
          <button onClick={() => setIsRevoked(false)} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl">Voltar ao Login</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen theme={theme} setTheme={setTheme} />;
  }

  const handleLogout = () => auth.signOut();

  if (isAdmin) {
    return <AdminPanel theme={theme} setTheme={setTheme} onLogout={handleLogout} />;
  }

  return <MainApp uid={user.uid} theme={theme} setTheme={setTheme} onLogout={handleLogout} />;
}


/* PDV (VENDAS) */
function PdvView({ theme, products, clients, setProducts, setTransactions, setSales, setClients }:{
  theme:"light"|"dark";
  products:Product[];
  clients:Client[];
  setProducts:(p:Product[]|((prev:Product[])=>Product[]))=>void;
  setTransactions:(t:Transaction[]|((prev:Transaction[])=>Transaction[]))=>void;
  setSales:(s:Sale[]|((prev:Sale[])=>Sale[]))=>void;
  setClients:(c:Client[]|((prev:Client[])=>Client[]))=>void;
}){
  const [cart, setCart] = useState<{product:Product, qty:number}[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const [selectedClient, setSelectedClient] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);

  const total = cart.reduce((acc, item) => acc + (item.product.price * item.qty), 0);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(i => i.product.id === product.id);
      if (exists) {
        return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id === productId) {
        const newQty = Math.max(1, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const finalizeSale = () => {
    if (cart.length === 0) return;
    
    // Deduct stock
    setProducts(prev => {
      let newProds = [...prev];
      cart.forEach(item => {
        const pIndex = newProds.findIndex(p => p.id === item.product.id);
        if (pIndex >= 0) {
          newProds[pIndex] = { ...newProds[pIndex], stock: newProds[pIndex].stock - item.qty };
        }
      });
      return newProds;
    });

    // Add transaction
    const newTx: Transaction = {
      id: uid(),
      type: "entrada",
      amount: total,
      category: "Vendas",
      description: `Venda PDV - ${cart.length} itens`,
      date: todayISO(),
      paymentMethod
    };
    setTransactions(prev => [newTx, ...prev]);

    // Add sale
    const newSale: Sale = {
      id: uid(),
      date: todayISO(),
      total,
      clientId: selectedClient || undefined,
      items: cart.map(i => ({ productId: i.product.id, qty: i.qty, unitPrice: i.product.price }))
    };
    setSales(prev => [newSale, ...prev]);

    // Update client stats if selected
    if (selectedClient) {
      setClients(prev => prev.map(c => 
        c.id === selectedClient 
          ? { ...c, totalSpent: c.totalSpent + total, orderCount: c.orderCount + 1, lastPurchase: todayISO() }
          : c
      ));
    }

    setCart([]);
    setSelectedClient("");
    setIsFinalizing(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Product List */}
      <div className="flex-1">
        <h2 className="text-[20px] font-[800] mb-4 tracking-tight">Produtos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map(p => (
            <button key={p.id} onClick={() => addToCart(p)}
              className={`text-left p-4 rounded-2xl card-border transition transform active:scale-95 ${theme==="dark"?"bg-[#0e1626] hover:bg-[#142036]":"bg-white hover:bg-zinc-50"}`}>
              <div className="font-[700] text-[15px] leading-tight mb-2 line-clamp-2">{p.name}</div>
              <div className="text-[14px] font-[800] text-[#2563EB] mb-2">{BRL.format(p.price)}</div>
              <div className={`text-[11px] font-[600] px-2 py-1 inline-block rounded-md ${p.stock <= p.minStock ? "bg-red-100 text-red-700" : (theme==="dark"?"bg-white/10 text-zinc-300":"bg-zinc-100 text-zinc-600")}`}>
                Estoque: {p.stock}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Panel */}
      <div className={`w-full lg:w-[340px] shrink-0 rounded-3xl card-border soft-shadow flex flex-col ${theme==="dark"?"bg-[#0e1626]":"bg-white"}`} style={{ height: "calc(100vh - 120px)", position:"sticky", top:"88px" }}>
        <div className="p-5 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-[18px] font-[800] tracking-tight">Carrinho</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center text-zinc-500 text-[13px] mt-10">Carrinho vazio</div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-[600] text-[13.5px] truncate">{item.product.name}</div>
                  <div className="text-[#2563EB] font-[700] text-[13px]">{BRL.format(item.product.price)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.product.id, -1)} className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${theme==="dark"?"bg-white/10":"bg-zinc-100"}`}>-</button>
                  <span className="font-[700] text-[14px] w-4 text-center">{item.qty}</span>
                  <button onClick={() => updateQty(item.product.id, 1)} className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${theme==="dark"?"bg-white/10":"bg-zinc-100"}`}>+</button>
                </div>
                <button onClick={() => removeFromCart(item.product.id)} className="text-red-500 ml-1">🗑️</button>
              </div>
            ))
          )}
        </div>

        <div className={`p-5 border-t border-zinc-200 dark:border-white/10 rounded-b-3xl ${theme==="dark"?"bg-[#142036]":"bg-zinc-50"}`}>
          <div className="flex justify-between items-center mb-4">
            <span className="font-[600] text-zinc-500">Total</span>
            <span className="font-[800] text-[22px] tracking-tight">{BRL.format(total)}</span>
          </div>

          {isFinalizing ? (
            <div className="space-y-3">
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                className={`w-full p-3 rounded-xl text-[14px] font-[600] border ${theme==="dark"?"bg-[#0e1626] border-white/10 text-white":"bg-white border-zinc-300"}`}>
                <option value="">Nenhum cliente (Venda avulsa)</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className={`w-full p-3 rounded-xl text-[14px] font-[600] border ${theme==="dark"?"bg-[#0e1626] border-white/10 text-white":"bg-white border-zinc-300"}`}>
                <option value="Pix">Pix</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
              <div className="flex gap-2">
                <button onClick={() => setIsFinalizing(false)} className={`flex-1 py-3 rounded-xl font-[700] text-[14px] border transition ${theme==="dark"?"border-white/20 hover:bg-white/10":"border-zinc-300 hover:bg-zinc-100"}`}>
                  Cancelar
                </button>
                <button onClick={finalizeSale} className="flex-1 py-3 rounded-xl font-[700] text-[14px] bg-[#22C55E] text-white hover:bg-[#16a34a] transition">
                  Confirmar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsFinalizing(true)} disabled={cart.length === 0}
              className="w-full py-3.5 rounded-xl font-[800] text-[15px] bg-[#2563EB] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1d4ed8] transition shadow-lg shadow-blue-500/20">
              Finalizar Venda
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* GENERIC UI */

function Modal({ theme, title, children, onClose }:{
  theme:"light"|"dark";
  title:string;
  children:React.ReactNode;
  onClose:()=>void;
}){
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose}/>
      <div className={`relative w-[95%] max-w-3xl max-h-[90dvh] overflow-y-auto rounded-[22px] card-border soft-shadow p-5 pb-8 ${theme==="dark"?"bg-[#0f182a] text-zinc-100":"bg-white"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[17px] font-[800]">{title}</div>
          <button onClick={onClose} className="text-[13px] px-3 py-1.5 rounded-lg border">Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
}