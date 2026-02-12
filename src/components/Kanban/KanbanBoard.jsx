import { useState, useRef, useEffect } from 'react';
import { db, auth } from '../../services/firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    writeBatch
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import {
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    ClipboardList,
    Layout,
    ListTodo
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const COLUMNS = [
    { id: 'iniciar', title: 'Iniciar', color: 'border-red-500', headerBg: 'bg-red-50 text-red-900', dotColor: 'bg-red-500' },
    { id: 'andamento', title: 'Em Andamento', color: 'border-yellow-500', headerBg: 'bg-yellow-50 text-yellow-900', dotColor: 'bg-yellow-500' },
    { id: 'analisar', title: 'Analisar', color: 'border-blue-500', headerBg: 'bg-blue-50 text-blue-900', dotColor: 'bg-blue-500' },
    { id: 'finalizado', title: 'Finalizado', color: 'border-green-500', headerBg: 'bg-green-50 text-green-900', dotColor: 'bg-green-500' }
];

const PRIORITIES = {
    baixa: { label: 'Baixa', color: 'bg-green-100 text-green-800' },
    media: { label: 'Média', color: 'bg-blue-100 text-blue-800' },
    alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
    urgente: { label: 'Urgente', color: 'bg-red-100 text-red-800' }
};

export default function KanbanBoard() {
    const [tasks, setTasks] = useState([]);
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTask, setCurrentTask] = useState(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState('media');
    const [newTodoText, setNewTodoText] = useState('');

    // Mobile Tab State: 'board' or 'todos'
    const [activeTab, setActiveTab] = useState('board');
    // Track active column index for dots indicator
    const [activeColIndex, setActiveColIndex] = useState(0);

    const scrollContainerRef = useRef(null);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setTasks([]);
                setTodos([]);
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user) return;

        // Listen for Tasks
        const qTasks = query(
            collection(db, 'kanban_tarefas'),
            where('userId', '==', user.uid)
        );

        const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
            const taskData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            taskData.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
            setTasks(taskData);
            setLoading(false);
        });

        // Listen for Todos
        const qTodos = query(
            collection(db, 'kanban_todo'),
            where('userId', '==', user.uid)
        );

        const unsubscribeTodos = onSnapshot(qTodos, (snapshot) => {
            const todoData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            todoData.sort((a, b) => {
                if (a.concluida === b.concluida) return new Date(a.dataCriacao) - new Date(b.dataCriacao);
                return a.concluida ? 1 : -1;
            });
            setTodos(todoData);
        });

        return () => {
            unsubscribeTasks();
            unsubscribeTodos();
        };
    }, [user]);

    // Handle scroll to update active dot
    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const scrollLeft = scrollContainerRef.current.scrollLeft;
            const width = scrollContainerRef.current.offsetWidth;
            const index = Math.round(scrollLeft / width);
            if (index !== activeColIndex && index >= 0 && index < COLUMNS.length) {
                setActiveColIndex(index);
            }
        }
    };

    // Auto-scroll logic (only active when board is visible)
    useEffect(() => {
        if (!loading && tasks.length > 0 && scrollContainerRef.current && activeTab === 'board') {
            const firstNonEmptyColIndex = COLUMNS.findIndex(col =>
                tasks.some(t => t.status === col.id)
            );

            if (firstNonEmptyColIndex !== -1) {
                setTimeout(() => {
                    if (scrollContainerRef.current) {
                        const width = scrollContainerRef.current.offsetWidth;
                        const scrollPos = firstNonEmptyColIndex * width;
                        scrollContainerRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
                    }
                }, 300);
            }
        }
    }, [loading, activeTab]);


    // --- Task Actions ---

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            // Default status to current active column on mobile if plausible
            let initialStatus = 'iniciar';
            if (window.innerWidth < 1024) {
                initialStatus = COLUMNS[activeColIndex]?.id || 'iniciar';
            }

            const taskData = {
                titulo: newTaskTitle.trim(),
                descricao: newTaskDesc.trim(),
                prioridade: newTaskPriority,
                status: initialStatus,
                userId: user.uid,
                dataCriacao: new Date().toISOString(),
                dataAtualizacao: new Date().toISOString()
            };

            if (currentTask) {
                await updateDoc(doc(db, 'kanban_tarefas', currentTask.id), {
                    ...taskData,
                    status: currentTask.status // Keep existing status on edit
                });
                toast.success('Tarefa atualizada!');
            } else {
                await addDoc(collection(db, 'kanban_tarefas'), taskData);
                toast.success('Tarefa criada!');
            }
            closeModal();
        } catch (error) {
            console.error("Error saving task:", error);
            toast.error('Erro ao salvar tarefa');
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Excluir tarefa?')) return;
        try {
            await deleteDoc(doc(db, 'kanban_tarefas', taskId));
            toast.success('Tarefa excluída');
        } catch (error) {
            toast.error('Erro ao excluir');
        }
    };

    const handleClearBoard = async () => {
        if (!window.confirm('Limpar quadro inteiro?')) return;
        try {
            const batch = writeBatch(db);
            tasks.forEach(task => {
                const docRef = doc(db, 'kanban_tarefas', task.id);
                batch.delete(docRef);
            });
            await batch.commit();
            toast.success('Quadro limpo!');
        } catch (error) {
            toast.error('Erro ao limpar');
        }
    };

    const handleMoveTask = async (task, direction) => {
        const currentIndex = COLUMNS.findIndex(c => c.id === task.status);
        if (currentIndex === -1) return;

        let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (newIndex < 0 || newIndex >= COLUMNS.length) return;

        const newStatus = COLUMNS[newIndex].id;

        // Optimistic update
        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, status: newStatus } : t
        );
        setTasks(updatedTasks);

        try {
            await updateDoc(doc(db, 'kanban_tarefas', task.id), {
                status: newStatus,
                dataAtualizacao: new Date().toISOString()
            });
        } catch (error) {
            toast.error('Erro ao mover tarefa');
            // Revert on error
            setTasks(tasks);
        }
    };

    // --- Drag & Drop ---

    const handleDragStart = (e, taskId) => {
        e.dataTransfer.setData('taskId', taskId);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = async (e, newStatus) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');

        const task = tasks.find(t => t.id === taskId);
        if (!task || task.status === newStatus) return;

        // Optimistic update
        const updatedTasks = tasks.map(t =>
            t.id === taskId ? { ...t, status: newStatus } : t
        );
        setTasks(updatedTasks);

        try {
            await updateDoc(doc(db, 'kanban_tarefas', taskId), {
                status: newStatus,
                dataAtualizacao: new Date().toISOString()
            });
            toast.success('Tarefa movida!');
        } catch (error) {
            toast.error('Erro ao mover tarefa');
        }
    };

    // --- Todo Actions ---

    const handleAddTodo = async () => {
        if (!newTodoText.trim()) return;
        try {
            await addDoc(collection(db, 'kanban_todo'), {
                texto: newTodoText.trim(),
                concluida: false,
                userId: user.uid,
                dataCriacao: new Date().toISOString()
            });
            setNewTodoText('');
        } catch (error) {
            toast.error('Erro ao adicionar');
        }
    };

    const handleToggleTodo = async (todo) => {
        try {
            await updateDoc(doc(db, 'kanban_todo', todo.id), {
                concluida: !todo.concluida
            });
        } catch (error) {
            toast.error('Erro ao atualizar');
        }
    };

    const handleDeleteTodo = async (todoId) => {
        try {
            await deleteDoc(doc(db, 'kanban_todo', todoId));
        } catch (error) {
            toast.error('Erro ao excluir');
        }
    };

    // --- Modal Helpers ---

    const openModal = (task = null) => {
        setCurrentTask(task);
        if (task) {
            setNewTaskTitle(task.titulo);
            setNewTaskDesc(task.descricao || '');
            setNewTaskPriority(task.prioridade);
        } else {
            setNewTaskTitle('');
            setNewTaskDesc('');
            setNewTaskPriority('media');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentTask(null);
    };

    if (loading) return <div className="flex justify-center p-10">Carregando quadro...</div>;
    if (!user) return <div className="flex justify-center p-10">Faça login para acessar seu Kanban.</div>;

    const getTasksByStatus = (status) => tasks.filter(t => t.status === status);

    return (
        <div className="w-full max-w-full h-[calc(100vh-130px)] lg:h-[calc(100vh-50px)] flex flex-col p-1 lg:p-4 bg-slate-50 relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Layout className="w-6 h-6 text-blue-600" />
                    Meu Quadro Kanban
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => openModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">Nova Tarefa</span>
                    </button>
                    <button
                        onClick={handleClearBoard}
                        className="bg-red-100 hover:bg-red-200 text-red-700 p-2 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                    >
                        <Trash2 className="w-5 h-5" />
                        <span className="hidden sm:inline">Limpar</span>
                    </button>
                </div>
            </div>

            {/* Mobile Tabs (Board vs Todos) */}
            <div className="flex lg:hidden mb-4 bg-white rounded-lg p-1 border border-slate-200 shadow-sm flex-shrink-0">
                <button
                    onClick={() => setActiveTab('board')}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'board'
                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50'
                        }`}
                >
                    <Layout className="w-4 h-4" />
                    Quadro
                </button>
                <button
                    onClick={() => setActiveTab('todos')}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'todos'
                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50'
                        }`}
                >
                    <ListTodo className="w-4 h-4" />
                    Tarefas
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 w-full">
                {/* Main Board - Visible if activeTab is 'board' OR if screen is large */}
                <div className={`flex-1 w-full overflow-hidden flex flex-col relative ${activeTab === 'board' ? 'flex' : 'hidden lg:flex'}`}>

                    {/* Columns Container */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex lg:gap-4 flex-1 min-h-0 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-0 lg:pb-2 w-full"
                    >
                        {COLUMNS.map((column, index) => (
                            <div
                                key={column.id}
                                className={`
                                    w-full flex-shrink-0 lg:w-[304px] lg:flex-none flex flex-col rounded-xl shadow-sm border border-slate-200 bg-white border-t-4 ${column.color} snap-start h-full
                                `}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, column.id)}
                            >
                                <div className={`p-4 border-b border-slate-100 flex justify-between items-center rounded-t-lg bg-slate-50 flex-shrink-0`}>
                                    <h3 className="font-semibold text-slate-700">{column.title}</h3>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${column.headerBg.replace('text-', 'bg-').replace('50', '100')} ${column.headerBg.replace('bg-', 'text-').replace('50', '800')}`}>
                                        {getTasksByStatus(column.id).length}
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-8 lg:pb-3 flex flex-col">
                                    {getTasksByStatus(column.id).map(task => (
                                        <div
                                            key={task.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                            className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-move hover:shadow-md transition-all group flex-shrink-0"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-medium text-slate-800 line-clamp-2 text-sm">{task.titulo}</h4>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${PRIORITIES[task.prioridade].color}`}>
                                                    {PRIORITIES[task.prioridade].label}
                                                </span>
                                            </div>

                                            {task.descricao && (
                                                <p className="text-xs text-slate-500 mb-2 line-clamp-3">{task.descricao}</p>
                                            )}

                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(task.dataCriacao).toLocaleDateString('pt-BR')}
                                                </span>
                                                <div className="flex gap-1 items-center">
                                                    {/* Mobile Navigation Arrows */}
                                                    <div className="flex gap-1 lg:hidden">
                                                        {index > 0 && (
                                                            <button
                                                                onClick={() => handleMoveTask(task, 'prev')}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-full"
                                                                title="Mover para esquerda"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                                            </button>
                                                        )}
                                                        {index < COLUMNS.length - 1 && (
                                                            <button
                                                                onClick={() => handleMoveTask(task, 'next')}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-full"
                                                                title="Mover para direita"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity ml-2 border-l pl-2 border-slate-100">
                                                        <button
                                                            onClick={() => openModal(task)}
                                                            className="p-1 text-slate-400 hover:text-blue-600 rounded"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTask(task.id)}
                                                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {getTasksByStatus(column.id).length === 0 && (
                                        <div className="flex flex-1 items-center justify-center text-slate-400 text-sm italic h-full">
                                            Arraste tarefas aqui
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Mobile Page Indicators (Dots) */}
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 lg:hidden z-10 pointer-events-none">
                        {COLUMNS.map((col, idx) => (
                            <div
                                key={idx}
                                className={`w-2 h-2 rounded-full transition-all shadow-sm ${idx === activeColIndex ? `${col.dotColor} w-4` : 'bg-slate-300'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Sidebar - Todo List - Visible if activeTab is 'todos' OR if screen is large */}
                <div className={`w-full lg:w-[304px] bg-white rounded-xl shadow-sm border border-slate-200 flex-col h-full ${activeTab === 'todos' ? 'flex' : 'hidden lg:flex'}`}>
                    <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-xl flex-shrink-0">
                        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-green-600" />
                            Lista de Tarefas
                        </h3>
                    </div>

                    <div className="p-3 border-b border-slate-100 bg-white flex-shrink-0">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTodoText}
                                onChange={(e) => setNewTodoText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                                placeholder="Adicionar nova tarefa..."
                                className="flex-1 text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleAddTodo}
                                className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-md transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {todos.map(todo => (
                            <div
                                key={todo.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${todo.concluida
                                    ? 'bg-slate-50 border-slate-100 opacity-70'
                                    : 'bg-white border-slate-200 hover:border-blue-300'
                                    }`}
                            >
                                <button
                                    onClick={() => handleToggleTodo(todo)}
                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${todo.concluida
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : 'border-slate-300 hover:border-green-500 text-transparent hover:text-green-200'
                                        }`}
                                >
                                    <Check className="w-3 h-3" />
                                </button>
                                <span className={`flex-1 text-sm ${todo.concluida ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                    {todo.texto}
                                </span>
                                <button
                                    onClick={() => handleDeleteTodo(todo.id)}
                                    className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {todos.length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-sm italic">
                                Nenhuma tarefa pendente
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Nova/Editar Tarefa */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                {currentTask ? <Edit2 className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                                {currentTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleAddTask} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={100}
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="Ex: Atualizar estoque"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                                <select
                                    value={newTaskPriority}
                                    onChange={(e) => setNewTaskPriority(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                >
                                    <option value="baixa">Baixa</option>
                                    <option value="media">Média</option>
                                    <option value="alta">Alta</option>
                                    <option value="urgente">Urgente</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                                <textarea
                                    rows={4}
                                    maxLength={500}
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                                    placeholder="Detalhes da tarefa..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
