// Backend Node.js para o jogo
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// kLISTA DE TEMAS (20 TEMAS)
const TEMAS = [
    "ANIMES EM GERAL",
    "ANIMAIS DOMESTICOS",
    "FILMES EM GERAL",
    "ANIMAIS SELVAGENS",
    "ESCOLA",
    "FILMES DA DC",
    "FILMES DA MARVEL",
    "JOGOS EM GERAL",
    "FILMES DE ANIMES",
    "JOGOS MOBILE",
    "JOGOS DE PC",
    "JOGOS DO ROBLOX",
    "CLASH ROYALE",
    "ONE PIECE",
    "DEMON SLAYER",
    "ATACK ON TITAN",
    "YOUTUBERS",
    "INSTAGRAM EM GERAL",
    "TIKTOK EM GERAL",
    "PERSONAGENS DE ANIMES"
];

// VARIÁVEIS DE ESTADO GLOBAL DO SERVIDOR
let jogadores = []; 
let fatos = {};     
let mentirosoId = null; 
let detetiveId = null; 
let votosRecebidos = {}; 
let temaAtual = null; 

const ESTADO_SALA = {
    LOBBY: 'lobby',
    ROLE: 'espera-role',
    FATOS: 'coletandoFatos',
    VOTACAO: 'votando',
    RESULTADO: 'resultado'
};
let estadoAtual = ESTADO_SALA.LOBBY;
// ----------------------------------------

app.use(express.static(__dirname)); 

