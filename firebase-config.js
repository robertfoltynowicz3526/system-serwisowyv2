import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // TUTAJ WKLEJ SWOJE KLUCZE ZE STRONY FIREBASE
  // Upewnij się, że są one takie same jak poprzednio.
  apiKey: "AIzaSy...",
  authDomain: "nazwa-twojego-projektu.firebaseapp.com",
  projectId: "nazwa-twojego-projektu",
  storageBucket: "nazwa-twojego-projektu.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);

// TA LINIJKA JEST NAJWAŻNIEJSZA - słowo "export" udostępnia `db` innym plikom
export const db = getFirestore(app);
