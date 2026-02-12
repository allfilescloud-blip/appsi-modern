import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../../services/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { LogIn, UserPlus, Headphones } from "lucide-react";

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                toast.success("Login realizado com sucesso!");
                navigate("/");
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                await updateProfile(user, { displayName: name });
                await setDoc(doc(db, "usuarios", user.uid), {
                    nome: name,
                    email: email,
                    dataCriacao: new Date().toISOString()
                });

                toast.success("Conta criada com sucesso!");
                navigate("/");
            }
        } catch (error) {
            console.error(error);
            let message = "Ocorreu um erro.";
            if (error.code === "auth/wrong-password") message = "Senha incorreta.";
            if (error.code === "auth/user-not-found") message = "Usuário não encontrado.";
            if (error.code === "auth/email-already-in-use") message = "Email já está em uso.";
            if (error.code === "auth/weak-password") message = "A senha deve ter pelo menos 6 caracteres.";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-8">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                            <Headphones className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Sistema de Atendimentos</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            {isLogin ? "Faça login para continuar" : "Crie sua conta"}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                    placeholder="Seu nome"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : isLogin ? (
                                <>
                                    <LogIn className="w-5 h-5" /> Entrar
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-5 h-5" /> Criar Conta
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center pt-6 border-t border-gray-100">
                        <p className="text-gray-600 text-sm">
                            {isLogin ? "Não tem uma conta?" : "Já possui conta?"}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="ml-2 font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                {isLogin ? "Cadastre-se" : "Fazer Login"}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
