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

    // Função para gerar e baixar a credencial em PDF
    const downloadCredential = async () => {
        if (!credentialRef.current) {
            setError("Erro: Elemento da credencial não encontrado para download.");
            return;
        }
        // Verifica se as bibliotecas estão disponíveis globalmente
        if (!window.html2canvas || !window.jspdf) {
            setError("Erro: Bibliotecas de PDF (html2canvas, jspdf) não carregadas. Por favor, inclua-as via CDN.");
            return;
        }

        setLoading(true);
        try {
            // Renderiza o elemento HTML da credencial em um canvas
            const canvas = await window.html2canvas(credentialRef.current, {
                scale: 2, // Aumenta a resolução para melhor qualidade no PDF
                useCORS: true, // Importante se houver imagens de outras origens
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4'); // 'p' para retrato, 'mm' para milímetros, 'a4' para tamanho da página

            const imgWidth = 190; // Largura da imagem no PDF (ajuste conforme necessário)
            const pageHeight = pdf.internal.pageSize.height;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;

            let position = 10; // Posição inicial Y no PDF

            // Adiciona a imagem ao PDF, dividindo em várias páginas se necessário
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`credencial_${participant.nome.replace(/\s/g, '_')}.pdf`);
            setSuccessMessage('Credencial baixada com sucesso!');
        } catch (err) {
            console.error("Erro ao baixar credencial:", err);
            setError(`Erro ao baixar a credencial: ${err.message}.`);
        } finally {
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
            className="min-h-screen font-inter flex flex-col items-center justify-center p-4"
            style={{
                backgroundColor: eventBgColor,
                color: eventTextColor
            }}
        >
            {/* O bloco de exibição do User ID foi removido daqui */}

            <div className="bg-gray-800 bg-opacity-90 rounded-xl shadow-2xl p-8 max-w-lg w-full transform transition-all duration-300 hover:scale-105">
                <h1 className="text-4xl font-extrabold text-center mb-6" style={{ color: "#eceff1" }}>
                    Checkin GolangSP
                </h1>

                {error && (
                    <div className="bg-red-600 bg-opacity-80 text-white p-4 rounded-lg mb-4 flex items-center justify-between shadow-md">
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="text-white font-bold text-xl ml-4">&times;</button>
                    </div>
                )}

                {successMessage && (
                    <div className="bg-green-600 bg-opacity-80 text-white p-4 rounded-lg mb-4 flex items-center justify-between shadow-md">
                        <span>{successMessage}</span>
                        <button onClick={() => setSuccessMessage('')} className="text-white font-bold text-xl ml-4">&times;</button>
                    </div>
                )}

                {!participant ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="nome" className="block text-lg font-medium text-gray-300 mb-2">
                                Nome Completo
                            </label>
                            <input
                                type="text"
                                id="nome"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                className="w-full px-5 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
                                style={{ borderColor: adjustColor(eventTextColor, -30), focusRingColor: buttonRingColor }} // Borda e foco dinâmicos
                                placeholder="Seu nome"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-lg font-medium text-gray-300 mb-2">
                                E-mail
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
                                style={{ borderColor: adjustColor(eventTextColor, -30), focusRingColor: buttonRingColor }} // Borda e foco dinâmicos
                                placeholder="seu.email@exemplo.com"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="empresa" className="block text-lg font-medium text-gray-300 mb-2">
                                Empresa (Opcional)
                            </label>
                            <input
                                type="text"
                                id="empresa"
                                value={empresa}
                                onChange={(e) => setEmpresa(e.target.value)}
                                className="w-full px-5 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200"
                                style={{ borderColor: adjustColor(eventTextColor, -30), focusRingColor: buttonRingColor }} // Borda e foco dinâmicos
                                placeholder="Nome da sua empresa"
                            />
                        </div>
                        <div>
                            <label htmlFor="profilePicture" className="block text-lg font-medium text-gray-300 mb-2">
                                Foto de Perfil (Opcional)
                            </label>
                            <input
                                type="file"
                                id="profilePicture"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="w-full px-5 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-500"
                            />
                            {/* Pré-visualização da imagem ou ícone de perfil */}
                            <div className="mt-4 text-center">
                                <p className="text-gray-400 text-sm mb-2">Pré-visualização da Imagem:</p>
                                {profilePictureBase64 ? (
                                    <img src={profilePictureBase64} alt="Pré-visualização da Foto de Perfil" className="max-w-xs max-h-48 mx-auto rounded-lg shadow-md object-cover" />
                                ) : (
                                    <div className="w-24 h-24 mx-auto flex items-center justify-center rounded-full bg-gray-700 border-2" style={{ borderColor: eventTextColor }}>
                                        <ProfileIcon color={eventTextColor} size="24" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="flex flex-col items-center space-y-6">
                        <h2 className="text-3xl font-bold text-center" style={{ color: "#eceff1" }}>Sua Credencial</h2>
                        <div
                            ref={credentialRef}
                            className="border-4 rounded-2xl p-8 shadow-xl w-full max-w-sm text-center transform rotate-y-3 perspective-1000"
                            style={{
                                transformStyle: 'preserve-3d',
                                backgroundColor: eventBgColor, // Usa a cor de fundo do evento
                                color: eventTextColor, // Usa a cor do texto do evento
                                borderColor: eventTextColor // Borda da credencial com a cor do texto do evento
                            }}
                        >
                            <div className="relative z-10">
                                {/* Foto de perfil ou ícone de perfil */}
                                {profilePictureBase64 ? (
                                    <img
                                        src={profilePictureBase64}
                                        alt="Foto de Perfil"
                                        className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-2"
                                        style={{ borderColor: eventTextColor }}
                                    />
                                ) : (
                                    <div className="w-24 h-24 mx-auto flex items-center justify-center rounded-full bg-gray-700 border-2" style={{ borderColor: eventTextColor }}>
                                        <ProfileIcon color={eventTextColor} size="24" />
                                    </div>
                                )}
                                <p className="text-lg mb-2">Participante:</p>
                                <p className="text-4xl font-extrabold mb-4 uppercase">{participant.nome}</p>
                                <p className="text-xl mb-2">{participant.email}</p>
                                {participant.empresa && ( // Exibe a empresa se estiver disponível
                                    <p className="text-lg mb-2 font-semibold">{participant.empresa}</p>
                                )}

                                {/* Contagem de participações com ícones de estrela */}
                                {participant.eventos_participados && participant.eventos_participados.length > 0 && (
                                    <div className="flex items-center justify-center flex-wrap gap-1 mt-4 mb-6">
                                        <p className="text-md font-semibold mr-2">Participações:</p>
                                        {Array(participant.eventos_participados.length).fill(0).map((_, i) => (
                                            <StarIcon key={i} color={eventTextColor} />
                                        ))}
                                    </div>
                                )}
                                {participant.eventos_participados && participant.eventos_participados.length === 0 && (
                                    <p className="text-sm text-gray-400 mt-4 mb-6">Primeira participação!</p>
                                )}


                                {latestEvent && (
                                    <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-6 shadow-inner"
                                         style={{ color: eventTextColor }}> {/* Mantém a cor do texto para o bloco do evento */}
                                        <p className="text-md">Evento:</p>
                                        <p className="text-2xl font-bold">{latestEvent.nome}</p>
                                        <p className="text-sm">{new Date(latestEvent.data).toLocaleDateString('pt-BR', {
                                            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}</p>
                                    </div>
                                )}
                                {/* Logo da Golang Sampa - movido para o final do conteúdo da credencial */}
                                <img
                                    src={golangLogoUrl}
                                    alt="Logo Golang Sampa"
                                    className="w-24 h-auto mx-auto mt-6" // Adicionado margem superior para espaçamento
                                    onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/96x96/FFFFFF/000000?text=Logo"; }} // Fallback
                                />
                            </div>
                            {/* Fundo sutil da credencial, um pouco mais escuro que a cor de fundo do evento */}
                            <div
                                className="absolute inset-0 opacity-70 rounded-2xl transform translateZ(-1px)"
                                style={{ backgroundColor: adjustColor(eventBgColor, -15) }}
                            ></div>
                        </div>

                        <button
                            onClick={downloadCredential}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: buttonBgColor, color: eventTextColor, '--tw-ring-color': buttonRingColor }} // Cores dinâmicas para o botão
                            disabled={loading}
                        >
                            {loading ? 'Baixando...' : 'Baixar Credencial em PDF'}
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
                            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800"
                            style={{ backgroundColor: adjustColor(eventBgColor, -10), color: eventTextColor, '--tw-ring-color': buttonRingColor }} // Cores dinâmicas para o botão
                        >
                            Cadastrar Nova Credencial
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
