/*
   FIREBASE-CONFIG.JS - CONFIGURACIÓN DE FIREBASE (MODULAR)
   La Arboleda Club - Tacna, Perú
   Versión: Firebase 12.6.0 (Modular)
 */


import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// ==========================================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================================

const firebaseConfig = {
  apiKey: "AIzaSyAwI5djY-zYa-5IWNDYe8phqRAIVEPpVj8",
  authDomain: "proyecto-arboleda2025.firebaseapp.com",
  projectId: "proyecto-arboleda2025",
  storageBucket: "proyecto-arboleda2025.firebasestorage.app",
  messagingSenderId: "949362114272",
  appId: "1:949362114272:web:cbe8bff3ffe6fd2aba1a85",
  measurementId: "G-7Z4J6CF5QB"
};

// ==========================================================
// INICIALIZACIÓN DE FIREBASE
// ==========================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

console.log('✅ Firebase inicializado correctamente - Proyecto Arboleda 2025');

// ==========================================================
// EXPORTAR SERVICIOS Y FUNCIONES
// ==========================================================

export {
  // Servicios principales
  db,
  auth,
  app,

  // Funciones de Firestore
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,

  // Funciones de Auth
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};