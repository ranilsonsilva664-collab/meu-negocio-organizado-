import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

async function clear() {
  try {
    console.log("Limpando banco de dados...");
    await setDoc(doc(db, "mno_data", "mno_products_v2"), { value: [] });
    await setDoc(doc(db, "mno_data", "mno_clients_v2"), { value: [] });
    await setDoc(doc(db, "mno_data", "mno_tx_v2"), { value: [] });
    await setDoc(doc(db, "mno_data", "mno_sales_v2"), { value: [] });
    console.log("✅ Banco de dados zerado!");
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
clear();
