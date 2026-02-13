import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Suspense, lazy } from "react";

// Lazy Components
const Login = lazy(() => import("./components/Auth/Login"));
const Layout = lazy(() => import("./components/Layout/Layout"));
const Dashboard = lazy(() => import("./components/Dashboard/Dashboard"));
const TicketList = lazy(() => import("./components/Tickets/TicketList"));
const TicketForm = lazy(() => import("./components/Tickets/TicketForm"));
const TicketDetails = lazy(() => import("./components/Tickets/TicketDetails"));
const KanbanBoard = lazy(() => import("./components/Kanban/KanbanBoard"));
const Inventory = lazy(() => import("./components/Inventory/Inventory"));
const Verification = lazy(() => import("./components/Verification/Verification"));
const Support = lazy(() => import("./components/Support/Support"));
const Settings = lazy(() => import("./components/Settings/Settings"));
const Flex = lazy(() => import("./components/Flex/Flex"));

const Loading = () => <div className="flex items-center justify-center h-screen bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

function App() {
    return (
        <AuthProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suspense fallback={<Loading />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />


                        {/* Protected Routes */}
                        <Route path="/*" element={
                            <ProtectedRoute>
                                <Layout>
                                    <Routes>
                                        <Route path="/" element={<Dashboard />} />

                                        {/* Chamados */}
                                        <Route path="/chamados" element={<TicketList />} />
                                        <Route path="/chamados/novo" element={<TicketForm />} />
                                        <Route path="/chamados/:id" element={<TicketDetails />} />
                                        <Route path="/chamados/editar/:id" element={<TicketForm />} />

                                        {/* Outros Módulos */}
                                        <Route path="/kanban" element={<KanbanBoard />} />
                                        <Route path="/estoque" element={<Inventory />} />
                                        <Route path="/verificacao" element={<Verification />} />
                                        <Route path="/suporte" element={<Support />} />
                                        <Route path="/configuracoes" element={<Settings />} />
                                        <Route path="/flex" element={<Flex />} />
                                    </Routes>
                                </Layout>
                            </ProtectedRoute>
                        } />

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </Router>
            <ToastContainer autoClose={3000} />
        </AuthProvider>
    );
}

export default App;
