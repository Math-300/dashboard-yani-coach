import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import { sendChat, type ChatMessage } from '../services/chatService';

const INITIAL_MESSAGES: ChatMessage[] = [
    {
        role: 'assistant',
        content:
            'Hola, soy Asistente Yani. Puedo ayudarte a interpretar métricas, encontrar oportunidades y resumir el estado del negocio. ¿Qué necesitas revisar hoy?'
    }
];

function formatRoleLabel(role: ChatMessage['role']) {
    if (role === 'assistant') return 'Asistente Yani';
    if (role === 'user') return 'Tú';
    return 'Sistema';
}

type ChatAssistantVariant = 'full' | 'dialog';

interface ChatAssistantProps {
    variant?: ChatAssistantVariant;
}

export default function ChatAssistant({ variant = 'full' }: ChatAssistantProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollAnchorRef = useRef<HTMLDivElement>(null);

    const hasConversation = useMemo(
        () => messages.some((message) => message.role !== 'system'),
        [messages]
    );

    useEffect(() => {
        scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, isSending]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isSending) return;

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput('');
        setIsSending(true);
        setError(null);

        try {
            const response = await sendChat(nextMessages);
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response.reply?.trim() || 'No recibí respuesta. Intenta de nuevo.'
            };
            setMessages([...nextMessages, assistantMessage]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo completar la consulta.');
        } finally {
            setIsSending(false);
        }
    };

    const Wrapper: React.ElementType = variant === 'dialog' ? 'div' : 'section';
    const isDialog = variant === 'dialog';

    return (
        <Wrapper
            className={
                isDialog
                    ? 'h-full w-full bg-transparent'
                    : 'relative overflow-hidden rounded-3xl border border-gold-500/20 bg-gradient-to-br from-gray-950 via-black/90 to-gray-900/80 shadow-[0_24px_60px_rgba(0,0,0,0.55)]'
            }
        >
            {!isDialog && (
                <>
                    <div className="pointer-events-none absolute -top-24 left-20 h-48 w-48 rounded-full bg-gold-500/10 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-28 right-10 h-56 w-56 rounded-full bg-gold-400/10 blur-3xl" />
                </>
            )}

            <div className={isDialog ? 'h-full w-full' : 'relative flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-8'}>
                {!isDialog && (
                    <header className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold-500/30 bg-gold-500/10">
                                <Bot className="h-6 w-6 text-gold-300" />
                            </div>
                            <div>
                                <p
                                    className="text-xs uppercase tracking-[0.3em] text-gold-200/70"
                                    style={{ fontFamily: '"Source Sans 3", sans-serif' }}
                                >
                                    Inteligencia Comercial
                                </p>
                                <h2
                                    className="text-2xl font-semibold text-gold-100"
                                    style={{ fontFamily: '"Cinzel", serif' }}
                                >
                                    Asistente Yani
                                </h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-full border border-gold-500/20 bg-black/50 px-3 py-1 text-xs uppercase tracking-[0.25em] text-gold-200/70">
                            <Sparkles className="h-4 w-4 text-gold-400" />
                            <span>Modo análisis</span>
                        </div>
                    </header>
                )}

                <div className={isDialog ? 'flex h-full flex-col' : 'grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'}>
                    <div className={isDialog ? 'flex h-full flex-col' : 'flex h-[520px] flex-col rounded-2xl border border-gold-500/20 bg-black/50'}>
                        <div className={isDialog ? 'flex-1 overflow-y-auto px-4 py-4' : 'flex-1 overflow-y-auto px-5 py-5'}>
                            <div className="flex flex-col gap-5">
                                {messages.map((message, index) => {
                                    const isUser = message.role === 'user';
                                    const alignClass = isUser ? 'items-end text-right' : 'items-start text-left';
                                    const bubbleClass = isUser
                                        ? 'bg-gold-500/15 text-gold-100 border border-gold-400/30'
                                        : 'bg-gray-900/80 text-gray-100 border border-gold-500/10';

                                    return (
                                        <div key={`${message.role}-${index}`} className={`flex flex-col gap-2 ${alignClass}`}>
                                            <span className="text-[11px] uppercase tracking-[0.2em] text-gold-200/60">
                                                {formatRoleLabel(message.role)}
                                            </span>
                                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${bubbleClass}`}>
                                                {message.content}
                                            </div>
                                        </div>
                                    );
                                })}

                                {isSending && (
                                    <div className="flex items-center gap-3 text-sm text-gold-200/70">
                                        <div className="flex items-center gap-1">
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-300" />
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" />
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-500" />
                                        </div>
                                        Analizando tu consulta...
                                    </div>
                                )}

                                <div ref={scrollAnchorRef} />
                            </div>
                        </div>

                        <div className={isDialog ? 'border-t border-gold-500/10 bg-black/70 px-4 py-3' : 'border-t border-gold-500/10 bg-black/70 px-5 py-4'}>
                            {error && (
                                <div className="mb-3 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-2 text-xs text-red-200">
                                    {error}
                                </div>
                            )}

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                <div className="flex-1">
                                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-gold-200/60">
                                        Tu consulta
                                    </label>
                                    <textarea
                                        value={input}
                                        onChange={(event) => setInput(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        rows={isDialog ? 2 : 3}
                                        placeholder="Ej: ¿Cómo evolucionó el pipeline esta semana?"
                                        className="w-full resize-none rounded-2xl border border-gold-500/20 bg-black/60 px-4 py-3 text-sm text-gray-100 placeholder:text-gold-200/40 shadow-inner focus:border-gold-400/60 focus:outline-none"
                                    />
                                </div>
                                <button
                                    onClick={handleSend}
                                    disabled={isSending || !input.trim()}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-gold-400/40 bg-gradient-to-r from-gold-600/40 via-gold-500/40 to-gold-400/40 px-6 text-sm font-semibold text-gold-100 transition hover:border-gold-300/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Send className="h-4 w-4" />
                                    Enviar
                                </button>
                            </div>
                        </div>
                    </div>

                    {!isDialog && (
                        <aside className="flex flex-col gap-4 rounded-2xl border border-gold-500/20 bg-black/40 p-5">
                            <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-gold-200/60">Sugerencias</p>
                                <h3 className="mt-2 text-lg font-semibold text-gold-100">Prompts recomendados</h3>
                            </div>
                            <div className="flex flex-col gap-3 text-sm text-gray-200/90">
                                <button
                                    type="button"
                                    onClick={() => setInput('Resúmeme los KPIs críticos del día con riesgos y oportunidades.')}
                                    className="rounded-xl border border-gold-500/20 bg-gold-500/10 px-4 py-3 text-left transition hover:border-gold-400/60 hover:bg-gold-500/20"
                                >
                                    Resumen ejecutivo con riesgos y oportunidades.
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInput('¿Qué vendedoras están por debajo de la meta y qué acciones sugerirías?')}
                                    className="rounded-xl border border-gold-500/20 bg-gold-500/10 px-4 py-3 text-left transition hover:border-gold-400/60 hover:bg-gold-500/20"
                                >
                                    Diagnóstico por vendedora y acciones sugeridas.
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInput('Analiza el embudo y dame los 3 cuellos de botella principales.')}
                                    className="rounded-xl border border-gold-500/20 bg-gold-500/10 px-4 py-3 text-left transition hover:border-gold-400/60 hover:bg-gold-500/20"
                                >
                                    Cuellos de botella en el embudo.
                                </button>
                            </div>
                            <div className="mt-auto rounded-2xl border border-gold-500/10 bg-black/70 px-4 py-3 text-xs text-gold-200/70">
                                {hasConversation
                                    ? 'Las respuestas se basan en datos del dashboard y contexto reciente.'
                                    : 'Inicia una conversación para generar insights con datos del dashboard.'}
                            </div>
                        </aside>
                    )}
                </div>
            </div>
        </Wrapper>
    );
}
