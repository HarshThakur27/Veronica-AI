"use client"
import React from 'react'
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
export default function Chat() {
    const [data, setdata] = React.useState<{ role: string, content: string, fileName?: string }[]>([])
    const [query, setquery] = React.useState<string>("")
    const [threadid, setThreadid] = React.useState<string>(() => crypto.randomUUID())
    const [thread, setthread] = React.useState<{ thread_id: string, title: string }[]>([])
    const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(false)
    const [file, setfile] = React.useState<File | null>(null)
    const [isLoading, setIsLoading] = React.useState<boolean>(false)

    // Ref for Aborting Fetch Stream
    const abortControllerRef = React.useRef<AbortController | null>(null)

    // Ref for Auto-Scrolling
    const messagesEndRef = React.useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    // Auto scroll when message data updates
    React.useEffect(() => {
        scrollToBottom()
    }, [data, isLoading])

    async function fetchthread() {
    try {
        const res = await fetch(`${API_URL}/threads`)
        const data = await res.json()
        setthread(data)   // yeh await ke baad hai, technically async hai
    } catch (err) {
        console.error("Failed to fetch threads", err)
    }
}


    React.useEffect(() => {
        fetchthread()
    }, [])// eslint-disable-line react-hooks/exhaustive-deps

    async function loadThread(threadId: string) {
        setThreadid(threadId);
        const res = await fetch(`${API_URL}/history/${threadId}`);
        const history = await res.json();
        setdata(history);
        setIsSidebarOpen(false); // Auto close sidebar on mobile selection
    }

    async function deleteThread(e: React.MouseEvent, targetThreadId: string) {
        e.stopPropagation(); // Stop thread load event
        try {
            await fetch(`${API_URL}/thread/${targetThreadId}`, {
                method: "DELETE",
            });
            setthread(prev => prev.filter(item => item.thread_id !== targetThreadId));
            if (threadid === targetThreadId) {
                newChat();
            }
        } catch (err) {
            console.error("Failed to delete thread", err);
        }
    }

    function newChat() {
        if (isLoading) stopGenerating();
        setThreadid(crypto.randomUUID());
        setdata([]);
        setIsSidebarOpen(false);
    }

    function stopGenerating() {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);

        // Append explicit stop message to last assistant item
        setdata(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
                const currentText = updated[lastIndex].content;
                updated[lastIndex] = {
                    ...updated[lastIndex],
                    content: currentText 
                        ? `${currentText}\n\n_[Generation stopped by user]_` 
                        : "_[Generation stopped by user]_"
                };
            }
            return updated;
        });
    }

    async function send(customQuery?: string, isRetry: boolean = false) {
        const textToSend = customQuery ?? query;
        if ((!textToSend.trim() && !file) || isLoading) return;

        const currentFile = file;
        const fileNameToSave = currentFile?.name;

        if (!isRetry) {
            setdata(prev => [...prev, { role: "user", content: textToSend, fileName: fileNameToSave }]);
            setdata(prev => [...prev, { role: "assistant", content: "" }]);
            setquery("");
            setfile(null);
        } else {
            // In retry mode, update assistant slot with fresh empty state
            setdata(prev => {
                const updated = [...prev];
                if (updated[updated.length - 1].role === "assistant") {
                    updated[updated.length - 1] = { role: "assistant", content: "" };
                } else {
                    updated.push({ role: "assistant", content: "" });
                }
                return updated;
            });
        }

        setIsLoading(true);

        // AbortController Setup
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            if (currentFile && !isRetry) {
                const formData = new FormData();
                formData.append("file", currentFile);
                formData.append("thread_id", threadid);
                await fetch(`${API_URL}/upload`, {
                    method: "POST",
                    body: formData,
                    signal: controller.signal,
                });
            }

            const response = await fetch(`${API_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: textToSend, thread_id: threadid }),
                signal: controller.signal,
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);

                setdata(prev => {
                    const updated = [...prev];
                    const lastIndex = updated.length - 1;
                    updated[lastIndex] = {
                        ...updated[lastIndex],
                        role: "assistant",
                        content: updated[lastIndex].content + chunk
                    };
                    return updated;
                });
                await delay(20);
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
        console.log('Generation stopped by user');
    } else {
        console.error("Error in streaming answer", err);
    }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
            fetchthread();
        }
    }

    function resendLastUserMessage() {
        let lastUserMessage = "";
        for (let i = data.length - 1; i >= 0; i--) {
            if (data[i].role === "user") {
                lastUserMessage = data[i].content;
                break;
            }
        }
        if (lastUserMessage) {
            send(lastUserMessage, true);
        }
    }

    function delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    return (
        <div className="flex h-screen bg-white text-gray-800 font-sans antialiased">
            {/* Mobile Sidebar Backdrop */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed md:static inset-y-0 left-0 z-30
                w-64 bg-gray-50 border-r border-gray-200 flex flex-col p-3 transition-transform duration-200 ease-in-out
                ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}>
                {/* New Chat Button */}
                <button 
                    onClick={newChat} 
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 transition-colors text-left text-gray-700 shadow-sm mb-4 bg-white"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New chat
                </button>

                {/* Sidebar History List */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Chat history
                    </p>
                    {thread.map((i) => (
                        <div 
                            key={i.thread_id} 
                            onClick={() => loadThread(i.thread_id)}
                            className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                                threadid === i.thread_id ? "bg-gray-200/70 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-100"
                            }`}
                        >
                            <span className="truncate flex-1 pr-2">{i.title || "Untitled Thread"}</span>
                            
                            {/* Delete Button */}
                            <button
                                onClick={(e) => deleteThread(e, i.thread_id)}
                                title="Delete Chat"
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 rounded text-gray-400 transition-opacity"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-white">
                {/* Header */}
                <header className="h-14 border-b border-gray-200 flex items-center justify-between px-4 md:px-6 bg-white/80 backdrop-blur">
                    <div className="flex items-center gap-3">
                        {/* Hamburger Button for Mobile */}
                        <button 
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <h1 className="text-lg font-semibold text-gray-800">Veronica AI</h1>
                    </div>
                </header>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-3xl w-full mx-auto">
                    {data.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-3">
                            <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xl font-bold text-gray-600">
                                V
                            </div>
                            <p className="text-sm font-medium text-gray-500">How can I help you today?</p>
                        </div>
                    ) : (
                        data.map((msg, index) => (
                            <div key={index} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                <div className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                    msg.role === "user" 
                                        ? "bg-gray-100 text-gray-900 border border-gray-200" 
                                        : "bg-transparent text-gray-800"
                                }`}>
                                    <div className="text-xs font-bold mb-1 text-gray-400 uppercase tracking-wider">
                                        {msg.role}
                                    </div>

                                    {/* Uploaded File Badge Shown Inside User Chat */}
                                    {msg.role === "user" && msg.fileName && (
                                        <div className="flex items-center gap-1.5 bg-gray-200/80 text-gray-800 text-xs px-2.5 py-1 rounded-lg w-fit mb-2 border border-gray-300">
                                            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="font-medium truncate max-w-[180px]">{msg.fileName}</span>
                                        </div>
                                    )}

                                    <div className="whitespace-pre-wrap">{msg.content}</div>

                                    {/* Loading Animation */}
                                    {msg.role === "assistant" && !msg.content && isLoading && index === data.length - 1 && (
                                        <div className="flex items-center gap-1.5 py-1">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                        </div>
                                    )}
                                </div>

                                {/* Retry/Resend Button for Stopped or Last Assistant Message */}
                                {msg.role === "assistant" && !isLoading && index === data.length - 1 && (
                                    <button
                                        onClick={resendLastUserMessage}
                                        className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded-md hover:bg-gray-100"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Regenerate
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                    {/* Dummy div to scroll into view */}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 md:p-4 max-w-3xl w-full mx-auto">
                    <div className="flex flex-col bg-white rounded-2xl border border-gray-300 shadow-sm focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-400 transition-all p-2">
                        
                        {/* File Preview Badge (Before sending) */}
                        {file && (
                            <div className="flex items-center gap-2 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg w-fit mb-1 border border-gray-200">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="max-w-[200px] truncate">{file.name}</span>
                                <button 
                                    onClick={() => setfile(null)}
                                    className="text-gray-400 hover:text-gray-600 ml-1"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        <div className="relative flex items-center">
                            {/* Hidden File Input */}
                            <input 
                                id="file-upload"
                                type="file" 
                                accept=".pdf"
                                onChange={(e) => setfile(e.target.files?.[0] || null)}
                                className="hidden"
                            />
                            
                            {/* Paperclip Button */}
                            <label 
                                htmlFor="file-upload"
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
                                title="Attach PDF"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                            </label>

                            {/* Text Input */}
                            <input 
                                type="text" 
                                value={query}
                                onChange={(e) => setquery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && send()}
                                placeholder="Message Veronica AI..."
                                className="w-full bg-transparent text-gray-900 placeholder-gray-400 text-sm px-3 py-2 focus:outline-none pr-12"
                            />

                            {/* Send / Stop Button */}
                            {isLoading ? (
                                <button 
                                    onClick={stopGenerating}
                                    title="Stop generating"
                                    className="absolute right-1 p-1.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all flex items-center justify-center"
                                >
                                    <div className="w-3.5 h-3.5 bg-white rounded-sm"></div>
                                </button>
                            ) : (
                                <button 
                                    onClick={() => send()}
                                    disabled={!query.trim() && !file}
                                    className="absolute right-1 p-1.5 bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-20 disabled:hover:bg-black transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}