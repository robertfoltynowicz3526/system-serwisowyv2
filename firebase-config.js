// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA4VZWw2JvRR_IYFM-Ez75ZFtW3WodwTbc",
  authDomain: "bobrzy-dashboard.firebaseapp.com",
  projectId: "bobrzy-dashboard",
  storageBucket: "bobrzy-dashboard.firebasestorage.app",
  messagingSenderId: "648127119573",
  appId: "1:648127119573:web:1c956817855adee82b625c",
  measurementId: "G-9FPJ9DJEKM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);