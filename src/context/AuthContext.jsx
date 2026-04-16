import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../services/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [iderisSettings, setIderisSettings] = useState({ enabled: false, apiKey: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        const isAdmin = data.email === 'admin@admin.com' || data.isAdmin === true;

                        // Garante que usuários antigos sem status sejam 'aprovado'
                        const status = isAdmin ? 'aprovado' : (data.status || 'aprovado');

                        // Permissões padrão (true para tudo se não definido, mantendo acesso de usuários antigos)
                        const permissions = data.permissions || {
                            kanban: true,
                            estoque: true,
                            suporte: true,
                            flex: true,
                            verificacao: true
                        };

                        setUserData({
                            ...data,
                            isAdmin,
                            status,
                            permissions
                        });
                    } else if (user.email === 'admin@admin.com') {
                        // Fallback pro admin caso logue antes do documento Firestore ser criado
                        setUserData({
                            email: user.email,
                            nome: 'Administrador',
                            isAdmin: true,
                            status: 'aprovado',
                            permissions: { kanban: true, estoque: true, suporte: true, flex: true, verificacao: true }
                        });
                    } else {
                        setUserData(null);
                    }
                } catch (error) {
                    console.error("Erro ao buscar dados do usuário:", error);
                }

                // Carregar configurações do Ideris
                try {
                    const iderisDoc = await getDoc(doc(db, "sys_settings", "ideris"));
                    if (iderisDoc.exists()) {
                        setIderisSettings(iderisDoc.data());
                    }
                } catch (error) {
                    console.error("Erro ao carregar configurações do Ideris no AuthContext:", error);
                }
            } else {
                setUserData(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const logout = () => {
        return firebaseSignOut(auth);
    };

    const value = {
        currentUser,
        userData,
        iderisSettings,
        setIderisSettings,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
