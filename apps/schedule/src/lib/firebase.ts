import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAmN0Oscjn_pSQrUY8R3Wejb0DxDl9zro0",
    authDomain: "manufacturing-schedule-dev.firebaseapp.com",
    projectId: "manufacturing-schedule-dev",
    storageBucket: "manufacturing-schedule-dev.firebasestorage.app",
    messagingSenderId: "910457731121",
    appId: "1:910457731121:web:f45bdaa9547d443de9fd10"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);
