let meuId = null;
let meuNome = null;
let minhaRole = 'inocente'; 
let jogadoresNaSala = []; 
let fatosRecebidos = {}; 
let estadoAtual = 'lobby';
let temaAtual = null; // Variável para armazenar o tema
let votoEnviado = false; // Flag para impedir voto duplicado

// ELEMENTOS HTML aq jae
const $inputNome = document.getElementById('input-nome');
const $btnEntrar = document.getElementById('btn-entrar');
const $btnIniciarOnline = document.getElementById('btn-iniciar-online');
const $listaJogadoresLobby = document.getElementById('lista-jogadores-lobby');

const $btnEnviarFato = document.getElementById('btn-enviar-fato');
const $inputFato = document.getElementById('input-fato');
const $displayTema = document.getElementById('display-tema'); // NOVO: Elemento para exibir o tema

const $telaEsperaRole = document.getElementById('tela-espera-role');
const $avisoMentirosoOnline = document.getElementById('aviso-mentiroso-online');
const $tituloRole = document.getElementById('titulo-role');

const $fatosApresentados = document.getElementById('fatos-apresentados');
const $gridVotacao = document.getElementById('grid-votacao');

const $telaResultado = document.getElementById('tela-resultado');
const $tituloResultado = document.getElementById('titulo-resultado');
const $imgMentiroso = document.getElementById('img-mentiroso');
const $nomeMentiroso = document.getElementById('nome-mentiroso');
const $mensagemVitoria = document.getElementById('mensagem-vitoria');
//CONEXÃO COM O SERVIDOR
const socket = io(); //Conecta ao servidor Node.js

// 
// LÓGICA DE COMUNICAÇÃO (Socket.IO Listeners)
//


$btnEntrar.addEventListener('click', () => {
    const nome = $inputNome.value.trim();
    if (nome.length < 3) {
        alert("Por favor, digite um nome válido (mínimo 3 caracteres).");
        return;
    }

    $btnEntrar.disabled = true;
    $btnEntrar.textContent = 'Aguardando...';
    
    socket.emit('joinGame', nome); 
    meuNome = nome;
    $inputNome.disabled = true;
    $btnEntrar.style.display = 'none';
});


$btnIniciarOnline.addEventListener('click', () => {
   
    if (jogadoresNaSala.length >= 2) {
        socket.emit('startGame');
        $btnIniciarOnline.disabled = true;
        $btnIniciarOnline.textContent = 'Iniciando Jogo...';
    }
});



socket.on('playerListUpdate', (lista) => {
    jogadoresNaSala = lista;
    atualizarLobby(); 
});


socket.on('roleAssignment', (data) => {
  
    minhaRole = data.role;
    temaAtual = data.tema; // ARMAZENA O TEMA
    revelarRole(); 
});


socket.on('gameState', (data) => {
    if (data.jogadorId && meuId === null) {
        meuId = data.jogadorId;
    }
    mudarEstado(data.estado); 
});


$btnEnviarFato.addEventListener('click', () => {
    const fato = $inputFato.value.trim();
    if (fato.length < 10) {
        alert("O fato deve ter pelo menos 10 caracteres.");
        return;
    }

    $btnEnviarFato.disabled = true;
    $btnEnviarFato.textContent = 'Aguardando Outros...';
    
    socket.emit('submitFact', fato); 
});


socket.on('allFactsCollected', (data) => {
 
    fatosRecebidos = data.fatos;
    jogadoresNaSala = data.jogadores; 
    montarFatosParaDiscussao(fatosRecebidos);
});

socket.on('finalResults', (resultado) => {
    mostrarResultadoFinal(resultado); 
});

// Tratamento de Erros
socket.on('error', (mensagem) => {
    alert(`Erro: ${mensagem}`);
    
    $btnEntrar.disabled = false;
    $btnEntrar.textContent = 'ENTRAR';
    $inputNome.disabled = false;
    $btnEntrar.style.display = 'block';
});

// =============================================================
// === FUNÇÕES DE CONTROLE DE ESTADO E UI ======================
// =============================================================

function mudarEstado(novoEstado) {
    document.querySelectorAll('.tela').forEach(tela => {
        tela.classList.remove('ativo');
    });

    const $novaTela = document.getElementById(`tela-${novoEstado}`);
    if ($novaTela) {
        $novaTela.classList.add('ativo');
        estadoAtual = novoEstado;
        console.log(`Estado atual: ${estadoAtual}`);
        
        // AÇÕES ESPECÍFICAS POR ESTADO
        if (novoEstado === 'coletandoFatos') {
            // Reinicia o input e re-habilita o botão
            $inputFato.value = '';
            $btnEnviarFato.disabled = false;
            $btnEnviarFato.textContent = 'Enviar Fato';
            $displayTema.textContent = temaAtual; // EXIBE O TEMA
        }
        if (novoEstado === 'votando') {
            votoEnviado = false; // Reseta a flag de voto
        }
    }
}

