import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

declare global {
  var __firebase_config: string | undefined;
  var __app_id: string | number | undefined;
  var __initial_auth_token: string | undefined;
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = 'pt-BR';
  document.documentElement.setAttribute('translate', 'no');
  document.documentElement.classList.add('notranslate');

  if (!document.querySelector('meta[name="google"]')) {
    const meta = document.createElement('meta');
    meta.name = 'google';
    meta.content = 'notranslate';
    document.head.appendChild(meta);
  }

  if (!document.getElementById('tailwind-cdn')) {
    const script = document.createElement('script');
    script.id = 'tailwind-cdn';
    script.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(script);
  }
}

const firebaseConfig =
  typeof __firebase_config !== 'undefined' && __firebase_config
    ? JSON.parse(__firebase_config)
    : {
        apiKey: 'AIzaSyBBSo5uUqvyMuQ_9cZ8KOgQ3VovKZjO2p8',
        authDomain: 'flash-cards-539e8.firebaseapp.com',
        projectId: 'flash-cards-539e8',
        storageBucket: 'flash-cards-539e8.firebasestorage.app',
        messagingSenderId: '547789982172',
        appId: '1:547789982172:web:d9d9f38f3bc02d05382719',
        measurementId: 'G-6G02K580GK',
      };

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error('Erro ao inicializar o Firebase:', error);
}

const appIdRaw = typeof __app_id !== 'undefined' ? String(__app_id) : 'flashcards-app';
const appId = appIdRaw.replace(/\//g, '-').replace(/[^a-zA-Z0-9_-]/g, '');

export { app, auth, db, appId };