//
// LÓGICA DO SERVIDORCONEXÕES E EVENTOS
// 
io.on('connection', (socket) => {
    console.log(`Novo jogador conectado: ${socket.id}`);

    // -jogador entra no jogo
    socket.on('joinGame', ({ nome: nomeJogador, score: scoreInicial = 0 }) => {
        
        // Verifica se o nome está em uso por outro socket (se o jogo está no LOBBY)
        if (jogadores.find(j => j.nome === nomeJogador && j.id !== socket.id) && estadoAtual === ESTADO_SALA.LOBBY) {
            socket.emit('error', 'Nome já em uso. Escolha outro nome.');
            return;
        }
        
        let novoJogador = { id: socket.id, nome: nomeJogador, role: 'inocente', score: scoreInicial };
        
        // Se for uma reconexão (o nome já existe)
        const jogadorIndex = jogadores.findIndex(j => j.nome === nomeJogador);
        if (jogadorIndex !== -1) {
             // Mantém a pontuação e o nome, mas atualiza o socket ID
             jogadores[jogadorIndex].id = socket.id;
             jogadores[jogadorIndex].score = scoreInicial; 
             novoJogador = jogadores[jogadorIndex];
        } else {
            // Adiciona como novo jogador
            jogadores.push(novoJogador);
        }

        socket.data.nome = nomeJogador;
        
        
        if (estadoAtual !== ESTADO_SALA.LOBBY && estadoAtual !== ESTADO_SALA.ROLE && estadoAtual !== ESTADO_SALA.FATOS && estadoAtual !== ESTADO_SALA.VOTACAO) {
            io.to(socket.id).emit('gameState', { estado: ESTADO_SALA.LOBBY, jogadorId: socket.id });
        } else {
            
            io.to(socket.id).emit('gameState', { estado: estadoAtual, jogadorId: socket.id });
        }
        
        
        io.emit('playerListUpdate', jogadores.map(j => ({ id: j.id, nome: j.nome, score: j.score })));
    });

   
    socket.on('startGame', () => {
        if (jogadores.length < 2) return; 
        if (estadoAtual !== ESTADO_SALA.LOBBY) return;

        
        jogadores.forEach(j => j.role = 'inocente'); 
        mentirosoId = null;
        detetiveId = null;
        fatos = {}; 
        votosRecebidos = {}; 

        // Define o Mentiroso e o Tema
        const indexMentiroso = Math.floor(Math.random() * jogadores.length);
        jogadores[indexMentiroso].role = 'mentiroso';
        mentirosoId = jogadores[indexMentiroso].id;
        
        const indexTema = Math.floor(Math.random() * TEMAS.length);
        temaAtual = TEMAS[indexTema]; 
        
        // Lógica para o DETETIVE (Mínimo de 3 jogadores)
        if (jogadores.length >= 3) {
            const inocentesCandidatos = jogadores.filter(j => j.role === 'inocente');
            
            if (inocentesCandidatos.length > 0) {
                const indexDetetive = Math.floor(Math.random() * inocentesCandidatos.length);
                const detetiveJogador = inocentesCandidatos[indexDetetive];
                
                const detetiveIndex = jogadores.findIndex(j => j.id === detetiveJogador.id);
                jogadores[detetiveIndex].role = 'detetive';
                detetiveId = detetiveJogador.id;
            }
        }
        
        estadoAtual = ESTADO_SALA.ROLE;

        // Avisa CADA jogador sobre sua rE O TEMA
        jogadores.forEach(j => {
            io.to(j.id).emit('roleAssignment', { 
                role: j.role, 
                tema: temaAtual, 
                detetiveHint: null 
            }); 
        });

        // Transiciona para a tela de Fatos após 3 segundos
        io.emit('gameState', { estado: estadoAtual });
        setTimeout(() => {
            estadoAtual = ESTADO_SALA.FATOS;
            io.emit('gameState', { estado: estadoAtual });
        }, 3000); 
    });
    
    // COLETA DE FATOS
    socket.on('submitFact', (fato) => {
        fatos[socket.id] = fato; 
        
        // Encontra todos os jogadores que estão participando E que têm um socket ativo
        const jogadoresParticipantesAtivos = jogadores.filter(j => 
            // Tem um roleatribuído
            (j.role === 'inocente' || j.role === 'mentiroso' || j.role === 'detetive') &&
            // E o ID do socket está atualmente conectado
            io.sockets.sockets.has(j.id) 
        );
        
        //O número de
        const fatosEsperados = jogadoresParticipantesAtivos.length;

       
        if (Object.keys(fatos).length >= fatosEsperados) {
            
            estadoAtual = ESTADO_SALA.VOTACAO;

           
            const jogadoresNaRodada = jogadores.filter(j => fatos[j.id]);

            io.emit('allFactsCollected', { fatos, jogadores: jogadoresNaRodada.map(j => ({ id: j.id, nome: j.nome })) });
            io.emit('gameState', { estado: estadoAtual });
        } else {
            // Opcional: Avisar o jogador quantos fatos ainda faltam
            socket.emit('fatoRecebido', {
                enviados: Object.keys(fatos).length,
                total: fatosEsperados
            });
        }
    });

    // CHAT
    socket.on('chatMessage', (message) => {
        const remetenteNome = socket.data.nome || "Anônimo"; 
        io.emit('receiveMessage', { sender: remetenteNome, text: message });
    });


    // VOTAÇÃO
    socket.on('submitVote', (votadoId) => {
        const eleitorId = socket.id;
        
        if (estadoAtual !== ESTADO_SALA.VOTACAO || votosRecebidos[eleitorId]) {
            return;
        }

        votosRecebidos[eleitorId] = votadoId; 
        console.log(`Voto registrado: ${eleitorId} votou em ${votadoId}`);

        // O número de votos esperados é igual ao número de jogadores que submeteram um fato
        const jogadoresNaRodada = jogadores.filter(j => fatos[j.id]);

        if (Object.keys(votosRecebidos).length === jogadoresNaRodada.length) {
            estadoAtual = ESTADO_SALA.RESULTADO;
            
            const resultadoFinal = processarVotos(jogadoresNaRodada, mentirosoId, detetiveId, votosRecebidos);
            
            // ATUALIZA AS PONTUAÇÕES NA MEMÓRIA
            resultadoFinal.pontuacoes.forEach(({ id, pontos }) => {
                const jogador = jogadores.find(j => j.id === id);
                if (jogador) {
                    jogador.score += pontos;
                }
            });
            
           
            fatos = {};
            votosRecebidos = {};
            mentirosoId = null;
            detetiveId = null;

            // Envia o resultado da rodada E a lista atualizada com pontuações
            io.emit('finalResults', resultadoFinal);
            io.emit('playerListUpdate', jogadores.map(j => ({ id: j.id, nome: j.nome, score: j.score }))); 
            io.emit('gameState', { estado: estadoAtual });
            
            // Tempo para resetar automaticamente para o lobby após o resultado
            setTimeout(() => {
                estadoAtual = ESTADO_SALA.LOBBY;
                io.emit('gameState', { estado: estadoAtual });
            }, 10000); 
        }
    });
    
    
    socket.on('disconnect', () => {
        console.log(`Jogador desconectado: ${socket.id}`);
        
        const jogadorIndex = jogadores.findIndex(j => j.id === socket.id);

        if (jogadorIndex !== -1) {
            // Se o jogo está no lobby, remove o jogador fantasma imediatamente
            if (estadoAtual === ESTADO_SALA.LOBBY) {
                jogadores.splice(jogadorIndex, 1);
            }
        }
    
        if (jogadores.length < 2 && estadoAtual !== ESTADO_SALA.LOBBY) {
            estadoAtual = ESTADO_SALA.LOBBY;
            io.emit('gameState', { estado: estadoAtual });
          
            fatos = {};
            votosRecebidos = {};
            mentirosoId = null;
            detetiveId = null;
        } 
        
       
        io.emit('playerListUpdate', jogadores.map(j => ({ id: j.id, nome: j.nome, score: j.score })));
    });
    
}); 

