import { useEffect, useState } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import {
    Users,
    Calendar,
    Clock,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    TrendingDown
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        abertos: 0,
        fechados: 0,
        hoje: 0
    });
    const [userStats, setUserStats] = useState([]); // Array of { name: 'User', count: 10 }
    const [chartData, setChartData] = useState(null);
    const [monthlyChartData, setMonthlyChartData] = useState(null);

    useEffect(() => {
        async function fetchStats() {
            try {
                const chamadosRef = collection(db, 'chamados');
                const q = query(chamadosRef);
                const snapshot = await getDocs(q);

                let total = 0;
                let abertos = 0;
                let fechados = 0;
                let hoje = 0;
                const types = {};
                const userCounts = {}; // Map to store counts per user
                const monthlyCounts = {}; // "yyyy-MM" -> count

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(today.getDate() - 30);
                thirtyDaysAgo.setHours(0, 0, 0, 0);

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const dataAbertura = new Date(data.dataAbertura);

                    if (dataAbertura >= thirtyDaysAgo) total++;
                    if (data.status === 'Aberto' || data.status === 'Pendente') abertos++;
                    if (data.status === 'Fechado' && dataAbertura >= thirtyDaysAgo) fechados++;

                    if (dataAbertura >= today) hoje++;

                    // Stats for charts - Types
                    const type = data.tipo || 'Outros';
                    types[type] = (types[type] || 0) + 1;

                    // Stats for charts - Monthly Volume
                    const monthKey = format(dataAbertura, 'yyyy-MM');
                    monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;

                    // Stats per User (Active tickets only: Aberto, Pendente, Revisão)
                    if (['Aberto', 'Pendente', 'Revisão'].includes(data.status)) {
                        const resp = data.responsavel || 'Não atribuído';
                        userCounts[resp] = (userCounts[resp] || 0) + 1;
                    }
                });

                // Convert userCounts map to sorted array
                const userStatsArray = Object.entries(userCounts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count); // Sort by count desc

                setUserStats(userStatsArray);

                setStats({
                    total,
                    abertos,
                    fechados,
                    hoje
                });

                // Prepare Doughnut Chart Data
                setChartData({
                    labels: Object.keys(types),
                    datasets: [
                        {
                            label: 'Chamados por Tipo',
                            data: Object.values(types),
                            backgroundColor: [
                                'rgba(59, 130, 246, 0.7)',
                                'rgba(16, 185, 129, 0.7)',
                                'rgba(245, 158, 11, 0.7)',
                                'rgba(239, 68, 68, 0.7)',
                                'rgba(139, 92, 246, 0.7)',
                            ],
                            borderColor: [
                                'rgb(59, 130, 246)',
                                'rgb(16, 185, 129)',
                                'rgb(245, 158, 11)',
                                'rgb(239, 68, 68)',
                                'rgb(139, 92, 246)',
                            ],
                            borderWidth: 1,
                        },
                    ],
                });

                // Prepare Bar Chart Data (Monthly)
                const sortedMonths = Object.keys(monthlyCounts).sort();
                const monthLabels = sortedMonths.map(key => {
                    const [year, month] = key.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                    return format(date, 'MMM/yy', { locale: ptBR });
                });
                const monthValues = sortedMonths.map(key => monthlyCounts[key]);

                setMonthlyChartData({
                    labels: monthLabels,
                    datasets: [
                        {
                            label: 'Quantidade de Chamados',
                            data: monthValues,
                            backgroundColor: 'rgba(59, 130, 246, 0.5)',
                            borderColor: 'rgb(59, 130, 246)',
                            borderWidth: 1,
                        },
                    ],
                });

            } catch (error) {
                console.error("Erro ao buscar estatísticas:", error);
            } finally {
                setLoading(false);
            }
        }


        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Painel de Controle</h1>
                <div className="text-sm text-gray-500">
                    Atualizado em: {new Date().toLocaleTimeString('pt-BR')}
                </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Total de Chamados (Últimos 30 dias)</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.total}</h3>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-600" />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Em Aberto</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.abertos}</h3>
                        <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3" /> Requer atenção
                        </span>
                    </div>
                    <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                        <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Finalizados (Últimos 30 dias)</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.fechados}</h3>
                    </div>
                    <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Novos Hoje</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.hoje}</h3>
                        <span className="text-xs text-green-500 flex items-center gap-1 mt-1">
                            <TrendingUp className="w-3 h-3" /> +{stats.hoje} novos
                        </span>
                    </div>
                    <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                </div>
            </div>

            {/* Chamados por Responsável (Novidade) */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Chamados em Aberto por Responsável
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {userStats.length > 0 ? (
                        userStats.map((user, index) => (
                            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                    <p className="font-semibold text-gray-700">{user.name}</p>
                                    <p className="text-xs text-gray-500">Ativos</p>
                                </div>
                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center font-bold text-blue-600 border border-gray-200">
                                    {user.count}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-sm col-span-full">Nenhum chamado ativo no momento.</p>
                    )}
                </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Chamados por Tipo</h3>
                    <div className="h-64 flex items-center justify-center">
                        {chartData && <Doughnut data={chartData} options={{ maintainAspectRatio: false }} />}
                    </div>
                </div>


                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Volume Mensal</h3>
                    <div className="h-64 flex items-center justify-center">
                        {monthlyChartData ? (
                            <Bar data={monthlyChartData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
                        ) : (
                            <p className="text-gray-400">Carregando dados...</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
