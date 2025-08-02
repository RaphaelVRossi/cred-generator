import React, { useState, useEffect, useRef } from 'react';
// As bibliotecas html2canvas e jspdf
// precisam ser carregadas via CDN no seu arquivo HTML para que o aplicativo funcione.
// Exemplo de como incluir no <head> ou antes do fechamento do <body>:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>


// Função auxiliar para escurecer/clarear uma cor hexadecimal
const adjustColor = (hex, percent) => {
    if (!hex || typeof hex !== 'string') return hex;

    // Remove o # se existir
    hex = hex.startsWith('#') ? hex.slice(1) : hex;

    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r = Math.min(255, Math.max(0, r + (r * percent / 100)));
    g = Math.min(255, Math.max(0, g + (g * percent / 100)));
    b = Math.min(255, Math.max(0, b + (b * percent / 100)));

    const toHex = (c) => Math.round(c).toString(16).padStart(2, '0');

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};


// Componente principal da aplicação
const App = () => {
    // Estados para o formulário de participante
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [empresa, setEmpresa] = useState(''); // Novo estado para a empresa
    const [profilePictureBase64, setProfilePictureBase64] = useState(''); // Estado para a foto de perfil em Base64
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [participant, setParticipant] = useState(null); // Armazena os dados do participante cadastrado
    const [latestEvent, setLatestEvent] = useState(null); // Armazena os dados do último evento
    const credentialRef = useRef(null); // Referência para o elemento da credencial para download
  const [isAuthReady, setAuthReady] = useState(false);

    // URL do logo da Golang Sampa
    const golangLogoUrl = 'https://golang.sampa.br/img/golangsp01.png';


    // Função para buscar o último evento
    useEffect(() => {
        const fetchLatestEvent = async () => {
            try {
        if (isAuthReady) return

                setLoading(true);
                const response = await fetch('http://localhost:8080/events');
                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                const events = await response.json();
                if (events && events.length > 0) {
                    // Assumindo que o último evento é o último na lista ou o mais recente por data (se a API ordenar)
                    // Para simplificar, pegaremos o último item retornado.
                    // Em um cenário real, você pode precisar ordenar por data.
                    setLatestEvent(events[events.length - 1]);
                } else {
                    setError('Nenhum evento encontrado para vincular a credencial.');
                }
            } catch (err) {
                console.error("Erro ao buscar eventos:", err);
                setError(`Erro ao carregar eventos: ${err.message}. Certifique-se de que o backend está rodando.`);
            } finally {
                setLoading(false);
            }
        };

        fetchLatestEvent();
    }, [isAuthReady]); // Depende de isAuthReady para garantir que o Firebase está pronto

    // Função para lidar com o upload da foto de perfil
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Por favor, selecione um arquivo de imagem válido.');
                setProfilePictureBase64('');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePictureBase64(reader.result); // O resultado já é a string Base64
                setError('');
            };
            reader.onerror = () => {
                setError('Erro ao ler o arquivo. Tente novamente.');
                setProfilePictureBase64('');
            };
            reader.readAsDataURL(file);
        } else {
            setProfilePictureBase64('');
        }
    };

    // Função para lidar com o cadastro do participante
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMessage('');
        setParticipant(null);

        if (!nome || !email) {
            setError('Por favor, preencha todos os campos.');
            setLoading(false);
            return;
        }

        // Dados do participante, incluindo a foto de perfil em Base64 e a empresa
        const participantData = {
            nome,
            email,
            empresa, // Inclui o campo empresa
        };

        try {
            const response = await fetch('http://localhost:8080/participants', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(participantData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Erro no cadastro: ${response.status}`);
            }

            // A API de backend deve retornar 'eventos_participados' no objeto 'data'
            setParticipant(data);
            setSuccessMessage('Participante cadastrado com sucesso! Sua credencial está pronta.');
        } catch (err) {
            console.error("Erro ao cadastrar participante:", err);
            setError(`Erro ao cadastrar: ${err.message}. Verifique se o email já está em uso ou se há um evento para vincular.`);
        } finally {
            setLoading(false);
        }
    };

    // Função para gerar e compartilhar a credencial nas redes sociais
    const shareCredential = async () => {
        if (!credentialRef.current) {
            setError("Erro: Elemento da credencial não encontrado para compartilhamento.");
            return;
        }
        // Verifica se a biblioteca html2canvas está disponível globalmente
        if (!window.html2canvas) {
            setError("Erro: Biblioteca html2canvas não carregada. Por favor, inclua-a via CDN.");
            return;
        }

        setLoading(true);
        try {
            // Renderiza o elemento HTML da credencial em um canvas
            const canvas = await window.html2canvas(credentialRef.current, {
                scale: 2, // Aumenta a resolução para melhor qualidade
                useCORS: true, // Importante se houver imagens de outras origens
            });

            // Converte o canvas para uma imagem PNG em formato blob
            canvas.toBlob(async (blob) => {
                try {
                    // Cria um arquivo a partir do blob
                    const file = new File([blob], `credencial_${participant.nome.replace(/\s/g, '_')}.png`, { type: 'image/png' });
                    
                    // Verifica se a API Web Share está disponível
                    if (navigator.share) {
                        await navigator.share({
                            title: 'Minha Credencial Golang Sampa',
                            text: `Credencial de ${participant.nome} para o evento ${latestEvent?.nome || 'Golang Sampa'}`,
                            files: [file]
                        });
                        setSuccessMessage('Credencial compartilhada com sucesso!');
                    } else {
                        // Fallback para navegadores que não suportam a API Web Share
                        // Cria um URL temporário para a imagem
                        const imageUrl = URL.createObjectURL(blob);
                        
                        // Cria um link para download
                        const link = document.createElement('a');
                        link.href = imageUrl;
                        link.download = `credencial_${participant.nome.replace(/\s/g, '_')}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Libera o URL temporário
                        URL.revokeObjectURL(imageUrl);
                        
                        setSuccessMessage('Imagem da credencial salva! Agora você pode compartilhá-la nas redes sociais.');
                    }
                } catch (err) {
                    console.error("Erro ao compartilhar credencial:", err);
                    setError(`Erro ao compartilhar a credencial: ${err.message}. Tente salvar a imagem e compartilhar manualmente.`);
                } finally {
                    setLoading(false);
                }
            }, 'image/png');
        } catch (err) {
            console.error("Erro ao gerar imagem da credencial:", err);
            setError(`Erro ao gerar imagem da credencial: ${err.message}.`);
            setLoading(false);
        }
    };

    // Cores dinâmicas
    const eventBgColor = latestEvent?.background_color || '#1F2937'; // Padrão cinza escuro
    const eventTextColor = latestEvent?.text_color || '#FFFFFF'; // Padrão branco

    // Cores para os botões e bordas baseadas nas cores do evento
    const buttonBgColor = adjustColor(eventBgColor, 20); // Um pouco mais claro que o fundo do evento
    const buttonHoverBgColor = adjustColor(eventBgColor, 30); // Mais claro ainda para hover
    const buttonRingColor = adjustColor(eventTextColor, -20); // Um pouco mais escuro que a cor do texto do evento

    // Componente de ícone de perfil SVG
    const ProfileIcon = ({ color, size = '24' }) => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-${size/4} h-${size/4} mx-auto`} // Ajuste para o tamanho do Tailwind
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>
    );

    // Componente de ícone de estrela SVG
    const StarIcon = ({ color }) => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={color} // A estrela será preenchida com a cor
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5" // Tamanho padrão para a estrela
        >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
    );

    return (
        
        <div
            className="min-h-screen font-inter flex flex-col items-center justify-center p-3 sm:p-4 md:p-6"
            style={{
                backgroundColor: eventBgColor,
                color: eventTextColor
            }}
        >
            {/* O bloco de exibição do User ID foi removido daqui */}

            <div className="bg-gray-800 bg-opacity-90 rounded-xl shadow-2xl p-3 sm:p-6 md:p-8 max-w-xs sm:max-w-sm md:max-w-lg w-full transform transition-all duration-300 hover:scale-105 mx-auto">
                <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-center mb-3 sm:mb-6" style={{ color: "#eceff1" }}>
                    Checkin GolangSP
                </h1>

                {error && (
                    <div className="bg-red-600 bg-opacity-80 text-white p-2 sm:p-4 rounded-lg mb-3 sm:mb-4 flex items-center justify-between shadow-md text-xs sm:text-base">
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="text-white font-bold text-lg sm:text-xl ml-2 sm:ml-4">&times;</button>
                    </div>
                )}

                {successMessage && (
                    <div className="bg-green-600 bg-opacity-80 text-white p-2 sm:p-4 rounded-lg mb-3 sm:mb-4 flex items-center justify-between shadow-md text-xs sm:text-base">
                        <span>{successMessage}</span>
                        <button onClick={() => setSuccessMessage('')} className="text-white font-bold text-lg sm:text-xl ml-2 sm:ml-4">&times;</button>
                    </div>
                )}

                {!latestEvent ? (
                    <div className="text-center py-4 sm:py-8">
                        <p className="text-base sm:text-xl text-yellow-400 mb-2 sm:mb-4">Nenhum evento disponível no momento</p>
                        <p className="text-sm sm:text-base text-gray-400">Por favor, tente novamente mais tarde.</p>
                    </div>
                ) : !participant ? (
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                        <div>
                            <label htmlFor="nome" className="block text-base sm:text-lg font-medium text-gray-300 mb-1 sm:mb-2">
                                Nome Completo
                            </label>
                            <input
                                type="text"
                                id="nome"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                className="w-full px-3 sm:px-5 py-2 sm:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
                                style={{ borderColor: adjustColor(eventTextColor, -30), focusRingColor: buttonRingColor }} // Borda e foco dinâmicos
                                placeholder="Seu nome"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-base sm:text-lg font-medium text-gray-300 mb-1 sm:mb-2">
                                E-mail
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 sm:px-5 py-2 sm:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
                                style={{ borderColor: adjustColor(eventTextColor, -30), focusRingColor: buttonRingColor }} // Borda e foco dinâmicos
                                placeholder="seu.email@exemplo.com"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="empresa" className="block text-base sm:text-lg font-medium text-gray-300 mb-1 sm:mb-2">
                                Empresa (Opcional)
                            </label>
                            <input
                                type="text"
                                id="empresa"
                                value={empresa}
                                onChange={(e) => setEmpresa(e.target.value)}
                                className="w-full px-3 sm:px-5 py-2 sm:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
                                style={{ borderColor: adjustColor(eventTextColor, -30), focusRingColor: buttonRingColor }} // Borda e foco dinâmicos
                                placeholder="Nome da sua empresa"
                            />
                        </div>
                        <div>
                            <label htmlFor="profilePicture" className="block text-base sm:text-lg font-medium text-gray-300 mb-1 sm:mb-2">
                                Foto de Perfil (Opcional)
                            </label>
                            <input
                                type="file"
                                id="profilePicture"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="w-full px-3 sm:px-5 py-2 sm:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 file:mr-2 sm:file:mr-4 file:py-1 sm:file:py-2 file:px-2 sm:file:px-4 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-500"
                            />
                            {/* Pré-visualização da imagem ou ícone de perfil */}
                            <div className="mt-3 sm:mt-4 text-center">
                                <p className="text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">Pré-visualização da Imagem:</p>
                                {profilePictureBase64 ? (
                                    <img src={profilePictureBase64} alt="Pré-visualização da Foto de Perfil" className="max-w-full sm:max-w-xs max-h-32 sm:max-h-48 mx-auto rounded-lg shadow-md object-cover" />
                                ) : (
                                    <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto flex items-center justify-center rounded-full bg-gray-700 border-2" style={{ borderColor: eventTextColor }}>
                                        <ProfileIcon color={eventTextColor} size="20" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                                type="submit"
                                className="w-full text-white font-bold py-1.5 sm:py-3 px-3 sm:px-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-base"
                                style={{ backgroundColor: buttonBgColor, color: eventTextColor, '--tw-ring-color': buttonRingColor }} // Cores dinâmicas para o botão
                                disabled={loading || !latestEvent}
                            >
                                {loading ? 'Cadastrando...' : 'Gerar Minha Credencial'}
                            </button>
                        {!latestEvent && !loading && (
                            <p className="text-center text-yellow-400 text-sm mt-4">
                                Aguardando a disponibilidade de um evento para vincular a credencial.
                            </p>
                        )}
                    </form>
                ) : (
                    <div className="flex flex-col items-center space-y-4 sm:space-y-6">
                        <h2 className="text-2xl sm:text-3xl font-bold text-center" style={{ color: "#eceff1" }}>Sua Credencial</h2>
                        <div
                            ref={credentialRef}
                            className="border-3 sm:border-4 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl w-full max-w-xs sm:max-w-sm text-center transform hover:scale-105 transition-all duration-500 rotate-y-3 perspective-1000 relative overflow-hidden"
                            style={{
                                transformStyle: 'preserve-3d',
                                backgroundColor: eventBgColor, // Usa a cor de fundo do evento
                                color: eventTextColor, // Usa a cor do texto do evento
                                borderColor: eventTextColor, // Borda da credencial com a cor do texto do evento
                                boxShadow: `0 10px 25px -5px ${adjustColor(eventBgColor, -30)}, 0 8px 10px -6px ${adjustColor(eventBgColor, -50)}`
                            }}
                        >
                            <div className="relative z-10">
                                {/* Foto de perfil ou ícone de perfil */}
                                {profilePictureBase64 ? (
                                    <img
                                        src={profilePictureBase64}
                                        alt="Foto de Perfil"
                                        className="w-16 h-16 sm:w-24 sm:h-24 rounded-full mx-auto mb-2 sm:mb-4 object-cover border-2 shadow-lg transform transition-all duration-300 hover:scale-110"
                                        style={{ borderColor: eventTextColor }}
                                    />
                                ) : (
                                    <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto flex items-center justify-center rounded-full bg-gray-700 border-2 shadow-lg transform transition-all duration-300 hover:scale-110" style={{ borderColor: eventTextColor }}>
                                        <ProfileIcon color={eventTextColor} size="20" />
                                    </div>
                                )}
                                <p className="text-base sm:text-lg mb-1 sm:mb-2">Participante:</p>
                                <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-2 sm:mb-4 uppercase tracking-wide">{participant.nome}</p>
                                {/* Email removido para melhorar a privacidade quando compartilhada nas redes sociais */}
                                {participant.empresa && ( // Exibe a empresa se estiver disponível
                                    <div className="flex items-center justify-center mb-1 sm:mb-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        <p className="text-base sm:text-lg font-semibold">{participant.empresa}</p>
                                    </div>
                                )}

                                {/* Contagem de participações com ícones de estrela */}
                                {participant.eventos_participados && participant.eventos_participados.length > 0 && (
                                    <div className="mt-3 sm:mt-4 mb-4 sm:mb-6">
                                        <p className="text-sm sm:text-md font-semibold mb-2">Participações:</p>
                                        <div className="flex items-center justify-center flex-wrap gap-1">
                                            {Array(participant.eventos_participados.length).fill(0).map((_, i) => (
                                                <div key={i} className="transform transition-all duration-300 hover:scale-125 hover:rotate-12">
                                                    <StarIcon key={i} color={eventTextColor} />
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs sm:text-sm mt-2 font-medium">{participant.eventos_participados.length} {participant.eventos_participados.length === 1 ? 'evento' : 'eventos'} participados</p>
                                    </div>
                                )}
                                {participant.eventos_participados && participant.eventos_participados.length === 0 && (
                                    <div className="bg-white bg-opacity-10 rounded-lg p-2 sm:p-3 mt-3 sm:mt-4 mb-4 sm:mb-6 transform transition-all duration-300 hover:scale-105">
                                        <p className="text-xs sm:text-sm font-medium">🎉 Primeira participação! 🎉</p>
                                    </div>
                                )}


                                {latestEvent && (
                                    <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-6 shadow-inner transform transition-all duration-500 hover:bg-opacity-30 hover:shadow-lg"
                                         style={{ color: eventTextColor }}> {/* Mantém a cor do texto para o bloco do evento */}
                                        <div className="flex items-center justify-center mb-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-md font-medium">Evento:</p>
                                        </div>
                                        <p className="text-2xl font-bold tracking-wide">{latestEvent.nome}</p>
                                        <div className="flex items-center justify-center mt-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-sm">{new Date(latestEvent.data).toLocaleDateString('pt-BR', {
                                                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}</p>
                                        </div>
                                    </div>
                                )}
                                {/* Logo da Golang Sampa - movido para o final do conteúdo da credencial */}
                                <div className="mt-4 sm:mt-6 relative">
                                    <div className="absolute inset-0 bg-white bg-opacity-10 rounded-full filter blur-md transform scale-110"></div>
                                    <img
                                        src={golangLogoUrl}
                                        alt="Logo Golang Sampa"
                                        className="w-16 sm:w-20 md:w-24 h-auto mx-auto relative z-10 transform transition-all duration-500 hover:scale-110 hover:rotate-12" 
                                        onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/96x96/FFFFFF/000000?text=Logo"; }} // Fallback
                                    />
                                </div>
                            </div>
                            {/* Fundo sutil da credencial com padrão geométrico */}
                            <div
                                className="absolute inset-0 opacity-70 rounded-2xl transform translateZ(-1px) overflow-hidden"
                                style={{ backgroundColor: adjustColor(eventBgColor, -15) }}
                            >
                                {/* Padrão geométrico decorativo */}
                                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white opacity-10 transform translate-x-20 -translate-y-20"></div>
                                <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white opacity-10 transform -translate-x-16 translate-y-16"></div>
                                <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full bg-white opacity-5 transform -translate-x-1/2 -translate-y-1/2"></div>
                                {/* Linhas decorativas */}
                                <div className="absolute bottom-10 left-0 right-0 h-px bg-white opacity-20"></div>
                                <div className="absolute top-10 left-0 right-0 h-px bg-white opacity-20"></div>
                            </div>
                        </div>
i
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-4 sm:mt-6">
                            <button
                                onClick={shareCredential}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:rotate-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base flex items-center justify-center"
                                style={{ backgroundColor: buttonBgColor, color: eventTextColor, '--tw-ring-color': buttonRingColor }} // Cores dinâmicas para o botão
                                disabled={loading}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                {loading ? 'Compartilhando...' : 'Compartilhar nas Redes Sociais'}
                            </button>
                            <button
                                onClick={() => {
                                    setParticipant(null);
                                    setNome('');
                                    setEmail('');
                                    setEmpresa(''); // Limpa o campo empresa
                                    setProfilePictureBase64(''); // Limpa a foto de perfil também
                                    setSuccessMessage('');
                                }}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:rotate-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 text-sm sm:text-base flex items-center justify-center"
                                style={{ backgroundColor: adjustColor(eventBgColor, -10), color: eventTextColor, '--tw-ring-color': buttonRingColor }} // Cores dinâmicas para o botão
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Cadastrar Nova Credencial
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
