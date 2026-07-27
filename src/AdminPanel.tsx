import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { db, firebaseApp } from "./utils/firebase";

export function AdminPanel({ onLogout, theme, setTheme }: any) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const generateCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mno_admin_clients"), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const createClient = async () => {
    setLoading(true);
    setError("");
    try {
      const code = generateCode();
      const newEmail = `${code.toLowerCase()}@seunegocio.com`;
      const newPassword = code;

      // Use secondary app to prevent logging out admin
      const secondaryApp = initializeApp(firebaseApp.options, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      
      await setDoc(doc(db, "mno_admin_clients", cred.user.uid), {
        email: newEmail,
        code: code,
        name: name,
        whatsapp: whatsapp,
        active: true,
        passwordStatus: "pending_password",
        createdAt: new Date().toISOString()
      });
      
      await secondaryAuth.signOut();
      setName("");
      setWhatsapp("");
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, "mno_admin_clients", id), { active: !currentStatus });
  };

  const deleteClient = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este cliente definitivamente?")) {
      await deleteDoc(doc(db, "mno_admin_clients", id));
    }
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input placeholder="Nome do Cliente (opcional)" value={name} onChange={e => setName(e.target.value)}
                className={`flex-1 px-4 py-3 rounded-xl outline-none border ${theme === "dark" ? "bg-[#0d1424] border-zinc-800" : "bg-zinc-50 border-zinc-200"}`} />
              <input placeholder="WhatsApp (DDD+Número)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                className={`flex-1 px-4 py-3 rounded-xl outline-none border ${theme === "dark" ? "bg-[#0d1424] border-zinc-800" : "bg-zinc-50 border-zinc-200"}`} />
            </div>
            <button onClick={createClient} disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition w-full">
              {loading ? "Gerando..." : "Gerar Novo Acesso (Código Único)"}
            </button>
          </div>
        </div>

        <div className={`p-6 rounded-[22px] shadow-sm border ${theme === "dark" ? "bg-[#0e1626] border-white/10" : "bg-white border-zinc-200"}`}>
          <h2 className="text-[18px] font-bold mb-4">Clientes Cadastrados</h2>
          <div className="space-y-3">
            {clients.map(c => (
              <div key={c.id} className={`flex items-center justify-between p-4 rounded-xl border ${theme === "dark" ? "bg-[#0c1424] border-zinc-800" : "bg-zinc-50 border-zinc-200"}`}>
                <div>
                  {c.name && <div className="font-bold text-lg mb-1">{c.name}</div>}
                  <div className={`font-bold text-lg tracking-wider px-3 py-1 rounded-lg w-max mb-1 ${c.passwordStatus === "pending_password" ? "text-blue-500 bg-blue-500/10" : "text-green-600 bg-green-500/10"}`}>
                    {c.passwordStatus === "pending_password" ? (c.code || c.email) : "****** (Privado)"}
                  </div>
                  {c.whatsapp && <div className="text-[13px] text-zinc-500 mb-1">WhatsApp: {c.whatsapp}</div>}
                  <div className="text-[12px] text-zinc-500">ID: {c.id}</div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {c.whatsapp && c.passwordStatus === "pending_password" && (
                    <a href={`https://wa.me/55${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${c.name || ''}, seu acesso provisório foi liberado!\n\nLink: ${window.location.origin}\nSeu Código de Acesso Provisório: *${c.code || c.email}*`)}`}
                      target="_blank" rel="noreferrer"
                      className="px-4 py-2 font-bold rounded-xl text-white bg-green-600 hover:bg-green-700">
                      WhatsApp
                    </a>
                  )}
                  <button onClick={() => toggleActive(c.id, c.active)}
                    className={`px-4 py-2 font-bold rounded-xl text-white ${c.active ? "bg-red-500 hover:bg-red-600" : "bg-zinc-500 hover:bg-zinc-600"}`}>
                    {c.active ? "Bloquear" : "Desbloquear"}
                  </button>
                  <button onClick={() => deleteClient(c.id)}
                    className="px-4 py-2 font-bold rounded-xl text-white bg-zinc-600 hover:bg-zinc-700">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {clients.length === 0 && <div className="text-zinc-500">Nenhum cliente cadastrado ainda.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