function atualizarLobby() {
    let html = '<ul>';
    jogadoresNaSala.forEach(jogador => {
        const status = jogador.id === meuId ? ' (VOCÊ)' : '';
        html += `<li>${jogador.nome}${status}</li>`;
    });
    html += '</ul>';
    
    $listaJogadoresLobby.innerHTML = `<h2>Jogadores na Sala (${jogadoresNaSala.length})</h2>` + html;
    
  
    if (jogadoresNaSala.length >= 2) {
        $btnIniciarOnline.disabled = false;
        $btnIniciarOnline.textContent = 'INICIAR JOGO';
    } else {
        $btnIniciarOnline.disabled = true;
        $btnIniciarOnline.textContent = 'Aguardando mais jogadores (mínimo 2)...';
    }
}

function revelarRole() {

    if (minhaRole === 'mentiroso') {
        $tituloRole.textContent = "VOCÊ É O MENTIROSO!";
    } else {
        $tituloRole.textContent = "VOCÊ É INOCENTE!";
    }

   
}


function montarFatosParaDiscussao(fatos) {
    $fatosApresentados.innerHTML = '';
    $gridVotacao.innerHTML = '';
    

    let fatosHtml = `<h3 class="text-xl font-semibold mb-4 text-white">Tema: ${temaAtual}</h3>`;
    
    jogadoresNaSala.forEach(jogador => {
        const fatoDoJogador = fatos[jogador.id] || "Este jogador não enviou um fato.";
        const nomeParaExibir = jogador.id === meuId ? `${jogador.nome} (VOCÊ)` : jogador.nome;

        fatosHtml += `
            <div class="p-4 mb-3 bg-white/10 rounded-lg shadow-md hover:bg-white/20 transition duration-300">
                <p class="font-bold text-lg text-yellow-300">${nomeParaExibir} FALOU:</p>
                <p class="text-white mt-1 italic">${fatoDoJogador}</p>
            </div>
        `;
    });
    $fatosApresentados.innerHTML = fatosHtml;
    

    let votacaoHtml = '<h3 class="text-2xl font-bold mb-4 text-center text-red-400">VOTE NO MENTIROSO:</h3>';
    
    jogadoresNaSala.forEach(jogador => {
   
        if (jogador.id !== meuId) {
            votacaoHtml += `
                <button class="botao-voto bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-200" data-id="${jogador.id}">
                    <p class="text-lg">${jogador.nome}</p>
                    <span class="text-sm opacity-75">Acusar</span>
                </button>
            `;
        }
    });
    $gridVotacao.innerHTML = votacaoHtml;
    
    document.querySelectorAll('.botao-voto').forEach(botao => {
        botao.addEventListener('click', handleVoto);
    });
}

/**

 */
function handleVoto(event) {
    if (votoEnviado) return; 
    const $botao = event.currentTarget;
    const jogadorVotadoId = $botao.dataset.id;
    
    votoEnviado = true;
    
    // Desabilita a votação
    document.querySelectorAll('.botao-voto').forEach(btn => {
        btn.disabled = true;
        if (btn === $botao) {
            btn.textContent = 'VOTO ENVIADO!';
            btn.classList.replace('bg-red-600', 'bg-green-600');
            btn.classList.replace('hover:bg-red-700', 'hover:bg-green-700');
        }
    });

    socket.emit('submitVote', jogadorVotadoId);
}

/**
 * Exibe a tela de resultado final com o vencedor da rodada e revela o Mentiroso.
 */
function mostrarResultadoFinal(resultado) {
    const { mentirosoReal, acusadoId, vencedor } = resultado;
    
    const nomeMentiroso = mentirosoReal.nome; 
    const nomeAcusado = jogadoresNaSala.find(j => j.id === acusadoId)?.nome || "Ninguém";

    $tituloResultado.textContent = "O MENTIROSO ERA...";
    

    $imgMentiroso.src = "https://placehold.co/150x150/FFC400/000?text=MENTIROSO"; 
    $imgMentiroso.style.display = 'block';
    $imgMentiroso.style.width = '150px';
    $imgMentiroso.style.margin = '20px auto';
    $imgMentiroso.className = 'rounded-full border-4 border-yellow-400';

    $nomeMentiroso.textContent = nomeMentiroso; 
    
    // Determina a Mensagem de Vitória
    let mensagem;
    let corMensagem;

    if (vencedor === 'inocentes') {
        mensagem = `VITÓRIA DOS INOCENTES! 🎉\nO Mentiroso (${nomeMentiroso}) foi corretamente acusado! O mais votado foi ${nomeAcusado}.`;
        corMensagem = '#4CAF50'; 
    } else {
        mensagem = `VITÓRIA DO MENTIROSO! 😈\nO acusado foi ${nomeAcusado}. O Mentiroso (${nomeMentiroso}) escapou!`;
        corMensagem = '#FFC400'; 
    }

    $mensagemVitoria.textContent = mensagem;
    $mensagemVitoria.style.color = corMensagem;
    
    // Adiciona botão para Recomeçar
    const $btnRecomecar = document.createElement('button');
    $btnRecomecar.textContent = 'Jogar Novamente';
    $btnRecomecar.className = 'mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full transition duration-300';
    $btnRecomecar.onclick = () => {
        // Envia um sinal para o servidor reiniciar o estado 
        window.location.reload();
    };

    const $container = $telaResultado.querySelector('div') || $telaResultado;
    $container.appendChild($btnRecomecar);
}

//INICIALIZAÇÃO
atualizarLobby();
