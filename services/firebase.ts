import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Standardize Google popup Sign In
export async function signInWithGoogle() {
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

// Log out
export async function logoutUser() {
  await signOut(auth);
}

// Firestore operations and enum handlers as specified by skill instructions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Check Firestore DB connectivity
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

import { GeneratedProject } from '../types';
import { serverTimestamp } from 'firebase/firestore';

// Get user profile containing their custom API keys
export async function getUserProfile(uid: string) {
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, 'users', uid);
    const userSnapshot = await getDoc(userDocRef);
    if (userSnapshot.exists()) {
      return userSnapshot.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// Create new user profile document
export async function createUserProfile(uid: string, email: string) {
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, 'users', uid);
    const userData = {
      uid,
      email,
      createdAt: serverTimestamp()
    };
    await setDoc(userDocRef, userData);
    return userData;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Update user's personal api key
export async function updateUserApiKey(uid: string, geminiApiKey: string) {
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      geminiApiKey
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Get user projects from their subcollection
export async function getUserProjects(uid: string): Promise<GeneratedProject[]> {
  const path = `users/${uid}/projects`;
  try {
    const projectsColRef = collection(db, 'users', uid, 'projects');
    const q = query(projectsColRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const projects: GeneratedProject[] = [];
    snapshot.forEach((d) => {
      projects.push(d.data() as GeneratedProject);
    });
    return projects;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// Save or update project in user subcollection
export async function saveUserProject(uid: string, project: GeneratedProject) {
  const path = `users/${uid}/projects/${project.id}`;
  try {
    const projectDocRef = doc(db, 'users', uid, 'projects', project.id);
    const projectDocSnap = await getDoc(projectDocRef);
    if (projectDocSnap.exists()) {
      // update project
      await setDoc(projectDocRef, {
        ...project,
        createdAt: projectDocSnap.data().createdAt || serverTimestamp()
      });
    } else {
      // create project
      await setDoc(projectDocRef, {
        ...project,
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Delete user project
export async function deleteUserProject(uid: string, projectId: string) {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    const projectDocRef = doc(db, 'users', uid, 'projects', projectId);
    await deleteDoc(projectDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

