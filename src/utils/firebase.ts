import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBVDYmKBpS_ds5vAIlJU6UFkae3m80CvU0",
  authDomain: "techfixbrasil-a7428.firebaseapp.com",
  projectId: "techfixbrasil-a7428",
  storageBucket: "techfixbrasil-a7428.firebasestorage.app",
  messagingSenderId: "890662987922",
  appId: "1:890662987922:web:c12678107612883d265e4b",
  measurementId: "G-YXFKP10KNR"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
