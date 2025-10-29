function classe_usuario(){
const definir_classe  = document.getElementById("classe")
const classes = ["detetive", "impostor", "vitima"]
let sorteando = Math.floor(Math.random() * classes.length)
definir_classe.innerHTML = classes[sorteando]
}

window.onload= classe_usuario;

//adicionar curiosidades
const apagar = document.getElementById("sorteio")
const mostrar_curiosidade = document.getElementById("escrever_curiosidade")
  setTimeout(() => {
    apagar.style.display = "none"
mostrar_curiosidade.style.display = "block"
  }, 4000);


apagar.style.display = "block";
    mostrar_curiosidade.style.display = "none";

    function enviar(){
      const resp = document.getElementById("respostas")
      const resp_user = document.getElementById("curiosidade1")
      const curiosidade_digitada = document.getElementById ("curiosidade_input").value
      resp.style.display = "block"
      mostrar_curiosidade.style.display = "none"
      resp_user.innerHTML = curiosidade_digitada
    }

    