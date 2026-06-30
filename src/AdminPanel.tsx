import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, setDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, firebaseApp } from "./utils/firebase";

export function AdminPanel({ onLogout, theme, setTheme }: any) {
  const [clients, setClients] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mno_admin_clients"), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const createClient = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      // Use secondary app to prevent logging out admin
      const secondaryApp = initializeApp(firebaseApp.options, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      
      await setDoc(doc(db, "mno_admin_clients", cred.user.uid), {
        email,
        active: true,
        createdAt: new Date().toISOString()
      });
      
      await secondaryAuth.signOut();
      setEmail("");
      setPassword("");
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, "mno_admin_clients", id), { active: !currentStatus });
  };

  return (
    <div className={`min-h-screen p-8 ${theme === "dark" ? "bg-[#0b111d] text-zinc-100" : "bg-[#f7f9fd] text-zinc-900"}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-[24px] font-[800]">Painel Admin Secreto</div>
          <div className="flex gap-3">
            <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="px-3 py-1.5 rounded-full border border-zinc-300">
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <button onClick={onLogout} className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl">Sair</button>
          </div>
        </div>

        <div className={`p-6 rounded-[22px] shadow-sm border ${theme === "dark" ? "bg-[#0e1626] border-white/10" : "bg-white border-zinc-200"}`}>
          <h2 className="text-[18px] font-bold mb-4">Novo Cliente</h2>
          {error && <div className="text-red-500 mb-3 text-sm">{error}</div>}
          <div className="flex flex-col sm:flex-row gap-3">
            <input placeholder="E-mail do cliente" value={email} onChange={e => setEmail(e.target.value)}
              className={`flex-1 px-4 py-3 rounded-xl outline-none border ${theme === "dark" ? "bg-[#0d1424] border-zinc-800" : "bg-zinc-50 border-zinc-200"}`} />
            <input placeholder="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)}
              className={`flex-1 px-4 py-3 rounded-xl outline-none border ${theme === "dark" ? "bg-[#0d1424] border-zinc-800" : "bg-zinc-50 border-zinc-200"}`} />
            <button onClick={createClient} disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition">
              {loading ? "Criando..." : "Criar Acesso"}
            </button>
          </div>
        </div>

        <div className={`p-6 rounded-[22px] shadow-sm border ${theme === "dark" ? "bg-[#0e1626] border-white/10" : "bg-white border-zinc-200"}`}>
          <h2 className="text-[18px] font-bold mb-4">Clientes Cadastrados</h2>
          <div className="space-y-3">
            {clients.map(c => (
              <div key={c.id} className={`flex items-center justify-between p-4 rounded-xl border ${theme === "dark" ? "bg-[#0c1424] border-zinc-800" : "bg-zinc-50 border-zinc-200"}`}>
                <div>
                  <div className="font-bold">{c.email}</div>
                  <div className="text-[12px] text-zinc-500">ID: {c.id}</div>
                </div>
                <button onClick={() => toggleActive(c.id, c.active)}
                  className={`px-4 py-2 font-bold rounded-xl text-white ${c.active ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}>
                  {c.active ? "Bloquear Acesso" : "Desbloquear"}
                </button>
              </div>
            ))}
            {clients.length === 0 && <div className="text-zinc-500">Nenhum cliente cadastrado ainda.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