// =========================================================================

function processarVotos(jogadoresNaRodada, idMentiroso, idDetetive, votos) {
    const contagemVotos = {};
    const mentirosoReal = jogadoresNaRodada.find(j => j.id === idMentiroso);
    
   
    jogadoresNaRodada.forEach(j => contagemVotos[j.id] = 0);
    
   
    for (const votadoId of Object.values(votos)) {
        if (contagemVotos[votadoId] !== undefined) {
            contagemVotos[votadoId]++;
        }
    }
    
    
    let maisVotos = -1;
    let acusadoId = null;
    for (const id in contagemVotos) { 
        if (contagemVotos[id] > maisVotos) {
            maisVotos = contagemVotos[id];
            acusadoId = id;
        }
    }

    let vencedor = 'inocentes'; 
    let votoDetetive = null;
    
    // Inicializa array de pontuações da rodada (todos com 0)
    let pontuacoes = jogadoresNaRodada.map(j => ({ id: j.id, pontos: 0 })); 

  
    if (idDetetive && votos[idDetetive]) {
        votoDetetive = votos[idDetetive]; 
        
        // Condição 1: DETETIVE VENCE (10 pontos para ele, 5 para inocentes que acertaram)
        if (votoDetetive === idMentiroso) {
            vencedor = 'detetive'; 
            
            // PONTUAÇÃO: Detetive ganha 10 pontos
            const pontuacaoDetetive = pontuacoes.find(p => p.id === idDetetive);
            if (pontuacaoDetetive) { // <-- VERIFICAÇÃO DE SEGURANÇA
                pontuacaoDetetive.pontos = 10;
            }
            
            // PONTUAÇÃO: Inocentes que também votaram no Mentiroso ganham 5
            for (const eleitorId in votos) {
                const eleitor = jogadoresNaRodada.find(j => j.id === eleitorId);
                // Verifica se é Inocente e votou no Mentiroso
                if (eleitorId !== idDetetive && eleitor && eleitor.role === 'inocente' && votos[eleitorId] === idMentiroso) {
                     const pontuacaoInocente = pontuacoes.find(p => p.id === eleitorId);
                     if (pontuacaoInocente) {
                         pontuacaoInocente.pontos = 5;
                     }
                }
            }

        } 
        // Condição 2: MENTIROSO VENCE (10 pontos para ele)
        else if (votoDetetive && votoDetetive !== idMentiroso) {
            vencedor = 'mentiroso'; 
            
            // PONTUAÇÃO: Mentiroso ganha 10 pontos
            const pontuacaoMentiroso = pontuacoes.find(p => p.id === idMentiroso);
            if (pontuacaoMentiroso) { // <-- VERIFICAÇÃO DE SEGURANÇA
                pontuacaoMentiroso.pontos = 10;
            }
        }
    }
    
    // 3. Lógica padrão (SÓ É EXECUTADA se o Detetive não acionou a vitória/derrota unilateral)
    if (vencedor === 'inocentes') { 
        if (acusadoId === idMentiroso) {
            vencedor = 'inocentes'; 
            
            // PONTUAÇÃO: Inocentes e Detetive que votaram no Mentiroso ganham 5 pontos (Vitória da Maioria)
            for (const eleitorId in votos) {
                if (votos[eleitorId] === idMentiroso) {
                    const eleitor = jogadoresNaRodada.find(j => j.id === eleitorId);
                    if (eleitor && (eleitor.role === 'inocente' || eleitor.role === 'detetive')) {
                        const pontuacaoVotante = pontuacoes.find(p => p.id === eleitorId);
                        if (pontuacaoVotante) { // <-- VERIFICAÇÃO DE SEGURANÇA
                            pontuacaoVotante.pontos = 5;
                        }
                    }
                }
            }
            
        } else {
            vencedor = 'mentiroso'; 

            // PONTUAÇÃO: Mentiroso ganha 10 pontos (Vitória da Maioria)
            const pontuacaoMentiroso = pontuacoes.find(p => p.id === idMentiroso);
            if (pontuacaoMentiroso) { // <-- VERIFICAÇÃO DE SEGURANÇA
                pontuacaoMentiroso.pontos = 10;
            }
        }
    }

    // 4. Retorna o resultado
    return {
        contagem: contagemVotos,
        mentirosoReal: mentirosoReal ? { id: mentirosoReal.id, nome: mentirosoReal.nome } : { id: 'desconhecido', nome: 'Desconhecido' },
        acusadoId: acusadoId, 
        vencedor: vencedor,
        pontuacoes: pontuacoes, 
        votoDetetive: idDetetive ? { 
            eleitorId: idDetetive, 
            votadoId: votos[idDetetive], 
            isRevelado: acusadoId === idDetetive 
        } : null
    };
}


// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});