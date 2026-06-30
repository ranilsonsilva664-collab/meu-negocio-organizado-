import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBVDYmKBpS_ds5vAIlJU6UFkae3m80CvU0",
  authDomain: "techfixbrasil-a7428.firebaseapp.com",
  projectId: "techfixbrasil-a7428",
  storageBucket: "techfixbrasil-a7428.firebasestorage.app",
  messagingSenderId: "890662987922",
  appId: "1:890662987922:web:c12678107612883d265e4b",
  measurementId: "G-YXFKP10KNR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    console.log("Testando conexão e permissões do Firestore...");
    const testDoc = doc(db, "mno_data", "test_connection");
    
    console.log("Tentando gravar dados...");
    await setDoc(testDoc, { status: "success", timestamp: new Date().toISOString() });
    console.log("✅ Escrita bem-sucedida! (Regras de escrita estão OK)");
    
    console.log("Tentando ler dados...");
    const snap = await getDoc(testDoc);
    if (snap.exists()) {
      console.log("✅ Leitura bem-sucedida! (Regras de leitura estão OK)");
      console.log("Dados lidos:", snap.data());
    } else {
      console.log("❌ Documento não encontrado após gravação.");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro de permissão ou conexão:", error.message);
    process.exit(1);
  }
}

test();
